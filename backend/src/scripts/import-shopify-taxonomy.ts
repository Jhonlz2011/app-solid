/**
 * backend/src/scripts/import-shopify-taxonomy.ts
 *
 * Script de Ingesta, Sanitización y Carga Masiva de Taxonomía Estándar Shopify (v2026-08)
 * Arquitectura 100% INTEGER (4 bytes) para Rendimiento Máximo en PostgreSQL
 *
 * Mapeo directo a: packages/schema/src/tables/taxonomy.ts
 * Destino: referenceDb (SRI_DATABASE_URL)
 *
 * Mejoras de Rendimiento:
 * 1. Claves primarias numéricas INTEGER para atributos y valores (IDs nativos Shopify).
 * 2. Surrogate INTEGER Primary Key + Unique 'code' para categorías ('ap-2-48-5').
 * 3. Tabla puente ultra-compacta (4B category_id + 4B attribute_id = 8B por fila).
 * 4. Rutas ltree numéricas compactas ('1.15.240.1084').
 * 5. Inserción en lotes (chunks de 500) con ON CONFLICT DO UPDATE para idempotencia total.
 */

import zlib from 'zlib';
import fs from 'fs';
import path from 'path';
import { sql } from '@app/schema';
import { referenceDb } from '../core/db';
import {
    taxonomyCategories,
    taxonomyAttributes,
    taxonomyAttributeValues,
    taxonomyCategoryAttributes,
} from '@app/schema/tables';

// =============================================================================
// Configuración de URLs Oficiales Shopify (Release v2026-08)
// =============================================================================
const SHOPIFY_RELEASE_TAG = 'v2026-08';
const BASE_DOWNLOAD_URL = `https://github.com/Shopify/product-taxonomy/releases/download/${SHOPIFY_RELEASE_TAG}`;

const URLS = {
    categories: `${BASE_DOWNLOAD_URL}/categories.es.json.gz`,
    attributes: `${BASE_DOWNLOAD_URL}/attributes.es.json.gz`,
};

// =============================================================================
// Paleta de Colores Canónicos (Enriquecimiento de Metadata HEX en Español)
// =============================================================================
const COLOR_HEX_MAP: Record<string, string> = {
    'negro': '#000000',
    'blanco': '#FFFFFF',
    'rojo': '#EF4444',
    'azul': '#3B82F6',
    'verde': '#22C55E',
    'amarillo': '#EAB308',
    'naranja': '#F97316',
    'gris': '#6B7280',
    'marron': '#78350F',
    'cafe': '#78350F',
    'beige': '#F5F5DC',
    'rosa': '#EC4899',
    'morado': '#8B5CF6',
    'violeta': '#7C3AED',
    'dorado': '#D4AF37',
    'plateado': '#C0C0C0',
    'plata': '#C0C0C0',
    'oro': '#FFD700',
    'turquesa': '#14B8A6',
    'cian': '#06B6D4',
    'magenta': '#D946EF',
    'azul-marino': '#1E3A8A',
    'verde-oliva': '#65A30D',
    'vino': '#881337',
    'borgoña': '#800020',
};

// =============================================================================
// Funciones de Sanitización y Extracción Numérica
// =============================================================================

/** Extrae el ID numérico entero de un GID GraphQL ('gid://shopify/TaxonomyAttribute/5398' -> 5398) */
export function extractGidNumber(gid: string | null | undefined): number | null {
    if (!gid) return null;
    const match = gid.match(/\/(\d+)$/);
    return match ? parseInt(match[1], 10) : null;
}

/** Limpia identificadores alfanuméricos ('gid://shopify/TaxonomyCategory/ap-1' -> 'ap-1') */
export function cleanGidString(gid: string | null | undefined): string | null {
    if (!gid) return null;
    const lastSlash = gid.lastIndexOf('/');
    return lastSlash !== -1 ? gid.substring(lastSlash + 1) : gid;
}

/** Divide un array en chunks para inserción por lotes */
function chunkArray<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}

