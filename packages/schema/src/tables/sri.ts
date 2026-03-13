// app/packages/schema/src/tables/sri.ts
import { text, boolean, integer, customType } from 'drizzle-orm/pg-core';
import { pgTableV2 } from '../utils';

// Drizzle no tiene 'tsvector' por defecto, lo declaramos rápido
const customTsVector = customType<{ data: string }>({
    dataType() { return 'tsvector'; },
});

export const sriProduccion = pgTableV2('sri_produccion', {
    numero_ruc: text("numero_ruc").primaryKey(),
    razon_social: text('razon_social').notNull(),
    nombre_comercial: text('nombre_comercial'),
    canton: text('canton'),
    
    is_active: boolean('is_active').default(false),
    is_sociedad: boolean('is_sociedad').default(false),
    is_rimpe: boolean('is_rimpe').default(false),
    
    obligado_contabilidad: boolean('obligado_contabilidad').default(false),
    agente_retencion: boolean('agente_retencion').default(false),
    contribuyente_especial: boolean('contribuyente_especial').default(false),
    
    score_global: integer('score_global'),
    vector_busqueda: customTsVector('vector_busqueda'),
});