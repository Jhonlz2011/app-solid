import { sql, ilike, or, eq, and } from '@app/schema';
import { db, referenceDb } from '../../core/db';
import { taxonomyCategories, taxonomyAttributes, taxonomyAttributeValues, taxonomyCategoryAttributes, categories } from '@app/schema/tables';
import { DomainError } from '../../core/errors';
import { cacheService } from '../../core/cache';

function slugify(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        || 'cat';
}

export const taxonomyService = {
    /**
     * Búsqueda instantánea de categorías en el diccionario global de referenceDb
     */
    async searchCategories(query: string, limit = 15) {
        const clean = query.trim();
        if (!clean) return [];

        const pattern = `%${clean}%`;
        return await referenceDb
            .select({
                id: taxonomyCategories.id,
                code: taxonomyCategories.code,
                name: taxonomyCategories.name,
                fullPath: taxonomyCategories.full_path,
                depth: taxonomyCategories.depth,
            })
            .from(taxonomyCategories)
            .where(or(
                ilike(taxonomyCategories.full_path, pattern),
                ilike(taxonomyCategories.name, pattern)
            ))
            .limit(limit);
    },

    /**
     * Obtiene los metacampos sugeridos y sus valores canónicos para una categoría
     */
    async getCategoryAttributes(categoryId: number) {
        const attrs = await referenceDb
            .select({
                id: taxonomyAttributes.id,
                name: taxonomyAttributes.name,
                handle: taxonomyAttributes.handle,
                dataType: taxonomyAttributes.data_type,
            })
            .from(taxonomyCategoryAttributes)
            .innerJoin(taxonomyAttributes, sql`${taxonomyCategoryAttributes.attribute_id} = ${taxonomyAttributes.id}`)
            .where(sql`${taxonomyCategoryAttributes.category_id} = ${categoryId}`);

        // Cargar valores canónicos para los atributos (colores con hex, etc.)
        const attributesWithValues = await Promise.all(attrs.map(async (attr) => {
            const values = await referenceDb
                .select({
                    id: taxonomyAttributeValues.id,
                    name: taxonomyAttributeValues.name,
                    handle: taxonomyAttributeValues.handle,
                    metadata: taxonomyAttributeValues.metadata,
                })
                .from(taxonomyAttributeValues)
                .where(sql`${taxonomyAttributeValues.attribute_id} = ${attr.id}`)
                .limit(50);
            return {
                ...attr,
                values: values.map(v => ({
                    id: v.id,
                    name: v.name,
                    handle: v.handle,
                    metadata: v.metadata ?? null,
                })),
            };
        }));

        return attributesWithValues;
    },

    /**
     * Sincroniza o asegura que una categoría de la taxonomía estándar exista en la tabla categories del tenant
     */
    async ensureCategoryInTenant(taxonomyCategoryId: number, companyId: number) {
        const [taxCat] = await referenceDb
            .select()
            .from(taxonomyCategories)
            .where(eq(taxonomyCategories.id, taxonomyCategoryId));

        if (!taxCat) {
            throw new DomainError('Categoría de taxonomía no encontrada', 404);
        }

        // Verificar si ya existe una categoría con el mismo nombre en la empresa
        const [existing] = await db
            .select({ id: categories.id, name: categories.name })
            .from(categories)
            .where(and(eq(categories.company_id, companyId), eq(categories.name, taxCat.name)));

        if (existing) {
            return {
                id: existing.id,
                name: existing.name,
                fullPath: taxCat.full_path,
                taxonomyCategoryId: taxCat.id,
            };
        }

        const segment = slugify(taxCat.name);
        const [created] = await db
            .insert(categories)
            .values({
                company_id: companyId,
                name: taxCat.name,
                description: taxCat.full_path,
                path: segment,
                depth: 0,
                sort_order: 0,
                is_active: true,
            })
            .returning({ id: categories.id, name: categories.name });

        await cacheService.invalidate(`categories:c${companyId}:*`);

        return {
            id: created.id,
            name: created.name,
            fullPath: taxCat.full_path,
            taxonomyCategoryId: taxCat.id,
        };
    }
};