/** Descarga un buffer de red o lee archivo local si existe */
async function fetchOrReadGzip(url: string, localFallbackName: string): Promise<any> {
    const localPath = path.resolve(process.cwd(), 'data', 'taxonomy', localFallbackName);
    if (fs.existsSync(localPath)) {
        console.log(`📂 Leyendo archivo local desde: ${localPath}`);
        const buffer = fs.readFileSync(localPath);
        const unzipped = zlib.gunzipSync(buffer).toString('utf-8');
        return JSON.parse(unzipped);
    }

    console.log(`🌐 Descargando release oficial desde GitHub: ${url}`);
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Error descargando ${url}: ${res.status} ${res.statusText}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    console.log(`📦 Descomprimiendo en memoria (${(buffer.length / 1024 / 1024).toFixed(2)} MB)...`);
    const unzipped = zlib.gunzipSync(buffer).toString('utf-8');
    return JSON.parse(unzipped);
}

// =============================================================================
// Pipeline Principal de Ingesta (100% INTEGER)
// =============================================================================
export async function runTaxonomyImport() {
    console.log(`\n======================================================`);
    console.log(`🚀 Iniciando Ingesta de Taxonomía Shopify Standard 2026`);
    console.log(`   Arquitectura: 100% INTEGER Primary & Foreign Keys`);
    console.log(`   Release: ${SHOPIFY_RELEASE_TAG}`);
    console.log(`======================================================\n`);

    // -------------------------------------------------------------------------
    // 1. Descarga / Lectura de Datasets en Español
    // -------------------------------------------------------------------------
    console.log('--- Paso 1: Obteniendo Datasets en Español ---');
    const categoriesJson = await fetchOrReadGzip(URLS.categories, 'categories.es.json.gz');
    const attributesJson = await fetchOrReadGzip(URLS.attributes, 'attributes.es.json.gz');

    // -------------------------------------------------------------------------
    // 2. Sanitización e Ingesta de Atributos y Valores (INTEGER IDs)
    // -------------------------------------------------------------------------
    console.log('\n--- Paso 2: Sanitizando e Insertando Atributos y Valores (INTEGER) ---');
    const rawAttributes = attributesJson.attributes ?? [];
    console.log(`Total de atributos encontrados: ${rawAttributes.length}`);

    const sanitizedAttributes: { id: number; name: string; handle: string; data_type: string }[] = [];
    const sanitizedValues: { id: number; attribute_id: number; name: string; handle: string; metadata: { hex?: string } | null }[] = [];

    for (const attr of rawAttributes) {
        const attrNumericId = extractGidNumber(attr.id);
        if (attrNumericId === null) continue;

        const handle = String(attr.handle || '').toLowerCase();
        
        // Detección de tipos
        let dataType = 'SELECT';
        if (handle === 'color' || handle.includes('colour') || attrNumericId === 1) {
            dataType = 'COLOR';
        } else if (handle.includes('weight') || handle.includes('dimensions') || handle.includes('voltage')) {
            dataType = 'NUMBER';
        }

        sanitizedAttributes.push({
            id: attrNumericId,
            name: attr.name,
            handle: attr.handle,
            data_type: dataType,
        });

        // Extraer valores canónicos anidados
        if (Array.isArray(attr.values)) {
            for (const val of attr.values) {
                const valNumericId = extractGidNumber(val.id);
                if (valNumericId === null) continue;

                const valHandle = String(val.handle || '').toLowerCase();
                
                // Si es atributo de color, emparejar código HEX
                let metadata: { hex?: string } | null = null;
                if (dataType === 'COLOR') {
                    const matchedHex = COLOR_HEX_MAP[valHandle] || COLOR_HEX_MAP[val.name.toLowerCase()];
                    if (matchedHex) {
                        metadata = { hex: matchedHex };
                    }
                }

                sanitizedValues.push({
                    id: valNumericId,
                    attribute_id: attrNumericId,
                    name: val.name,
                    handle: val.handle,
                    metadata,
                });
            }
        }
    }

    // Inserción en lotes de atributos (INTEGER PK)
    console.log(`Insertando ${sanitizedAttributes.length} atributos en chunks de 500...`);
    for (const chunk of chunkArray(sanitizedAttributes, 500)) {
        await referenceDb.insert(taxonomyAttributes)
            .values(chunk)
            .onConflictDoUpdate({
                target: taxonomyAttributes.id,
                set: {
                    name: sql`EXCLUDED.name`,
                    handle: sql`EXCLUDED.handle`,
                    data_type: sql`EXCLUDED.data_type`,
                },
            });
    }
    console.log(`✅ Atributos insertados exitosamente con IDs INTEGER.`);

    // Inserción en lotes de valores canónicos (INTEGER PK & FK)
    console.log(`Insertando ${sanitizedValues.length} valores canónicos en chunks de 500...`);
    let valCounter = 0;
    for (const chunk of chunkArray(sanitizedValues, 500)) {
        await referenceDb.insert(taxonomyAttributeValues)
            .values(chunk)
            .onConflictDoUpdate({
                target: taxonomyAttributeValues.id,
                set: {
                    name: sql`EXCLUDED.name`,
                    handle: sql`EXCLUDED.handle`,
                    metadata: sql`EXCLUDED.metadata`,
                },
            });
        valCounter += chunk.length;
        if (valCounter % 10000 === 0 || valCounter === sanitizedValues.length) {
            console.log(`   Progreso valores: ${valCounter} / ${sanitizedValues.length}`);
        }
    }
    console.log(`✅ Valores canónicos insertados exitosamente con IDs INTEGER.`);

    // -------------------------------------------------------------------------
    // 3. Sanitización e Ingesta de Categorías (INTEGER PK + Surrogate Mapping)
    // -------------------------------------------------------------------------
    console.log('\n--- Paso 3: Mapeando Categorías a Secuencia INTEGER Determinista ---');
    const verticals = categoriesJson.verticals ?? [];
    
    // 3.1 Construir mapa determinista de code -> integerId ordenado por jerarquía
    const codeToIdMap = new Map<string, number>();
    const rawCategoriesList: any[] = [];
    let sequenceCounter = 1;

    for (const vert of verticals) {
        if (Array.isArray(vert.categories)) {
            for (const cat of vert.categories) {
                const code = cleanGidString(cat.id)!;
                if (!codeToIdMap.has(code)) {
                    codeToIdMap.set(code, sequenceCounter++);
                }
                rawCategoriesList.push(cat);
            }
        }
    }

    console.log(`Total de categorías únicas asignadas a enteros: ${codeToIdMap.size}`);

    // 3.2 Construir entidades limpias con IDs numéricos
    const categoryAttributeBridges: { category_id: number; attribute_id: number; is_recommended: boolean }[] = [];
    const sanitizedCategories: {
        id: number;
        code: string;
        name: string;
        full_path: string;
        parent_id: number | null;
        depth: number;
        path_ltree: string;
    }[] = [];

    const processedCodeSet = new Set<string>();

    for (const cat of rawCategoriesList) {
        const code = cleanGidString(cat.id)!;
        if (processedCodeSet.has(code)) continue;
        processedCodeSet.add(code);

        const intId = codeToIdMap.get(code)!;
        const parentCode = cleanGidString(cat.parent_id);
        const parentIntId = parentCode ? (codeToIdMap.get(parentCode) ?? null) : null;

        // Construir path_ltree numérico: '1.15.240.1084'
        const ancestorIntIds = (cat.ancestors || [])
            .map((a: any) => codeToIdMap.get(cleanGidString(a.id) || ''))
            .filter((id: any): id is number => typeof id === 'number');
        const ltreePath = [...ancestorIntIds, intId].join('.');

        sanitizedCategories.push({
            id: intId,
            code,
            name: cat.name,
            full_path: cat.full_name,
            parent_id: parentIntId,
            depth: cat.level ?? 0,
            path_ltree: ltreePath,
        });

        // Registrar puente categoría ↔ atributos (claves 100% numéricas)
        if (Array.isArray(cat.attributes)) {
            for (const catAttr of cat.attributes) {
                const attrNum = extractGidNumber(catAttr.id);
                if (attrNum !== null) {
                    categoryAttributeBridges.push({
                        category_id: intId,
                        attribute_id: attrNum,
                        is_recommended: true,
                    });
                }
            }
        }
    }

    // 3.3 Ordenar estrictamente por depth ascendente para respetar FK parent_id
    sanitizedCategories.sort((a, b) => a.depth - b.depth);

    console.log(`Insertando ${sanitizedCategories.length} categorías por nivel jerárquico...`);
    const maxDepth = Math.max(...sanitizedCategories.map(c => c.depth), 0);
    for (let d = 0; d <= maxDepth; d++) {
        const levelCats = sanitizedCategories.filter(c => c.depth === d);
        if (levelCats.length === 0) continue;

        console.log(`   Insertando nivel ${d} (${levelCats.length} categorías)...`);
        for (const chunk of chunkArray(levelCats, 500)) {
            await referenceDb.insert(taxonomyCategories)
                .values(chunk.map(c => ({
                    id: c.id,
                    code: c.code,
                    name: c.name,
                    full_path: c.full_path,
                    parent_id: c.parent_id,
                    depth: c.depth,
                    path_ltree: c.path_ltree,
                    vector_busqueda: sql`to_tsvector('spanish', unaccent(${c.name} || ' ' || ${c.full_path}))`,
                })))
                .onConflictDoUpdate({
                    target: taxonomyCategories.id,
                    set: {
                        code: sql`EXCLUDED.code`,
                        name: sql`EXCLUDED.name`,
                        full_path: sql`EXCLUDED.full_path`,
                        parent_id: sql`EXCLUDED.parent_id`,
                        depth: sql`EXCLUDED.depth`,
                        path_ltree: sql`EXCLUDED.path_ltree`,
                        vector_busqueda: sql`EXCLUDED.vector_busqueda`,
                    },
                });
        }
    }
    console.log(`✅ Todas las categorías jerárquicas insertadas con IDs INTEGER.`);

    // -------------------------------------------------------------------------
    // 4. Ingesta de Puente Categoría ↔ Atributos (INTEGER ↔ INTEGER)
    // -------------------------------------------------------------------------
    console.log('\n--- Paso 4: Insertando Vínculos Categoría ↔ Atributos (8 Bytes por tupla) ---');
    console.log(`Total de vínculos a insertar: ${categoryAttributeBridges.length}`);

    // Deduplicar en memoria
    const bridgeSet = new Set<string>();
    const uniqueBridges: typeof categoryAttributeBridges = [];
    for (const b of categoryAttributeBridges) {
        const key = `${b.category_id}__${b.attribute_id}`;
        if (!bridgeSet.has(key)) {
            bridgeSet.add(key);
            uniqueBridges.push(b);
        }
    }

    let bridgeCounter = 0;
    for (const chunk of chunkArray(uniqueBridges, 500)) {
        await referenceDb.insert(taxonomyCategoryAttributes)
            .values(chunk)
            .onConflictDoNothing();
        bridgeCounter += chunk.length;
        if (bridgeCounter % 5000 === 0 || bridgeCounter === uniqueBridges.length) {
            console.log(`   Progreso vínculos: ${bridgeCounter} / ${uniqueBridges.length}`);
        }
    }
    console.log(`✅ Vínculos categoría ↔ atributos insertados exitosamente.`);

    console.log(`\n======================================================`);
    console.log(`🎉 Ingesta y Sanitización INTEGER Completada al 100%!`);
    console.log(`   - Atributos (INTEGER): ${sanitizedAttributes.length}`);
    console.log(`   - Valores Canónicos (INTEGER): ${sanitizedValues.length}`);
    console.log(`   - Categorías (INTEGER + code): ${sanitizedCategories.length}`);
    console.log(`   - Vínculos Cat-Attr (8 bytes): ${uniqueBridges.length}`);
    console.log(`======================================================\n`);
}

// Ejecución directa si se invoca desde CLI
if ((import.meta as any).main) {
    runTaxonomyImport()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error('❌ Error fatal durante la ingesta:', err);
            process.exit(1);
        });
}
