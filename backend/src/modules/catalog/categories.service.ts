import { eq, and, asc, sql, inArray } from '@app/schema';
import { db } from '../../core/db';
import { categories, categoryAttributes, attributeDefinitions, products } from '@app/schema/tables';
import { DomainError } from '../../core/errors';
import { cacheService } from '../../core/cache';
import { broadcast } from '../../core/sse/sse';
import { RealtimeEvents } from '@app/schema/realtime-events';
import { withAuditTransaction, type AuditContext } from '../audit/audit.service';
import type {
    CategoryPayload,
    CategoryNode,
    CategoryDetail,
    CategoryFormSchemaData,
    CategoryReferences,
    CategoryReorderItem,
} from '@app/schema/dto';
export type { CategoryPayload };

// Helper: slugify for ltree path segments (ascii, lowercase, dots replaced)
function slugifyPath(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // strip accents
        .replace(/[^a-z0-9]+/g, '_')     // non-alphanum → underscore
        .replace(/^_+|_+$/g, '')          // trim leading/trailing underscores
        || 'sin_nombre';
}

// Helper: compute path and depth from parent
async function computePathAndDepth(parentId: number | null, name: string): Promise<{ path: string; depth: number }> {
    const segment = slugifyPath(name);
    if (!parentId) {
        return { path: segment, depth: 0 };
    }
    const [parent] = await db.select({ path: categories.path, depth: categories.depth })
        .from(categories)
        .where(eq(categories.id, parentId));
    if (!parent) {
        return { path: segment, depth: 0 };
    }
    return {
        path: `${parent.path}.${segment}`,
        depth: parent.depth + 1,
    };
}

// =============================================================================
// CATEGORIES — Enhanced CRUD with attribute sync
// =============================================================================

export async function listCategoriesEnhanced(companyId: number, flat = false): Promise<CategoryNode[]> {
    return cacheService.getOrSet(`categories:c${companyId}:enhanced:${flat}`, async () => {
        const allCategories = await db.select().from(categories)
            .where(eq(categories.company_id, companyId))
            .orderBy(asc(categories.sort_order), asc(categories.name));
        const categoryIds = allCategories.map(c => c.id);
        const allCatAttrs = categoryIds.length > 0
            ? await db
                .select({
                    categoryId: categoryAttributes.category_id,
                    attributeDefId: categoryAttributes.attribute_def_id,
                    required: categoryAttributes.required,
                    order: categoryAttributes.order,
                })
                .from(categoryAttributes)
                .where(and(
                    eq(categoryAttributes.company_id, companyId),
                    inArray(categoryAttributes.category_id, categoryIds)
                ))
            : [];

        // Build a map of category_id → attribute count
        const attrCountMap = new Map<number, number>();
        allCatAttrs.forEach(ca => {
            attrCountMap.set(ca.categoryId, (attrCountMap.get(ca.categoryId) ?? 0) + 1);
        });

        const enriched: CategoryNode[] = allCategories.map(cat => ({
            id: cat.id,
            company_id: cat.company_id,
            name: cat.name,
            parent_id: cat.parent_id,
            description: cat.description,
            icon: cat.icon,
            name_template: cat.name_template,
            sort_order: cat.sort_order,
            is_active: cat.is_active ?? true,
            path: cat.path,
            depth: cat.depth,
            attributeCount: attrCountMap.get(cat.id) ?? 0,
            created_at: cat.created_at,
            updated_at: cat.updated_at,
        }));

        if (flat) return enriched;

        // Build tree
        const map = new Map<number, CategoryNode>();
        const roots: CategoryNode[] = [];
        enriched.forEach(cat => map.set(cat.id, { ...cat, children: [] }));
        enriched.forEach(cat => {
            const node = map.get(cat.id)!;
            if (cat.parent_id) {
                const parent = map.get(cat.parent_id);
                if (parent) {
                    parent.children = parent.children ?? [];
                    parent.children.push(node);
                }
            } else {
                roots.push(node);
            }
        });

        return roots;
    }, 600);
}

