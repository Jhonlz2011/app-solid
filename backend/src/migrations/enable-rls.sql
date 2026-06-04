DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND column_name = 'company_id'
          AND table_name NOT IN ('companies') -- 'companies' is the root tenant table and has no company_id column
    LOOP
        -- 1. Enable RLS on the table
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.table_name);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', r.table_name);
        
        -- 2. Drop existing policy to prevent duplicate errors
        EXECUTE format('DROP POLICY IF EXISTS tenant_policy ON %I', r.table_name);
        
        -- 3. Create table-specific policies
        IF r.table_name = 'uom' THEN
            -- Custom policy for UOM: tenant-specific OR global system UOMs
            EXECUTE format('
                CREATE POLICY tenant_policy ON %I 
                USING (
                    company_id = current_setting(''app.current_company_id'', true)::integer 
                    OR (company_id IS NULL AND is_system = true)
                )
            ', r.table_name);
            
        ELSIF r.table_name = 'auth_users' THEN
            -- Custom policy for auth_users: tenant-specific OR matching current username/email during login
            EXECUTE format('
                CREATE POLICY tenant_policy ON %I 
                USING (
                    company_id = current_setting(''app.current_company_id'', true)::integer 
                    OR username = current_setting(''app.current_username'', true) 
                    OR email = current_setting(''app.current_username'', true)
                )
            ', r.table_name);
            
        ELSIF r.table_name = 'sessions' THEN
            -- Custom policy for sessions: tenant-specific OR matching current session token during validation
            EXECUTE format('
                CREATE POLICY tenant_policy ON %I 
                USING (
                    company_id = current_setting(''app.current_company_id'', true)::integer 
                    OR id = current_setting(''app.current_session_id'', true)
                )
            ', r.table_name);
            
        ELSE
            -- Standard tenant isolation policy
            EXECUTE format('
                CREATE POLICY tenant_policy ON %I 
                USING (company_id = current_setting(''app.current_company_id'', true)::integer)
            ', r.table_name);
        END IF;
        
        RAISE NOTICE 'Row-Level Security and policies successfully applied for table %', r.table_name;
    END LOOP;
END $$;
