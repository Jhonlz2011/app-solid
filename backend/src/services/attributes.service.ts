import { eq, asc, and, sql } from '@app/schema';
import { db } from '../db';
import { attributeDefinitions, categoryAttributes, categories, productVariants, products } from '@app/schema/tables';
import type { AttributeDataType } from '@app/schema/enums';
import { DomainError } from './errors';
import { cacheService } from './cache.service';
import { broadcast } from '../plugins/sse';

// =============================================================================
// Types
// =============================================================================

export interface AttributeDefPayload {
    label: string;
    type: AttributeDataType;
    defaultOptions?: string[] | null;
    renamedOptions?: Array<{ from: string; to: string }>;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Deterministic slugify: "Voltaje de Entrada" → "voltaje_de_entrada"
 * ASCII-safe, underscore-separated, no leading/trailing underscores.
 */
function slugifyKey(label: string): string {
    return label
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')   // strip accents
        .trim()
        .replace(/[^a-z0-9]+/g, '_')       // non-alphanum → underscore
        .replace(/^_+|_+$/g, '')           // trim leading/trailing
        || 'attr';
}

/**
 * Generate a unique key for the given tenant.
 * If "voltaje_de_entrada" already exists, tries "voltaje_de_entrada_2", "_3", etc.
 * Max 10 attempts before throwing.
 */
async function generateUniqueKey(label: string, companyId: number): Promise<string> {
    const base = slugifyKey(label);

    // Fast path: check base key first
    const [existing] = await db.select({ id: attributeDefinitions.id })
        .from(attributeDefinitions)
        .where(and(
            eq(attributeDefinitions.key, base),
            eq(attributeDefinitions.company_id, companyId),
        ));

    if (!existing) return base;

    // Collision: try with numeric suffix
    for (let i = 2; i <= 10; i++) {
        const candidate = `${base}_${i}`;
        const [dup] = await db.select({ id: attributeDefinitions.id })
            .from(attributeDefinitions)
            .where(and(
                eq(attributeDefinitions.key, candidate),
                eq(attributeDefinitions.company_id, companyId),
            ));
        if (!dup) return candidate;
    }

    throw new DomainError(`No se pudo generar una clave única para "${label}"`, 409);
}

// =============================================================================
// ATTRIBUTE DEFINITIONS — Full CRUD (Tenant-Scoped)
// =============================================================================

export async function listAttributes(companyId: number) {
    return cacheService.getOrSet(`attributes:c${companyId}:list`, async () => {
        return db.select().from(attributeDefinitions)
            .where(eq(attributeDefinitions.company_id, companyId))
            .orderBy(asc(attributeDefinitions.label));
    }, 3600);
}

export async function getAttribute(id: number, companyId: number) {
    const [attr] = await db.select().from(attributeDefinitions)
        .where(and(eq(attributeDefinitions.id, id), eq(attributeDefinitions.company_id, companyId)));
    if (!attr) throw new DomainError('Atributo no encontrado', 404);

    // Get categories using this attribute
    const usedIn = await db
        .select({
            categoryId: categoryAttributes.category_id,
            categoryName: categories.name,
            required: categoryAttributes.required,
        })
        .from(categoryAttributes)
        .innerJoin(categories, eq(categories.id, categoryAttributes.category_id))
        .where(eq(categoryAttributes.attribute_def_id, id));

    return { ...attr, usedInCategories: usedIn };
}

export async function createAttribute(data: AttributeDefPayload, companyId: number) {
    // Auto-generate key from label
    const key = await generateUniqueKey(data.label, companyId);

    const [created] = await db.insert(attributeDefinitions).values({
        key,
        label: data.label,
        type: data.type,
        default_options: data.defaultOptions ?? null,
        company_id: companyId,
    }).returning();

    await cacheService.invalidate('attributes:*');
    broadcast('attribute:created', created, 'attributes');
    return created;
}

export async function updateAttribute(id: number, data: Partial<AttributeDefPayload>, companyId: number) {
    // Verify ownership
    const [existing] = await db.select().from(attributeDefinitions)
        .where(and(eq(attributeDefinitions.id, id), eq(attributeDefinitions.company_id, companyId)));
    if (!existing) throw new DomainError('Atributo no encontrado', 404);

    const renames = data.renamedOptions?.filter(r => r.from !== r.to && r.from.trim() && r.to.trim()) ?? [];

    // key is IMMUTABLE — never updated after creation
    const updateValues: Record<string, any> = {};
    if (data.label !== undefined) updateValues.label = data.label;
    if (data.type !== undefined) updateValues.type = data.type;
    if (data.defaultOptions !== undefined) updateValues.default_options = data.defaultOptions;
    updateValues.updated_at = new Date();

    // If there are renames, do everything in a single transaction
    if (renames.length > 0) {
        const [updated] = await db.transaction(async (tx) => {
            // 1. Update the attribute definition itself
            const [upd] = await tx.update(attributeDefinitions)
                .set(updateValues)
                .where(eq(attributeDefinitions.id, id))
                .returning();

            // 2. Cascade renames into category_attributes.specific_options
            for (const { from, to } of renames) {
                await tx.execute(sql`
                    UPDATE category_attributes
                    SET specific_options = (
                        SELECT jsonb_agg(
                            CASE WHEN elem #>> '{}' = ${from}
                                 THEN to_jsonb(${to}::text)
                                 ELSE elem
                            END
                        )
                        FROM jsonb_array_elements(specific_options) AS elem
                    )
                    WHERE attribute_def_id = ${id}
                      AND specific_options IS NOT NULL
                      AND specific_options @> ${sql`${JSON.stringify([from])}::jsonb`}
                `);
            }

            // 3. Cascade renames into product_variants.variant_attributes
            //    Uses the attribute's immutable key to target the right JSON path
            for (const { from, to } of renames) {
                await tx.execute(sql`
                    UPDATE product_variants pv
                    SET variant_attributes = jsonb_set(
                        variant_attributes,
                        ARRAY[${existing.key}],
                        to_jsonb(${to}::text)
                    )
                    FROM products p
                    WHERE pv.product_id = p.id
                      AND p.company_id = ${companyId}
                      AND pv.variant_attributes ->> ${existing.key} = ${from}
                `);
            }

            return [upd];
        });

        if (!updated) throw new DomainError('Atributo no encontrado', 404);
        await cacheService.invalidate('attributes:*');
        await cacheService.invalidate('categories:*');
        broadcast('attribute:updated', updated, 'attributes');
        return updated;
    }

    // Simple update (no renames)
    const [updated] = await db.update(attributeDefinitions)
        .set(updateValues)
        .where(eq(attributeDefinitions.id, id))
        .returning();

    if (!updated) throw new DomainError('Atributo no encontrado', 404);
    await cacheService.invalidate('attributes:*');
    broadcast('attribute:updated', updated, 'attributes');
    return updated;
}

/**
 * Deactivate — single UPDATE with tenant guard (no separate SELECT needed).
 */
export async function deactivateAttribute(id: number, companyId: number) {
    const [updated] = await db.update(attributeDefinitions)
        .set({ is_active: false, updated_at: new Date() })
        .where(and(eq(attributeDefinitions.id, id), eq(attributeDefinitions.company_id, companyId)))
        .returning();
    if (!updated) throw new DomainError('Atributo no encontrado', 404);

    await cacheService.invalidate('attributes:*');
    broadcast('attribute:updated', updated, 'attributes');
    return updated;
}

/**
 * Restore — single UPDATE with tenant guard (no separate SELECT needed).
 */
export async function restoreAttribute(id: number, companyId: number) {
    const [updated] = await db.update(attributeDefinitions)
        .set({ is_active: true, updated_at: new Date() })
        .where(and(eq(attributeDefinitions.id, id), eq(attributeDefinitions.company_id, companyId)))
        .returning();
    if (!updated) throw new DomainError('Atributo no encontrado', 404);

    await cacheService.invalidate('attributes:*');
    broadcast('attribute:updated', updated, 'attributes');
    return updated;
}

/**
 * Check references before hard delete.
 * Validates tenant ownership first, then counts category_attributes linking to this definition.
 */
export async function checkAttributeReferences(id: number, companyId: number) {
    // Verify attribute belongs to tenant
    const [attr] = await db.select({ id: attributeDefinitions.id })
        .from(attributeDefinitions)
        .where(and(eq(attributeDefinitions.id, id), eq(attributeDefinitions.company_id, companyId)));
    if (!attr) throw new DomainError('Atributo no encontrado', 404);

    const [result] = await db.select({
        count: sql<number>`count(*)`.mapWith(Number),
    })
        .from(categoryAttributes)
        .where(eq(categoryAttributes.attribute_def_id, id));

    const categoryCount = result?.count ?? 0;

    return {
        categories: categoryCount,
        total: categoryCount,
    };
}

/**
 * Hard delete — permanently removes an attribute definition.
 * Blocks deletion if used by any category.
 */
export async function hardDeleteAttribute(id: number, companyId: number) {
    const [existing] = await db.select().from(attributeDefinitions)
        .where(and(eq(attributeDefinitions.id, id), eq(attributeDefinitions.company_id, companyId)));
    if (!existing) throw new DomainError('Atributo no encontrado', 404);

    // Check references
    const refs = await checkAttributeReferences(id, companyId);
    if (refs.total > 0) {
        throw new DomainError('No se puede eliminar: el atributo está vinculado a categorías', 409);
    }

    await db.delete(attributeDefinitions).where(eq(attributeDefinitions.id, id));
    await cacheService.invalidate('attributes:*');
    broadcast('attribute:deleted', { id }, 'attributes');
    return { success: true };
}