export async function getCategoryEnhanced(id: number, companyId: number): Promise<CategoryDetail> {
    const [category] = await db.select().from(categories)
        .where(and(eq(categories.id, id), eq(categories.company_id, companyId)));
    if (!category) throw new DomainError('Categoría no encontrada', 404);

    // Get attributes with their definitions (tenant-guarded)
    const attrs = await db
        .select({
            id: categoryAttributes.id,
            attributeDefId: categoryAttributes.attribute_def_id,
            required: categoryAttributes.required,
            order: categoryAttributes.order,
            specificOptions: categoryAttributes.specific_options,
            // Join definition
            key: attributeDefinitions.key,
            label: attributeDefinitions.label,
            type: attributeDefinitions.type,
            defaultOptions: attributeDefinitions.default_options,
        })
        .from(categoryAttributes)
        .innerJoin(
            attributeDefinitions,
            and(
                eq(attributeDefinitions.id, categoryAttributes.attribute_def_id),
                eq(attributeDefinitions.company_id, companyId)
            )
        )
        .where(and(
            eq(categoryAttributes.category_id, id),
            eq(categoryAttributes.company_id, companyId)
        ))
        .orderBy(asc(categoryAttributes.order));

    return {
        id: category.id,
        company_id: category.company_id,
        name: category.name,
        parent_id: category.parent_id,
        description: category.description,
        icon: category.icon,
        name_template: category.name_template,
        sort_order: category.sort_order,
        is_active: category.is_active ?? true,
        path: category.path,
        depth: category.depth,
        created_at: category.created_at,
        updated_at: category.updated_at,
        attributes: attrs.map(a => ({
            id: a.id,
            attributeDefId: a.attributeDefId,
            required: a.required ?? false,
            order: a.order ?? 0,
            specificOptions: a.specificOptions,
            key: a.key,
            label: a.label,
            type: a.type,
            defaultOptions: a.defaultOptions,
        })),
    };
}

/**
 * form-schema endpoint: Returns only what the product form needs
 * (attributes + name_template) for a given category
 */
export async function getCategoryFormSchema(id: number, companyId: number): Promise<CategoryFormSchemaData> {
    const [category] = await db
        .select({
            id: categories.id,
            name: categories.name,
            nameTemplate: categories.name_template,
        })
        .from(categories)
        .where(and(eq(categories.id, id), eq(categories.company_id, companyId)));

    if (!category) throw new DomainError('Categoría no encontrada', 404);

    const attrs = await db
        .select({
            id: attributeDefinitions.id,
            key: attributeDefinitions.key,
            label: attributeDefinitions.label,
            type: attributeDefinitions.type,
            defaultOptions: attributeDefinitions.default_options,
            required: categoryAttributes.required,
            order: categoryAttributes.order,
            specificOptions: categoryAttributes.specific_options,
        })
        .from(categoryAttributes)
        .innerJoin(
            attributeDefinitions,
            and(
                eq(attributeDefinitions.id, categoryAttributes.attribute_def_id),
                eq(attributeDefinitions.company_id, companyId)
            )
        )
        .where(and(
            eq(categoryAttributes.category_id, id),
            eq(categoryAttributes.company_id, companyId)
        ))
        .orderBy(asc(categoryAttributes.order));

    // Merge options: specificOptions override defaultOptions
    const attributes = attrs.map(a => ({
        id: a.id,
        key: a.key,
        label: a.label,
        type: a.type,
        required: a.required ?? false,
        order: a.order ?? 0,
        options: ((a.specificOptions as string[] | null) ?? (a.defaultOptions as string[] | null) ?? []) as string[],
    }));

    return { category, attributes };
}

export async function createCategoryEnhanced(data: CategoryPayload, clientId?: string): Promise<CategoryNode> {
    const { path, depth } = await computePathAndDepth(data.parentId ?? null, data.name);

    const created = await db.transaction(async (tx) => {
        const [row] = await tx.insert(categories).values({
            company_id: data.companyId!,
            name: data.name,
            parent_id: data.parentId ?? null,
            description: data.description ?? null,
            icon: data.icon ?? null,
            name_template: data.nameTemplate ?? null,
            sort_order: data.sortOrder ?? 0,
            path,
            depth,
        }).returning();

        // Sync attributes
        if (data.attributes?.length) {
            await tx.insert(categoryAttributes).values(
                data.attributes.map(a => ({
                    company_id: data.companyId!,
                    category_id: row.id,
                    attribute_def_id: a.attributeDefId,
                    required: a.required ?? false,
                    order: a.order ?? 0,
                    specific_options: (a.specificOptions as string[] | null) ?? null,
                }))
            );
        }

        return row;
    });

    await cacheService.invalidate(`categories:c${data.companyId}:*`);
    broadcast(RealtimeEvents.ENTITY.CREATED, { type: 'category', id: created.id, entity: created, clientId }, RealtimeEvents.ROOMS.CATEGORIES);
    return {
        ...created,
        attributeCount: data.attributes?.length ?? 0,
        is_active: created.is_active ?? true,
    };
}

