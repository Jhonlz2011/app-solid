import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: '../packages/schema/src/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});