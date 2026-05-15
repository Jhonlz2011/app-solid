import { drizzlePostgres as drizzle, migrate } from '@app/schema';
import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

async function ensureAuditPartitions(connection: postgres.Sql) {
  console.log('⏳ Ensuring audit_logs partitions exist...');
  const currentDate = new Date();
  
  // We want partitions for current month, and next 6 months
  for (let i = 0; i <= 4; i++) {
    const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
    const nextMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i + 1, 1);
    
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const partitionName = `audit_logs_${year}_${month}`;
    
    const fromDate = targetDate.toISOString().split('T')[0];
    const toDate = nextMonthDate.toISOString().split('T')[0];
    
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS "${partitionName}" 
      PARTITION OF "audit_logs" 
      FOR VALUES FROM ('${fromDate}') TO ('${toDate}');
    `;
    
    await connection.unsafe(createTableQuery);
  }
  console.log('✅ Audit partitions ensured for the next 6 months');
}

const runMigration = async () => {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not defined');
    process.exit(1);
  }

  const connection = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(connection);

  try {
    console.log('⏳ Setting up PostgreSQL extensions...');
    await connection.unsafe('CREATE EXTENSION IF NOT EXISTS ltree;');
    console.log('✅ Extensions ensured!');

    console.log('⏳ Running Drizzle migrations...');

    // Check if migrations folder exists
    const migrationsFolder = path.join(process.cwd(), 'drizzle');
    if (!fs.existsSync(migrationsFolder)) {
      console.warn(`⚠️ Migrations folder not found at: ${migrationsFolder}`);
      console.warn('   Did you run "bun run db:generate"?');
    } else {
      await migrate(db, { migrationsFolder: 'drizzle' });
      console.log('✅ Drizzle migrations completed!');
    }

    // Execute triggers.sql
    const triggersPath = path.join(process.cwd(), 'src', 'migrations', 'triggers.sql');
    if (fs.existsSync(triggersPath)) {
      console.log('⏳ Applying triggers...');
      const triggersSql = fs.readFileSync(triggersPath, 'utf8');

      // Split by semicolon to run multiple statements if needed, 
      // or run as one block if it's a huge PL/pgSQL block. 
      // Usually .unsafe() handles blocks fine.
      await connection.unsafe(triggersSql);

      console.log('✅ Triggers applied successfully');
    } else {
      console.log('ℹ️ No triggers.sql found (skipping)');
    }

    // Ensure partitions are created dynamically
    await ensureAuditPartitions(connection);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1); // Exit with error code for CI/CD
  } finally {
    await connection.end();
    console.log('🔌 Database connection closed');
  }
};

runMigration();