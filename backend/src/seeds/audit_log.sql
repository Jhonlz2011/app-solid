-- 1. Crear la tabla "Padre" particionada por rangos de fecha
CREATE TABLE audit_logs (
    id UUID NOT NULL,
    table_name VARCHAR(64) NOT NULL,
    record_id VARCHAR(128) NOT NULL,
    action audit_action NOT NULL,
    old_data JSONB,
    new_data JSONB,
    user_id INTEGER,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- La llave foránea sigue funcionando igual
    CONSTRAINT audit_logs_user_id_fk FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE SET NULL,
    
    -- La llave primaria compuesta
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- 2. Crear los índices en la tabla Padre 
-- (Postgres los propagará automáticamente a todas las particiones hijas)
CREATE INDEX idx_audit_target ON audit_logs (table_name, record_id);
CREATE INDEX idx_audit_user ON audit_logs (user_id);

-- 3. Crear las particiones hijas (Ejemplo mensual para 2026)
CREATE TABLE audit_logs_2026_03 PARTITION OF audit_logs FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE audit_logs_2026_04 PARTITION OF audit_logs FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE audit_logs_2026_05 PARTITION OF audit_logs FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

-- OPCIONAL PERO RECOMENDADO: Crear una partición por defecto
-- Si entra un registro con una fecha para la cual no has creado tabla, irá aquí en lugar de dar error.
CREATE TABLE audit_logs_default PARTITION OF audit_logs DEFAULT;

CREATE TABLE "audit_logs" (
	"id" uuid NOT NULL,
	"table_name" varchar(64) NOT NULL,
	"record_id" varchar(128) NOT NULL,
	"action" "audit_action" NOT NULL,
	"old_data" jsonb,
	"new_data" jsonb,
	"user_id" integer,
	"ip_address" "inet",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,

	PRIMARY KEY ("id", "created_at")

) PARTITION BY RANGE ("created_at");

CREATE TABLE "audit_logs_default" PARTITION OF "audit_logs" DEFAULT;

--> statement-breakpoint
-- Partición para Marzo 2026
CREATE TABLE "audit_logs_2026_03" PARTITION OF "audit_logs" FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
