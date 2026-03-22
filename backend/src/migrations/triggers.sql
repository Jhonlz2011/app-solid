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
