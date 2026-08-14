// app/packages/schema/src/tables/localidades.ts
import { text, serial, customType } from 'drizzle-orm/pg-core';
import { pgTableV2 } from '../utils';

// Drizzle no tiene 'tsvector' por defecto, lo declaramos rápido
const customTsVector = customType<{ data: string }>({
    dataType() { return 'tsvector'; },
});

export const localidades = pgTableV2('localidades', {
    id: serial('id').primaryKey(),
    ciudad: text('ciudad').notNull(),
    pais: text('pais').notNull(),
    codigo_pais: text('codigo_pais').notNull(),
    vector_busqueda: customTsVector('vector_busqueda'),
});
