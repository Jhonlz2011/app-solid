-- =============================================================================
-- Zelys ERP — Estructura de Base de Datos de Referencias (dbReferences)
-- Ejecutar conectado a la base de datos: "dbReferences" (en pgAdmin 4 Query Tool)
-- =============================================================================

-- 1. Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS ltree;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Función IMMUTABLE f_unaccent (usada por sri.service.ts y geonames.service.ts)
DO $$
BEGIN
    IF to_regprocedure('public.f_unaccent(text)') IS NULL THEN
        EXECUTE $create$
            CREATE FUNCTION public.f_unaccent(text)
            RETURNS text
            LANGUAGE sql
            IMMUTABLE
            PARALLEL SAFE
            STRICT
            AS $func$
                SELECT public.unaccent('public.unaccent', $1);
            $func$;
        $create$;
    END IF;
END
$$;

-- =============================================================================
-- 3. Tabla: sri_produccion (Catastro SRI Ecuador)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.sri_produccion (
    numero_ruc text PRIMARY KEY,
    razon_social text NOT NULL,
    nombre_comercial text,
    canton text,
    is_active boolean DEFAULT false,
    is_sociedad boolean DEFAULT false,
    is_rimpe boolean DEFAULT false,
    obligado_contabilidad boolean DEFAULT false,
    agente_retencion boolean DEFAULT false,
    contribuyente_especial boolean DEFAULT false,
    score_global integer,
    vector_busqueda tsvector
);

CREATE INDEX IF NOT EXISTS idx_sri_produccion_vector
    ON public.sri_produccion USING gin (vector_busqueda);

CREATE INDEX IF NOT EXISTS idx_sri_produccion_score
    ON public.sri_produccion (score_global DESC NULLS LAST);

-- Trigger opcional: autogenera vector_busqueda si se inserta/actualiza en NULL
CREATE OR REPLACE FUNCTION public.fn_sri_produccion_vector()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.vector_busqueda IS NULL THEN
        NEW.vector_busqueda := to_tsvector(
            'spanish'::regconfig,
            public.f_unaccent(
                COALESCE(NEW.razon_social, '') || ' ' ||
                COALESCE(NEW.nombre_comercial, '') || ' ' ||
                COALESCE(NEW.numero_ruc, '')
            )
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sri_produccion_vector ON public.sri_produccion;
CREATE TRIGGER trg_sri_produccion_vector
BEFORE INSERT OR UPDATE ON public.sri_produccion
FOR EACH ROW EXECUTE FUNCTION public.fn_sri_produccion_vector();

-- =============================================================================
-- 4. Tabla: localidades (Ciudades / GeoNames)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.localidades (
    id serial PRIMARY KEY,
    ciudad text NOT NULL,
    pais text NOT NULL,
    codigo_pais text NOT NULL,
    vector_busqueda tsvector
);

CREATE INDEX IF NOT EXISTS idx_localidades_vector
    ON public.localidades USING gin (vector_busqueda);

-- Trigger opcional: autogenera vector_busqueda si se inserta/actualiza en NULL
CREATE OR REPLACE FUNCTION public.fn_localidades_vector()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.vector_busqueda IS NULL THEN
        NEW.vector_busqueda := to_tsvector(
            'spanish'::regconfig,
            public.f_unaccent(
                COALESCE(NEW.ciudad, '') || ' ' ||
                COALESCE(NEW.pais, '') || ' ' ||
                COALESCE(NEW.codigo_pais, '')
            )
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_localidades_vector ON public.localidades;
CREATE TRIGGER trg_localidades_vector
BEFORE INSERT OR UPDATE ON public.localidades
FOR EACH ROW EXECUTE FUNCTION public.fn_localidades_vector();

-- =============================================================================
-- 5. Tablas: Taxonomía Estándar Shopify (import-shopify-taxonomy.ts)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.taxonomy_categories (
    id integer PRIMARY KEY,
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    full_path text NOT NULL,
    parent_id integer,
    depth integer NOT NULL DEFAULT 0,
    path_ltree ltree,
    vector_busqueda tsvector
);

CREATE INDEX IF NOT EXISTS idx_tax_cat_parent
    ON public.taxonomy_categories USING btree (parent_id);

CREATE INDEX IF NOT EXISTS idx_tax_cat_code
    ON public.taxonomy_categories USING btree (code);

CREATE INDEX IF NOT EXISTS idx_tax_cat_vector
    ON public.taxonomy_categories USING gin (vector_busqueda);

CREATE INDEX IF NOT EXISTS idx_tax_cat_path_gist
    ON public.taxonomy_categories USING gist (path_ltree);

CREATE INDEX IF NOT EXISTS idx_tax_cat_name_trgm
    ON public.taxonomy_categories USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_tax_cat_full_path_trgm
    ON public.taxonomy_categories USING gin (full_path gin_trgm_ops);

CREATE TABLE IF NOT EXISTS public.taxonomy_attributes (
    id integer PRIMARY KEY,
    name text NOT NULL,
    handle text NOT NULL,
    data_type text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.taxonomy_attribute_values (
    id integer PRIMARY KEY,
    attribute_id integer NOT NULL
        REFERENCES public.taxonomy_attributes(id) ON DELETE CASCADE,
    name text NOT NULL,
    handle text NOT NULL,
    metadata jsonb
);

CREATE INDEX IF NOT EXISTS idx_tax_val_attr
    ON public.taxonomy_attribute_values USING btree (attribute_id);

CREATE TABLE IF NOT EXISTS public.taxonomy_category_attributes (
    category_id integer NOT NULL
        REFERENCES public.taxonomy_categories(id) ON DELETE CASCADE,
    attribute_id integer NOT NULL
        REFERENCES public.taxonomy_attributes(id) ON DELETE CASCADE,
    is_recommended boolean DEFAULT true,
    PRIMARY KEY (category_id, attribute_id)
);

CREATE INDEX IF NOT EXISTS idx_tax_cat_attr
    ON public.taxonomy_category_attributes USING btree (category_id, attribute_id);
