import { pgTableCreator } from 'drizzle-orm/pg-core';

export const pgTableV2 = pgTableCreator((name) => name);