export async function updateCategoryEnhanced(id: number, data: Partial<CategoryPayload>, companyId: number, clientId?: string): Promise<CategoryNode> {
    const updated = await db.transaction(async (tx) => {
        // Verify ownership
        const [existing] = await tx.select().from(categories)
            .where(and(eq(categories.id, id), eq(categories.company_id, companyId)));
        if (!existing) throw new DomainError('Categoría no encontrada', 404);

        const updateValues: Record<string, any> = {};
        if (data.name !== undefined) updateValues.name = data.name;
        if (data.parentId !== undefined) updateValues.parent_id = data.parentId;
        if (data.description !== undefined) updateValues.description = data.description;
        if (data.icon !== undefined) updateValues.icon = data.icon;
        if (data.nameTemplate !== undefined) updateValues.name_template = data.nameTemplate;
        if (data.sortOrder !== undefined) updateValues.sort_order = data.sortOrder;

        // Compute path/depth BEFORE update (single query optimization)
        if (data.name !== undefined || data.parentId !== undefined) {
            const newName = data.name ?? existing.name;
            const newParentId = data.parentId !== undefined ? data.parentId : existing.parent_id;
            const { path, depth } = await computePathAndDepth(newParentId ?? null, newName);
            updateValues.path = path;
            updateValues.depth = depth;
        }

        const [row] = await tx.update(categories)
            .set(updateValues)
            .where(and(eq(categories.id, id), eq(categories.company_id, companyId)))
            .returning();

        // Sync attributes (DELETE ALL + INSERT ALL — atomic within TX)
        if (data.attributes !== undefined) {
            await tx.delete(categoryAttributes).where(and(
                eq(categoryAttributes.category_id, id),
                eq(categoryAttributes.company_id, companyId)
            ));
            if (data.attributes.length > 0) {
                await tx.insert(categoryAttributes).values(
                    data.attributes.map(a => ({
                        company_id: companyId,
                        category_id: id,
                        attribute_def_id: a.attributeDefId,
                        required: a.required ?? false,
                        order: a.order ?? 0,
                        specific_options: (a.specificOptions as string[] | null) ?? null,
                    }))
                );
            }
        }

        return row;
    });

    await cacheService.invalidate(`categories:c${companyId}:*`);
    broadcast(RealtimeEvents.ENTITY.UPDATED, { type: 'category', id: updated.id, entity: updated, clientId }, RealtimeEvents.ROOMS.CATEGORIES);
    return {
        ...updated,
        attributeCount: data.attributes?.length ?? 0,
        is_active: updated.is_active ?? true,
    };
}

export async function deactivateCategory(id: number, companyId: number, clientId?: string, audit?: AuditContext): Promise<CategoryNode> {
    return withAuditTransaction(audit, async (tx) => {
        const [existing] = await tx.select().from(categories)
            .where(and(eq(categories.id, id), eq(categories.company_id, companyId)));
        if (!existing) throw new DomainError('Categoría no encontrada', 404);

        // Cascade: deactivate this node + all descendants via ltree
        await tx.execute(sql`
            UPDATE categories
            SET is_active = false
            WHERE company_id = ${companyId}
              AND path <@ ${existing.path}::ltree
        `);

        const [updated] = await tx.select().from(categories)
            .where(and(eq(categories.id, id), eq(categories.company_id, companyId)));

        await cacheService.invalidate(`categories:c${companyId}:*`);
        broadcast(RealtimeEvents.ENTITY.UPDATED, { type: 'category', id: updated.id, entity: updated, clientId }, RealtimeEvents.ROOMS.CATEGORIES);
        return {
            ...updated,
            attributeCount: 0,
            is_active: false,
        };
    });
}

