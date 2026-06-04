-- Función ultraligera para insertar en la cola temporal (Outbox)
CREATE OR REPLACE FUNCTION process_audit_outbox()
RETURNS TRIGGER AS $$
DECLARE
    app_user_id VARCHAR;
    app_ip_address VARCHAR;
    action_type VARCHAR;
    record_id_val VARCHAR;
BEGIN
    -- Capturamos las variables inyectadas desde la transacción de Drizzle/Bun
    app_user_id := current_setting('app.user_id', true);
    app_ip_address := current_setting('app.ip_address', true);

    IF (TG_OP = 'DELETE') THEN
        action_type := 'DELETE';
        record_id_val := OLD.id::VARCHAR;
    ELSIF (TG_OP = 'UPDATE') THEN
        action_type := 'UPDATE';
        record_id_val := NEW.id::VARCHAR;
    ELSIF (TG_OP = 'INSERT') THEN
        action_type := 'INSERT';
        record_id_val := NEW.id::VARCHAR;
    END IF;

    -- Inserción "ciega" y rapidísima en la cola temporal (_audit_queue no tiene índices costosos)
    -- Generamos 'id' manualmente vía gen_random_uuid()::text ya que el trigger no dispara el $defaultFn de Bun
    INSERT INTO _audit_queue (
        table_name, record_id, action, old_data, new_data, user_id, ip_address
    ) VALUES (
        TG_TABLE_NAME,
        record_id_val,
        action_type,
        CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE row_to_json(OLD)::jsonb END,
        CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE row_to_json(NEW)::jsonb END,
        app_user_id,
        app_ip_address
    );

    -- El Patrón "Wake-Up": Avisamos a la aplicación que hay nuevos registros
    -- Notificación ultra-ligera y atómica que solo se emite SI la transacción hace COMMIT exitosamente.
    PERFORM pg_notify('audit_queue_channel', 'new_audit_log');

    IF (TG_OP = 'DELETE') THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;

-- Aplicando el trigger a la tabla entities (donde viven los suppliers)
DROP TRIGGER IF EXISTS audit_entities_outbox_trigger ON entities;

CREATE TRIGGER audit_entities_outbox_trigger
AFTER INSERT OR UPDATE OR DELETE ON entities
FOR EACH ROW EXECUTE FUNCTION process_audit_outbox();

DROP TRIGGER IF EXISTS audit_users_outbox_trigger ON auth_users;

CREATE TRIGGER audit_users_outbox_trigger
AFTER INSERT OR UPDATE OR DELETE ON auth_users
FOR EACH ROW EXECUTE FUNCTION process_audit_outbox();


-- =============================================================================
-- INVENTORY & WAREHOUSE LOCATIONS TRIGGERS
-- =============================================================================

-- 1. BEFORE TRIGGER FUNCTION: Recalcula path, depth e inhala warehouse_id del padre
CREATE OR REPLACE FUNCTION fn_trg_warehouse_locations_repath_before()
RETURNS TRIGGER AS $$
DECLARE
    new_parent_path LTREE;
    new_parent_wh_id INT;
    new_slug TEXT;
BEGIN
    -- Determinar el slug (segmento ltree) de la ubicación basado en el nombre limpio
    new_slug := regexp_replace(lower(NEW.name), '[^a-z0-9_]+', '_', 'g');
    new_slug := regexp_replace(new_slug, '_+', '_', 'g');
    new_slug := regexp_replace(new_slug, '^_+|_+$', '', 'g');

    -- Evitar ciclos infinitos básicos
    IF NEW.id = NEW.parent_id THEN
        RAISE EXCEPTION 'Ubicación no puede ser su propio padre.';
    END IF;

    IF NEW.parent_id IS NULL THEN
        NEW.path := new_slug::ltree;
        NEW.depth := 0;
    ELSE
        SELECT path, depth, warehouse_id INTO new_parent_path, NEW.depth, new_parent_wh_id 
        FROM warehouse_locations 
        WHERE id = NEW.parent_id;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Ubicación padre con ID % no existe.', NEW.parent_id;
        END IF;
        
        NEW.path := (new_parent_path::text || '.' || new_slug)::ltree;
        NEW.depth := NEW.depth + 1;
        
        -- Heredar el warehouse_id del padre si no está definido
        IF NEW.warehouse_id IS NULL THEN
            NEW.warehouse_id := new_parent_wh_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger BEFORE
DROP TRIGGER IF EXISTS trg_warehouse_locations_repath_before ON warehouse_locations;
CREATE TRIGGER trg_warehouse_locations_repath_before
BEFORE INSERT OR UPDATE OF parent_id, name, warehouse_id ON warehouse_locations
FOR EACH ROW EXECUTE FUNCTION fn_trg_warehouse_locations_repath_before();


-- 2. AFTER TRIGGER FUNCTION: Actualiza recursivamente el path y warehouse_id de los descendientes
CREATE OR REPLACE FUNCTION fn_trg_warehouse_locations_repath_after()
RETURNS TRIGGER AS $$
DECLARE
    old_path_str TEXT;
    new_path_str TEXT;
    depth_diff INT;
BEGIN
    old_path_str := OLD.path::text;
    new_path_str := NEW.path::text;
    depth_diff := NEW.depth - OLD.depth;

    -- Si cambió el path o el warehouse_id, propagar el cambio a los descendientes
    IF OLD.path != NEW.path OR COALESCE(OLD.warehouse_id, -1) != COALESCE(NEW.warehouse_id, -1) THEN
        UPDATE warehouse_locations
        SET path = (new_path_str || substr(path::text, length(old_path_str) + 1))::ltree,
            depth = depth + depth_diff,
            warehouse_id = NEW.warehouse_id
        WHERE path <@ OLD.path AND id != NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger AFTER
DROP TRIGGER IF EXISTS trg_warehouse_locations_repath_after ON warehouse_locations;
CREATE TRIGGER trg_warehouse_locations_repath_after
AFTER UPDATE OF path, warehouse_id ON warehouse_locations
FOR EACH ROW EXECUTE FUNCTION fn_trg_warehouse_locations_repath_after();


-- 3. PROHIBIR REGISTRAR STOCK EN UBICACIONES TIPO VIEW
CREATE OR REPLACE FUNCTION fn_trg_prevent_stock_on_view_locations()
RETURNS TRIGGER AS $$
DECLARE
    loc_type VARCHAR;
BEGIN
    SELECT type INTO loc_type 
    FROM warehouse_locations 
    WHERE id = NEW.location_id;
    
    IF loc_type = 'VIEW' THEN
        RAISE EXCEPTION 'Operación denegada: No se puede registrar stock en ubicaciones de tipo agrupador (VIEW). ID Ubicación: %', NEW.location_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers BEFORE INSERT OR UPDATE en stock
DROP TRIGGER IF EXISTS trg_inventory_stock_view_prevent ON inventory_stock;
CREATE TRIGGER trg_inventory_stock_view_prevent
BEFORE INSERT OR UPDATE OF location_id ON inventory_stock
FOR EACH ROW EXECUTE FUNCTION fn_trg_prevent_stock_on_view_locations();

DROP TRIGGER IF EXISTS trg_inventory_dimensional_view_prevent ON inventory_dimensional_items;
CREATE TRIGGER trg_inventory_dimensional_view_prevent
BEFORE INSERT OR UPDATE OF location_id ON inventory_dimensional_items
FOR EACH ROW EXECUTE FUNCTION fn_trg_prevent_stock_on_view_locations();