import { eq, asc } from '@app/schema';
import { db } from '../db';
import { brands, productFamilies, categories, categoryAttributes, attributeDefinitions } from '@app/schema/tables';
import { DomainError } from './errors';
import { cacheService } from './cache.service';
import { broadcast } from '../plugins/sse';

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


// NOTE: UOM CRUD has been migrated to uom.service.ts (tenant-aware, integer PK)
export interface CategoryPayload {
    name: string;
    parentId?: number | null;
    description?: string | null;
    icon?: string | null;
    nameTemplate?: string | null;
    sortOrder?: number;
    attributes?: Array<{
        attributeDefId: number;
        required?: boolean;
        order?: number;
        specificOptions?: any;
    }>;
}

// =============================================================================
// CATEGORIES — Enhanced CRUD with attribute sync
// =============================================================================

export async function listCategoriesEnhanced(flat = false) {
    return cacheService.getOrSet(`categories:enhanced:${flat}`, async () => {
        const allCategories = await db.select().from(categories).orderBy(asc(categories.sort_order), asc(categories.name));
        const allCatAttrs = await db
            .select({
                categoryId: categoryAttributes.category_id,
                attributeDefId: categoryAttributes.attribute_def_id,
                required: categoryAttributes.required,
                order: categoryAttributes.order,
            })
            .from(categoryAttributes);

        // Build a map of category_id → attribute count
        const attrCountMap = new Map<number, number>();
        allCatAttrs.forEach(ca => {
            attrCountMap.set(ca.categoryId, (attrCountMap.get(ca.categoryId) ?? 0) + 1);
        });

        const enriched = allCategories.map(cat => ({
            ...cat,
            attributeCount: attrCountMap.get(cat.id) ?? 0,
        }));

        if (flat) return enriched;

        // Build tree
        const map = new Map<number, any>();
        const roots: any[] = [];
        enriched.forEach(cat => map.set(cat.id, { ...cat, children: [] }));
        enriched.forEach(cat => {
            const node = map.get(cat.id)!;
            if (cat.parent_id) {
                const parent = map.get(cat.parent_id);
                if (parent) parent.children.push(node);
            } else {
                roots.push(node);
            }
        });

        return roots;
    }, 600);
}

export async function getCategoryEnhanced(id: number) {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    if (!category) throw new DomainError('Categoría no encontrada', 404);

    // Get attributes with their definitions
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
        .innerJoin(attributeDefinitions, eq(attributeDefinitions.id, categoryAttributes.attribute_def_id))
        .where(eq(categoryAttributes.category_id, id))
        .orderBy(asc(categoryAttributes.order));

    return { ...category, attributes: attrs };
}

/**
 * form-schema endpoint: Returns only what the product form needs
 * (attributes + name_template) for a given category
 */
export async function getCategoryFormSchema(id: number) {
    const [category] = await db
        .select({
            id: categories.id,
            name: categories.name,
            nameTemplate: categories.name_template,
        })
        .from(categories)
        .where(eq(categories.id, id));

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
        .innerJoin(attributeDefinitions, eq(attributeDefinitions.id, categoryAttributes.attribute_def_id))
        .where(eq(categoryAttributes.category_id, id))
        .orderBy(asc(categoryAttributes.order));

    // Merge options: specificOptions override defaultOptions
    const attributes = attrs.map(a => ({
        id: a.id,
        key: a.key,
        label: a.label,
        type: a.type,
        required: a.required,
        order: a.order,
        options: (a.specificOptions as any[] | null) ?? (a.defaultOptions as any[] | null) ?? [],
    }));

    return { category, attributes };
}