export async function restoreCategory(id: number, companyId: number, clientId?: string, audit?: AuditContext): Promise<CategoryNode> {
    return withAuditTransaction(audit, async (tx) => {
        const [existing] = await tx.select().from(categories)
            .where(and(eq(categories.id, id), eq(categories.company_id, companyId)));
        if (!existing) throw new DomainError('Categoría no encontrada', 404);

        const [updated] = await tx.update(categories).set({ is_active: true })
            .where(and(eq(categories.id, id), eq(categories.company_id, companyId))).returning();

        await cacheService.invalidate(`categories:c${companyId}:*`);
        broadcast(RealtimeEvents.ENTITY.UPDATED, { type: 'category', id: updated.id, entity: updated, clientId }, RealtimeEvents.ROOMS.CATEGORIES);
        return {
            ...updated,
            attributeCount: 0,
            is_active: true,
        };
    });
}

// =============================================================================
// Reorder Categories (Bulk sort_order update)
// =============================================================================

export async function reorderCategories(items: CategoryReorderItem[], companyId: number, clientId?: string): Promise<{ updated: number }> {
    if (items.length === 0) return { updated: 0 };

    await db.transaction(async (tx) => {
        for (const item of items) {
            await tx.update(categories)
                .set({ sort_order: item.sort_order })
                .where(and(eq(categories.id, item.id), eq(categories.company_id, companyId)));
        }
    });

    await cacheService.invalidate(`categories:c${companyId}:*`);
    broadcast(RealtimeEvents.ENTITY.UPDATED, { type: 'category', clientId }, RealtimeEvents.ROOMS.CATEGORIES);
    return { updated: items.length };
}

// =============================================================================
// Reparent — Dedicated DnD endpoint
// =============================================================================

export async function reparentCategory(id: number, newParentId: number | null, companyId: number, clientId?: string): Promise<CategoryNode> {
    const [node] = await db.select().from(categories)
        .where(and(eq(categories.id, id), eq(categories.company_id, companyId)));
    if (!node) throw new DomainError('Categoría no encontrada', 404);

    // Skip if same parent
    if (node.parent_id === newParentId) {
        return { ...node, attributeCount: 0, is_active: node.is_active ?? true };
    }

    let newParentPath: string | null = null;
    let newDepth = 0;

    if (newParentId !== null) {
        const [newParent] = await db.select().from(categories)
            .where(and(eq(categories.id, newParentId), eq(categories.company_id, companyId)));
        if (!newParent) throw new DomainError('Categoría padre no encontrada', 404);

        // Anti-circular: check the new parent is NOT a descendant of this node
        const isDescendant = newParent.path.startsWith(node.path + '.');
        if (isDescendant || newParentId === id) {
            throw new DomainError('Acción inválida: no puedes mover una categoría dentro de sus propios descendientes', 400);
        }

        newParentPath = newParent.path;
        newDepth = newParent.depth + 1;
    }

    const oldPath = node.path;
    const newPath = newParentPath ? `${newParentPath}.${slugifyPath(node.name)}` : slugifyPath(node.name);
    const depthDiff = newDepth - node.depth;

    // Update this node
    const [updated] = await db.update(categories).set({
        parent_id: newParentId,
        path: newPath,
        depth: newDepth,
    }).where(and(eq(categories.id, id), eq(categories.company_id, companyId))).returning();

    // Cascade to all descendants: update path prefix + adjust depth
    await db.execute(sql`
        UPDATE categories
        SET path = (${newPath} || substr(path::text, ${oldPath.length + 1}))::ltree,
            depth = depth + ${depthDiff}
        WHERE company_id = ${companyId}
          AND path <@ ${oldPath}::ltree
          AND id != ${id}
    `);

    await cacheService.invalidate(`categories:c${companyId}:*`);
    broadcast(RealtimeEvents.ENTITY.UPDATED, { type: 'category', id: updated.id, entity: updated, clientId }, RealtimeEvents.ROOMS.CATEGORIES);
    return {
        ...updated,
        attributeCount: 0,
        is_active: updated.is_active ?? true,
    };
}

// =============================================================================
// Check References — for hard delete validation
// =============================================================================

