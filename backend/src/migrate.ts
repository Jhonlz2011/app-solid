import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

const runMigration = async () => {
  const connection = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(connection);

  console.log('Running migrations...');

  await migrate(db, { migrationsFolder: 'drizzle' });

  console.log('Migrations completed!');

  // Execute triggers.sql
  try {
    const triggersPath = path.join(process.cwd(), 'src', 'migrations', 'triggers.sql');
    if (fs.existsSync(triggersPath)) {
      console.log('Applying triggers...');
      const triggersSql = fs.readFileSync(triggersPath, 'utf8');
      await connection.unsafe(triggersSql);
      console.log('✅ Triggers applied successfully');
    } else {
      console.warn('⚠️ triggers.sql not found at', triggersPath);
    }
  } catch (error) {
    console.error('❌ Error applying triggers:', error);
  }

  await connection.end();
};

runMigration().catch(console.error);