export async function createCategoryEnhanced(data: CategoryPayload) {
    const { path, depth } = await computePathAndDepth(data.parentId ?? null, data.name);

    const [created] = await db.insert(categories).values({
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
        await db.insert(categoryAttributes).values(
            data.attributes.map(a => ({
                category_id: created.id,
                attribute_def_id: a.attributeDefId,
                required: a.required ?? false,
                order: a.order ?? 0,
                specific_options: a.specificOptions ?? null,
            }))
        );
    }

    cacheService.invalidate('categories:*');
    broadcast('category:created', created, 'categories');
    return created;
}

export async function updateCategoryEnhanced(id: number, data: Partial<CategoryPayload>) {
    const updateValues: Record<string, any> = {};
    if (data.name !== undefined) updateValues.name = data.name;
    if (data.parentId !== undefined) updateValues.parent_id = data.parentId;
    if (data.description !== undefined) updateValues.description = data.description;
    if (data.icon !== undefined) updateValues.icon = data.icon;
    if (data.nameTemplate !== undefined) updateValues.name_template = data.nameTemplate;
    if (data.sortOrder !== undefined) updateValues.sort_order = data.sortOrder;

    const [updated] = await db.update(categories)
        .set(updateValues)
        .where(eq(categories.id, id))
        .returning();

    if (!updated) throw new DomainError('Categoría no encontrada', 404);

    // Recalculate path/depth if name or parentId changed
    if (data.name !== undefined || data.parentId !== undefined) {
        const newName = data.name ?? updated.name;
        const newParentId = data.parentId !== undefined ? data.parentId : updated.parent_id;
        const { path, depth } = await computePathAndDepth(newParentId ?? null, newName);
        await db.update(categories)
            .set({ path, depth })
            .where(eq(categories.id, id));
    }

    // Sync attributes (DELETE ALL + INSERT ALL)
    if (data.attributes !== undefined) {
        await db.delete(categoryAttributes).where(eq(categoryAttributes.category_id, id));
        if (data.attributes.length > 0) {
            await db.insert(categoryAttributes).values(
                data.attributes.map(a => ({
                    category_id: id,
                    attribute_def_id: a.attributeDefId,
                    required: a.required ?? false,
                    order: a.order ?? 0,
                    specific_options: a.specificOptions ?? null,
                }))
            );
        }
    }

    cacheService.invalidate('categories:*');
    broadcast('category:updated', updated, 'categories');
    return updated;
}

export async function deactivateCategory(id: number) {
    // Check for children
    const children = await db.select({ id: categories.id }).from(categories).where(eq(categories.parent_id, id));
    if (children.length) {
        throw new DomainError('No se puede desactivar categoría con subcategorías activas', 400);
    }

    const [updated] = await db.update(categories)
        .set({ is_active: false })
        .where(eq(categories.id, id))
        .returning();
    if (!updated) throw new DomainError('Categoría no encontrada', 404);
    cacheService.invalidate('categories:*');
    broadcast('category:updated', updated, 'categories');
    return updated;
}

export async function restoreCategory(id: number) {
    const [updated] = await db.update(categories)
        .set({ is_active: true })
        .where(eq(categories.id, id))
        .returning();
    if (!updated) throw new DomainError('Categoría no encontrada', 404);
    cacheService.invalidate('categories:*');
    broadcast('category:updated', updated, 'categories');
    return updated;
}

// =============================================================================
// Reorder Categories (Bulk sort_order update)
// =============================================================================

export async function reorderCategories(items: Array<{ id: number; sort_order: number }>) {
    if (items.length === 0) return { updated: 0 };

    await db.transaction(async (tx) => {
        for (const item of items) {
            await tx.update(categories)
                .set({ sort_order: item.sort_order })
                .where(eq(categories.id, item.id));
        }
    });

    cacheService.invalidate('categories:*');
    broadcast('categories:reordered', { count: items.length }, 'categories');
    return { updated: items.length };
}








// =============================================================================
// BRANDS
// =============================================================================



export async function listBrands() {
    return cacheService.getOrSet('catalogs:brands', async () => {
        return db.select().from(brands).orderBy(asc(brands.name));
    }, 3600);
}

export async function createBrand(data: { name: string; website?: string }) {
    const [created] = await db.insert(brands).values(data).returning();
    cacheService.invalidate('catalogs:brands');
    broadcast('catalog:brand:created', created, 'catalogs');
    return created;
}

export async function updateBrand(id: number, data: Partial<{ name: string; website: string; is_active: boolean }>) {
    const [updated] = await db.update(brands).set(data).where(eq(brands.id, id)).returning();
    if (!updated) throw new DomainError('Marca no encontrada', 404);
    cacheService.invalidate('catalogs:brands');
    broadcast('catalog:brand:updated', updated, 'catalogs');
    return updated;
}

export async function deactivateBrand(id: number) {
    const [updated] = await db.update(brands).set({ is_active: false }).where(eq(brands.id, id)).returning();
    if (!updated) throw new DomainError('Marca no encontrada', 404);
    cacheService.invalidate('catalogs:brands');
    return updated;
}

export async function restoreBrand(id: number) {
    const [updated] = await db.update(brands).set({ is_active: true }).where(eq(brands.id, id)).returning();
    if (!updated) throw new DomainError('Marca no encontrada', 404);
    cacheService.invalidate('catalogs:brands');
    return updated;
}

// =============================================================================
// PRODUCT FAMILIES
// =============================================================================

export async function listFamilies() {
    return cacheService.getOrSet('catalogs:families', async () => {
        const rows = await db
            .select({
                id: productFamilies.id,
                name: productFamilies.name,
                category_id: productFamilies.category_id,
                categoryName: categories.name,
                description: productFamilies.description,
                is_active: productFamilies.is_active,
            })
            .from(productFamilies)
            .leftJoin(categories, eq(categories.id, productFamilies.category_id))
            .orderBy(asc(productFamilies.name));
        return rows;
    }, 3600);
}

export async function createFamily(data: { name: string; categoryId?: number; description?: string }) {
    const [created] = await db.insert(productFamilies).values({
        name: data.name,
        category_id: data.categoryId ?? null,
        description: data.description ?? null,
    }).returning();
    cacheService.invalidate('catalogs:families');
    broadcast('catalog:family:created', created, 'catalogs');
    return created;
}

export async function updateFamily(id: number, data: Partial<{ name: string; categoryId: number | null; description: string | null; is_active: boolean }>) {
    const updateValues: Record<string, any> = {};
    if (data.name !== undefined) updateValues.name = data.name;
    if (data.categoryId !== undefined) updateValues.category_id = data.categoryId;
    if (data.description !== undefined) updateValues.description = data.description;
    if (data.is_active !== undefined) updateValues.is_active = data.is_active;

    const [updated] = await db.update(productFamilies).set(updateValues).where(eq(productFamilies.id, id)).returning();
    if (!updated) throw new DomainError('Familia no encontrada', 404);
    cacheService.invalidate('catalogs:families');
    broadcast('catalog:family:updated', updated, 'catalogs');
    return updated;
}

export async function deactivateFamily(id: number) {
    const [updated] = await db.update(productFamilies).set({ is_active: false }).where(eq(productFamilies.id, id)).returning();
    if (!updated) throw new DomainError('Familia no encontrada', 404);
    cacheService.invalidate('catalogs:families');
    return updated;
}

export async function restoreFamily(id: number) {
    const [updated] = await db.update(productFamilies).set({ is_active: true }).where(eq(productFamilies.id, id)).returning();
    if (!updated) throw new DomainError('Familia no encontrada', 404);
    cacheService.invalidate('catalogs:families');
    return updated;
}