export async function checkCategoryReferences(id: number, companyId: number): Promise<CategoryReferences> {
    const [existing] = await db.select({ id: categories.id }).from(categories)
        .where(and(eq(categories.id, id), eq(categories.company_id, companyId)));
    if (!existing) throw new DomainError('Categoría no encontrada', 404);

    const [productCountRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(products)
        .where(and(
            eq(products.category_id, id),
            eq(products.company_id, companyId)
        ));

    const productCount = productCountRow?.count ?? 0;

    return {
        products: productCount,
        total: productCount,
    };
}

// =============================================================================
// Hard Delete — permanent removal
// =============================================================================

export async function hardDeleteCategory(id: number, companyId: number, clientId?: string): Promise<{ success: true }> {
    const [existing] = await db.select().from(categories)
        .where(and(eq(categories.id, id), eq(categories.company_id, companyId)));
    if (!existing) throw new DomainError('Categoría no encontrada', 404);

    const refs = await checkCategoryReferences(id, companyId);
    if (refs.total > 0) throw new DomainError('No se puede eliminar: la categoría tiene productos vinculados', 409);

    // Check for children
    const children = await db.select({ id: categories.id }).from(categories)
        .where(and(eq(categories.parent_id, id), eq(categories.company_id, companyId)));
    if (children.length > 0) throw new DomainError('No se puede eliminar: la categoría tiene subcategorías', 409);

    // Delete associated attributes first
    await db.delete(categoryAttributes).where(and(
        eq(categoryAttributes.category_id, id),
        eq(categoryAttributes.company_id, companyId)
    ));
    // Delete the category
    await db.delete(categories).where(and(
        eq(categories.id, id),
        eq(categories.company_id, companyId)
    ));

    await cacheService.invalidate(`categories:c${companyId}:*`);
    broadcast(RealtimeEvents.ENTITY.DELETED, { type: 'category', id, clientId }, RealtimeEvents.ROOMS.CATEGORIES);
    return { success: true };
}

// =============================================================================
// Bulk Deactivate
// =============================================================================

export async function bulkDeactivateCategories(ids: number[], companyId: number, audit?: AuditContext) {
    if (ids.length === 0) return { success: true, count: 0 };

    return withAuditTransaction(audit, async (tx) => {
        const existing = await tx
            .select({ id: categories.id, path: categories.path })
            .from(categories)
            .where(and(
                eq(categories.company_id, companyId),
                eq(categories.is_active, true),
                inArray(categories.id, ids)
            ));

        if (existing.length === 0) {
            throw new DomainError('No se encontraron categorías válidas para desactivar', 404);
        }

        // Cascade deactivation to each node + its descendants
        for (const cat of existing) {
            await tx.execute(sql`
                UPDATE categories
                SET is_active = false
                WHERE company_id = ${companyId}
                  AND path <@ ${cat.path}::ltree
            `);
        }

        await cacheService.invalidate(`categories:c${companyId}:*`);

        // Broadcast for each item so frontend cache updates correctly
        for (const cat of existing) {
            broadcast(
                RealtimeEvents.ENTITY.UPDATED,
                { type: 'category', id: cat.id, entity: { is_active: false }, clientId: audit?.clientId },
                RealtimeEvents.ROOMS.CATEGORIES
            );
        }

        return { success: true, count: existing.length, deactivatedIds: existing.map(c => c.id) };
    });
}

// =============================================================================
// Bulk Restore
// =============================================================================

export async function bulkRestoreCategories(ids: number[], companyId: number, audit?: AuditContext) {
    if (ids.length === 0) return { success: true, count: 0 };

    return withAuditTransaction(audit, async (tx) => {
        const existing = await tx
            .select({ id: categories.id })
            .from(categories)
            .where(and(
                eq(categories.company_id, companyId),
                eq(categories.is_active, false),
                inArray(categories.id, ids)
            )) as Array<{ id: number; }>;

        if (existing.length === 0) {
            throw new DomainError('No se encontraron categorías válidas para restaurar', 404);
        }

        const existingIds = existing.map(c => c.id);
        await tx.update(categories)
            .set({ is_active: true })
            .where(and(
                eq(categories.company_id, companyId),
                inArray(categories.id, existingIds)
            ));

        await cacheService.invalidate(`categories:c${companyId}:*`);
        for (const cat of existing) {
            broadcast(
                RealtimeEvents.ENTITY.UPDATED,
                { type: 'category', id: cat.id, entity: { is_active: true }, clientId: audit?.clientId },
                RealtimeEvents.ROOMS.CATEGORIES
            );
        }

        return { success: true, count: existingIds.length, restoredIds: existingIds };
    });
}