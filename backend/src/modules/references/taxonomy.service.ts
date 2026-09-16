import { sql, ilike, or } from '@app/schema';
import { referenceDb } from '../../core/db';
import { taxonomyCategories, taxonomyAttributes, taxonomyAttributeValues, taxonomyCategoryAttributes } from '@app/schema/tables';

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
    }
};
