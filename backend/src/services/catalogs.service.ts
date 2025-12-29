import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import { uom, brands, attributeDefinitions, categories, categoryAttributes } from '../schema';
import { DomainError } from './errors';
import { cacheService } from './cache.service';
import { broadcast } from '../plugins/ws';

// ====== UOM (Units of Measure) ======

export async function listUom() {
    return cacheService.getOrSet('catalogs:uom', async () => {
        return db.select().from(uom);
    }, 3600);
}

export async function createUom(data: { code: string; name: string }) {
    const existing = await db.select().from(uom).where(eq(uom.code, data.code));
    if (existing.length) {
        throw new DomainError('El código de unidad ya existe', 409);
    }

    const [created] = await db.insert(uom).values(data).returning();
    cacheService.invalidate('catalogs:uom');
    broadcast('catalog:uom:created', created, 'catalogs');
    return created;
}

// ====== BRANDS ======

export async function listBrands() {
    return cacheService.getOrSet('catalogs:brands', async () => {
        return db.select().from(brands);
    }, 3600);
}

export async function createBrand(data: { name: string; website?: string }) {
    const [created] = await db.insert(brands).values(data).returning();
    cacheService.invalidate('catalogs:brands');
    broadcast('catalog:brand:created', created, 'catalogs');
    return created;
}

export async function updateBrand(id: number, data: Partial<{ name: string; website: string }>) {
    const [updated] = await db.update(brands).set(data).where(eq(brands.id, id)).returning();
    if (!updated) throw new DomainError('Marca no encontrada', 404);
    cacheService.invalidate('catalogs:brands');
    return updated;
}

export async function deleteBrand(id: number) {
    await db.delete(brands).where(eq(brands.id, id));
    cacheService.invalidate('catalogs:brands');
    return { success: true };
}

// ====== ATTRIBUTE DEFINITIONS ======

export async function listAttributeDefinitions() {
    return cacheService.getOrSet('catalogs:attributes', async () => {
        return db.select().from(attributeDefinitions);
    }, 3600);
}

export async function createAttributeDefinition(data: {
    key: string;
    label: string;
    type: string;
    defaultOptions?: any;
}) {
    const [created] = await db.insert(attributeDefinitions).values({
        key: data.key,
        label: data.label,
        type: data.type,
        default_options: data.defaultOptions,
    }).returning();
    cacheService.invalidate('catalogs:attributes');
    broadcast('catalog:attribute:created', created, 'catalogs');
    return created;
}

// ====== CATEGORIES ======

interface CategoryPayload {
    name: string;
    parentId?: number;
    nameTemplate?: string;
}

export async function listCategories(flat = false) {
    return cacheService.getOrSet(`categories:list:${flat}`, async () => {
        const all = await db.select().from(categories);

        if (flat) return all;

        // Build tree structure
        const map = new Map<number, any>();
        const roots: any[] = [];

        all.forEach((cat) => {
            map.set(cat.id, { ...cat, children: [] });
        });

        all.forEach((cat) => {
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

export async function getCategory(id: number) {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    if (!category) throw new DomainError('Categoría no encontrada', 404);

    // Get attributes linked to this category
    const attrs = await db
        .select({
            id: categoryAttributes.id,
            attributeDefId: categoryAttributes.attribute_def_id,
            required: categoryAttributes.required,
            order: categoryAttributes.order,
            specificOptions: categoryAttributes.specific_options,
        })
        .from(categoryAttributes)
        .where(eq(categoryAttributes.category_id, id));

    return { ...category, attributes: attrs };
}

export async function createCategory(data: CategoryPayload) {
    const [created] = await db.insert(categories).values({
        name: data.name,
        parent_id: data.parentId,
        name_template: data.nameTemplate,
    }).returning();

    cacheService.invalidate('categories:*');
    broadcast('category:created', created, 'categories');
    return created;
}

export async function updateCategory(id: number, data: Partial<CategoryPayload>) {
    const [updated] = await db.update(categories).set({
        name: data.name,
        parent_id: data.parentId,
        name_template: data.nameTemplate,
    }).where(eq(categories.id, id)).returning();

    if (!updated) throw new DomainError('Categoría no encontrada', 404);
    cacheService.invalidate('categories:*');
    broadcast('category:updated', updated, 'categories');
    return updated;
}

export async function deleteCategory(id: number) {
    // Check for children
    const children = await db.select({ id: categories.id }).from(categories).where(eq(categories.parent_id, id));
    if (children.length) {
        throw new DomainError('No se puede eliminar categoría con subcategorías', 400);
    }

    await db.delete(categories).where(eq(categories.id, id));
    cacheService.invalidate('categories:*');
    broadcast('category:deleted', { id }, 'categories');
    return { success: true };
}

export async function addCategoryAttribute(categoryId: number, data: {
    attributeDefId: number;
    required?: boolean;
    order?: number;
    specificOptions?: any;
}) {
    const [created] = await db.insert(categoryAttributes).values({
        category_id: categoryId,
        attribute_def_id: data.attributeDefId,
        required: data.required ?? false,
        order: data.order ?? 0,
        specific_options: data.specificOptions,
    }).returning();

    cacheService.invalidate('categories:*');
    return created;
}
