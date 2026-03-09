// src/services/sri.service.ts
import { sql, desc, eq } from '@app/schema';
import { sriDb } from '../db';
import { sriProduccion } from '@app/schema/sri';

export class SriService {
    static async buscarPorRuc(query: string) {
        const cleanQuery = query.trim();
        if (cleanQuery.length !== 13) return [];

        return await sriDb
            .select({
                ruc: sriProduccion.numero_ruc,
                razonSocial: sriProduccion.razon_social,
                nombreComercial: sriProduccion.nombre_comercial,
                isActive: sriProduccion.is_active,
                isSociedad: sriProduccion.is_sociedad,
                isRimpe: sriProduccion.is_rimpe,
                obligadoContabilidad: sriProduccion.obligado_contabilidad,
                agenteRetencion: sriProduccion.agente_retencion,
                contribuyenteEspecial: sriProduccion.contribuyente_especial,
            })
            .from(sriProduccion)
            // Busca RUCs exactos de 13 dígitos para mayor rendimiento
            .where(eq(sriProduccion.numero_ruc, cleanQuery));
    }

    // static async buscarPorNombre(query: string) {
    //     const cleanQuery = query.trim();
    //     if (cleanQuery.length === 0) return [];

    //     // Limpiamos de caracteres raros (- , .) para que no rompan el ts_query
    //     const searchTerms = cleanQuery
    //         .replace(/[^\p{L}\p{N}\s]/gu, '') // Respeta tildes, ñ, y números. Borra solo puntuación pura.
    //         .split(/\s+/)
    //         .filter(word => word.length > 0);

    //     if (searchTerms.length === 0) return [];

    //     const formattedQuery = searchTerms.map(word => `${word}:*`).join(' & ');
    //     const tsQuery = sql`to_tsquery('spanish'::regconfig, f_unaccent(${formattedQuery}))`;

    //     return await sriDb
    //         .select({
    //             ruc: sriProduccion.numero_ruc,
    //             razonSocial: sriProduccion.razon_social,
    //             nombreComercial: sriProduccion.nombre_comercial,
    //             isActive: sriProduccion.is_active,
    //             isSociedad: sriProduccion.is_sociedad,
    //             isRimpe: sriProduccion.is_rimpe,
    //             obligadoContabilidad: sriProduccion.obligado_contabilidad,
    //             agenteRetencion: sriProduccion.agente_retencion,
    //             contribuyenteEspecial: sriProduccion.contribuyente_especial,
    //         })
    //         .from(sriProduccion)
    //         .where(sql`${sriProduccion.vector_busqueda} @@ ${tsQuery}`)
    //         .orderBy(
    //             desc(sriProduccion.score_global),
    //             desc(sql`ts_rank(${sriProduccion.vector_busqueda}, ${tsQuery})`)
    //         )
    //         .limit(20);
    // }

    static async buscarPorNombre(query: string) {
    const cleanQuery = query.trim();
    if (cleanQuery.length === 0) return [];

    const searchTerms = cleanQuery
        .replace(/[^\p{L}\p{N}\s]/gu, '') 
        .split(/\s+/)
        .filter(word => word.length > 0);
    
    if (searchTerms.length === 0) return [];
    
    const formattedQuery = searchTerms.map(word => `${word}:*`).join(' & ');
    const tsQuery = sql`to_tsquery('spanish'::regconfig, f_unaccent(${formattedQuery}))`;

    // 🌪️ PASO 1: EL EMBUDO FÍSICO
    const subquery = sriDb
        .select()
        .from(sriProduccion)
        .where(sql`${sriProduccion.vector_busqueda} @@ ${tsQuery}`)
        .orderBy(sql`${sriProduccion.score_global} DESC NULLS LAST`)
        .limit(300) 
        .as('sq'); 

    return await sriDb
        .select({
            ruc: subquery.numero_ruc,
            razonSocial: subquery.razon_social,
            nombreComercial: subquery.nombre_comercial,
            isActive: subquery.is_active,
            isSociedad: subquery.is_sociedad,
            isRimpe: subquery.is_rimpe,
            obligadoContabilidad: subquery.obligado_contabilidad,
            agenteRetencion: subquery.agente_retencion,
            contribuyenteEspecial: subquery.contribuyente_especial,
        })
        .from(subquery)
        .orderBy(
            // 👇 SOLUCIÓN: Hacemos lo mismo en la consulta principal
            sql`${subquery.score_global} DESC NULLS LAST`,
            desc(sql`ts_rank(${subquery.vector_busqueda}, ${tsQuery})`)
        )
        .limit(20);
}
}