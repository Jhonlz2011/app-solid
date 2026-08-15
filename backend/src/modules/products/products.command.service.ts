import { and, eq, sql, inArray } from '@app/schema';
import { db, type Tx } from '../../core/db';
import { products, productVariants, productComponents } from '@app/schema/tables';
import { DomainError } from '../../core/errors';
import { cacheService } from '../../core/cache';
import { broadcast } from '../../core/sse/sse';
import type { ProductPayload } from '@app/schema/backend';
import { publicStorageService } from '../../services/public-storage.service';
import { checkProductReferences } from './products.query.service';

// =============================================================================
// Validation & Error Helpers
// =============================================================================

function extractSkuFromDetail(detail?: string): string {
    if (!detail) return '(desconocido)';
    const match = detail.match(/\(company_id, sku\)=\(\d+, (.+?)\)/);
    return match?.[1] ?? detail;
}

export function validateProductPayload(payload: ProductPayload, productId?: number) {
    if (!payload.variants?.length) {
        throw new DomainError('El producto debe tener al menos una variante', 400);
    }
    const defaultCount = payload.variants.filter(v => v.is_default).length;
    if (defaultCount !== 1) {
        throw new DomainError('Debe haber exactamente una variante marcada como predeterminada', 400);
    }
    if (payload.product_type === 'SERVICIO' && payload.product_subtype != null) {
        throw new DomainError('Un servicio no puede tener subtipo de producto', 400);
    }
    if (payload.product_type === 'PRODUCTO' && !payload.product_subtype) {
        throw new DomainError('Un producto debe tener subtipo (SIMPLE, COMPUESTO o FABRICADO)', 400);
    }
    if (payload.components?.length && !['COMPUESTO', 'FABRICADO'].includes(payload.product_subtype ?? '')) {
        throw new DomainError('Solo productos COMPUESTO o FABRICADO pueden tener componentes', 400);
    }
    if (productId && payload.components?.some(c => c.component_product_id === productId)) {
        throw new DomainError('Un producto no puede contenerse a sí mismo como componente', 400);
    }
}

async function checkVariantReferences(tx: Tx, variantId: number): Promise<boolean> {
    const [result] = await tx
        .select({
            hasRefs: sql<boolean>`EXISTS(
                SELECT 1 FROM inventory_stock WHERE variant_id = ${variantId}
                UNION ALL SELECT 1 FROM inventory_movements WHERE variant_id = ${variantId}
                UNION ALL SELECT 1 FROM inventory_dimensional_items WHERE variant_id = ${variantId}
                UNION ALL SELECT 1 FROM purchase_order_items WHERE variant_id = ${variantId}
                UNION ALL SELECT 1 FROM invoice_items WHERE variant_id = ${variantId}
                UNION ALL SELECT 1 FROM manufacturing_orders WHERE output_variant_id = ${variantId}
                UNION ALL SELECT 1 FROM manufacturing_order_inputs WHERE variant_id = ${variantId}
                UNION ALL SELECT 1 FROM manufacturing_log WHERE variant_id = ${variantId}
                UNION ALL SELECT 1 FROM supplier_products WHERE variant_id = ${variantId}
                UNION ALL SELECT 1 FROM goods_receipt_items WHERE variant_id = ${variantId}
                UNION ALL SELECT 1 FROM material_request_items WHERE variant_id = ${variantId}
                UNION ALL SELECT 1 FROM material_request_dispatches WHERE variant_id = ${variantId}
                UNION ALL SELECT 1 FROM request_return_items WHERE variant_id = ${variantId}
            )`,
        })
        .from(sql`(SELECT 1) as dummy`);
    return result.hasRefs;
}

// =============================================================================
// Create Product
// =============================================================================

export async function createProduct(payload: ProductPayload, userId: number, companyId: number) {
    validateProductPayload(payload);

    const existing = await db
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.company_id, companyId), eq(products.slug, payload.slug)));

    if (existing.length) {
        throw new DomainError('El slug ya está registrado', 409);
    }

    return db.transaction(async (tx: Tx) => {
        try {
            const { variants, image_urls, components, ...productData } = payload;

            const [created] = await tx
                .insert(products)
                .values({
                    company_id: companyId,
                    product_type: productData.product_type,
                    product_subtype: productData.product_subtype ?? null,
                    category_id: productData.category_id,
                    brand_id: productData.brand_id ?? null,
                    slug: productData.slug,
                    name: productData.name,
                    description: productData.description ?? null,
                    shared_attributes: productData.shared_attributes ?? {},
                    image_urls: image_urls ?? [],
                    uom_inventory_id: productData.uom_inventory_id,
                    has_dimensional_tracking: productData.has_dimensional_tracking,
                    min_stock_alert: productData.min_stock_alert?.toString() ?? '0',
                    default_base_price: productData.default_base_price.toString(),
                    iva_rate_code: productData.iva_rate_code,
                    is_active: productData.is_active,
                    created_by: userId,
                    updated_by: userId,
                })
                .returning();

            if (variants && variants.length > 0) {
                await tx.insert(productVariants).values(
                    variants.map((v, idx) => ({
                        company_id: companyId,
                        product_id: created.id,
                        sku: v.sku,
                        variant_name: v.variant_name ?? null,
                        variant_attributes: v.variant_attributes ?? {},
                        content_quantity: v.content_quantity.toString(),
                        sale_uom_id: v.sale_uom_id ?? null,
                        base_price: v.base_price?.toString() ?? null,
                        last_cost: v.last_cost?.toString() ?? '0',
                        barcode: v.barcode ?? null,
                        image_urls: v.image_urls ?? null,
                        std_length_cm: v.std_length_cm?.toString() ?? null,
                        std_width_cm: v.std_width_cm?.toString() ?? null,
                        is_default: v.is_default,
                        is_active: v.is_active,
                        sort_order: v.sort_order ?? idx,
                    }))
                );
            }

            if (components && components.length > 0) {
                if (components.some(c => c.component_product_id === created.id)) {
                    throw new DomainError('Un producto no puede contenerse a sí mismo como componente', 400);
                }
                await tx.insert(productComponents).values(
                    components.map(c => ({
                        company_id: companyId,
                        parent_product_id: created.id,
                        component_product_id: c.component_product_id,
                        quantity_per_parent: c.quantity_per_parent.toString(),
                        is_reversible: c.is_reversible ?? true,
                        notes: c.notes ?? null,
                    }))
                );
            }

            cacheService.invalidate(`products:c${companyId}:*`);
            broadcast('product:created', created, 'products');

            return created;
        } catch (err: any) {
            if (err.code === '23505') {
                if (err.constraint === 'unq_product_slug_company')
                    throw new DomainError('El slug ya está registrado para esta empresa', 409);
                if (err.constraint === 'unq_variant_sku_company')
                    throw new DomainError(`SKU duplicado: ${extractSkuFromDetail(err.detail)}`, 409);
                if (err.constraint === 'unq_prod_component')
                    throw new DomainError('Componente duplicado en la lista de materiales', 409);
            }
            throw err;
        }
    });
}

// =============================================================================
// Update Product
// =============================================================================

export async function updateProduct(productId: number, payload: Partial<ProductPayload>, userId: number, companyId: number) {
    if (payload.variants !== undefined && payload.product_type !== undefined) {
        validateProductPayload(payload as ProductPayload, productId);
    }

    return db.transaction(async (tx: Tx) => {
        try {
            const { variants, image_urls, components, ...productData } = payload;

            const updateValues: Partial<typeof products.$inferInsert> = {
                updated_at: new Date(),
                updated_by: userId,
            };

            if (productData.product_type !== undefined) updateValues.product_type = productData.product_type;
            if (productData.product_subtype !== undefined) updateValues.product_subtype = productData.product_subtype;
            if (productData.category_id !== undefined) updateValues.category_id = productData.category_id;
            if (productData.brand_id !== undefined) updateValues.brand_id = productData.brand_id;
            if (productData.slug !== undefined) updateValues.slug = productData.slug;
            if (productData.name !== undefined) updateValues.name = productData.name;
            if (productData.description !== undefined) updateValues.description = productData.description;
            if (productData.shared_attributes !== undefined) updateValues.shared_attributes = productData.shared_attributes;
            if (image_urls !== undefined) updateValues.image_urls = image_urls;
            if (productData.uom_inventory_id !== undefined) updateValues.uom_inventory_id = productData.uom_inventory_id;
            if (productData.has_dimensional_tracking !== undefined) updateValues.has_dimensional_tracking = productData.has_dimensional_tracking;
            if (productData.min_stock_alert !== undefined) updateValues.min_stock_alert = productData.min_stock_alert?.toString();
            if (productData.default_base_price !== undefined) updateValues.default_base_price = productData.default_base_price.toString();
            if (productData.iva_rate_code !== undefined) updateValues.iva_rate_code = productData.iva_rate_code;
            if (productData.is_active !== undefined) updateValues.is_active = productData.is_active;

            const [currentProduct] = await tx
                .select({ image_urls: products.image_urls })
                .from(products)
                .where(eq(products.id, productId));
            const oldImageUrls = (currentProduct?.image_urls as string[] | null) ?? [];

            const [updated] = await tx
                .update(products)
                .set(updateValues)
                .where(and(eq(products.id, productId), eq(products.company_id, companyId)))
                .returning();

            if (!updated) throw new DomainError('Producto no encontrado', 404);

            if (variants !== undefined) {
                const existingVariants = await tx
                    .select({ id: productVariants.id })
                    .from(productVariants)
                    .where(and(
                        eq(productVariants.product_id, productId),
                        eq(productVariants.company_id, companyId)
                    ));

                const existingIds = new Set(existingVariants.map(v => v.id));
                const incomingIds = new Set(
                    variants.filter(v => v.id != null).map(v => v.id!)
                );

                const toDelete = [...existingIds].filter(id => !incomingIds.has(id));
                for (const variantId of toDelete) {
                    const hasRefs = await checkVariantReferences(tx, variantId);
                    if (hasRefs) {
                        await tx.update(productVariants)
                            .set({ is_active: false })
                            .where(eq(productVariants.id, variantId));
                    } else {
                        await tx.delete(productVariants)
                            .where(and(
                                eq(productVariants.id, variantId),
                                eq(productVariants.company_id, companyId)
                            ));
                    }
                }

                for (const v of variants) {
                    const values = {
                        company_id: companyId,
                        product_id: productId,
                        sku: v.sku,
                        variant_name: v.variant_name ?? null,
                        variant_attributes: v.variant_attributes ?? {},
                        content_quantity: v.content_quantity.toString(),
                        sale_uom_id: v.sale_uom_id ?? null,
                        base_price: v.base_price?.toString() ?? null,
                        last_cost: v.last_cost?.toString() ?? '0',
                        barcode: v.barcode ?? null,
                        image_urls: v.image_urls ?? null,
                        std_length_cm: v.std_length_cm?.toString() ?? null,
                        std_width_cm: v.std_width_cm?.toString() ?? null,
                        is_default: v.is_default,
                        is_active: v.is_active,
                        sort_order: v.sort_order ?? 0,
                    };

                    if (v.id != null && existingIds.has(v.id)) {
                        await tx.update(productVariants)
                            .set(values)
                            .where(eq(productVariants.id, v.id));
                    } else {
                        await tx.insert(productVariants).values(values);
                    }
                }
            }

            if (components !== undefined) {
                if (components.some(c => c.component_product_id === productId)) {
                    throw new DomainError('Un producto no puede contenerse a sí mismo como componente', 400);
                }

                await tx.delete(productComponents)
                    .where(and(
                        eq(productComponents.parent_product_id, productId),
                        eq(productComponents.company_id, companyId)
                    ));

                if (components.length > 0) {
                    await tx.insert(productComponents).values(
                        components.map(c => ({
                            company_id: companyId,
                            parent_product_id: productId,
                            component_product_id: c.component_product_id,
                            quantity_per_parent: c.quantity_per_parent.toString(),
                            is_reversible: c.is_reversible ?? true,
                            notes: c.notes ?? null,
                        }))
                    );
                }
            }

            cacheService.invalidate(`products:c${companyId}:*`);
            broadcast('product:updated', updated, 'products');

            if (image_urls !== undefined && oldImageUrls.length > 0) {
                const newUrls = new Set(image_urls ?? []);
                const removedUrls = oldImageUrls.filter(url => !newUrls.has(url));
                if (removedUrls.length > 0) {
                    Promise.allSettled(
                        removedUrls.map(url => publicStorageService.deleteObject(url))
                    ).catch(err => console.warn('[R2] Deferred image cleanup on update failed:', err));
                }
            }

            return updated;
        } catch (err: any) {
            if (err.code === '23505') {
                if (err.constraint === 'unq_product_slug_company')
                    throw new DomainError('El slug ya está registrado para esta empresa', 409);
                if (err.constraint === 'unq_variant_sku_company')
                    throw new DomainError(`SKU duplicado: ${extractSkuFromDetail(err.detail)}`, 409);
                if (err.constraint === 'unq_prod_component')
                    throw new DomainError('Componente duplicado en la lista de materiales', 409);
            }
            throw err;
        }
    });
}

// =============================================================================
// Deactivate / Restore / Hard Delete
// =============================================================================

export async function deactivateProduct(productId: number, userId: number, companyId: number) {
    return db.transaction(async (tx) => {
        const [updated] = await tx
            .update(products)
            .set({ is_active: false, updated_at: new Date(), updated_by: userId })
            .where(and(eq(products.id, productId), eq(products.company_id, companyId)))
            .returning();

        if (!updated) throw new DomainError('Producto no encontrado', 404);

        await tx.update(productVariants)
            .set({ is_active: false })
            .where(and(eq(productVariants.product_id, productId), eq(productVariants.company_id, companyId)));

        cacheService.invalidate(`products:c${companyId}:*`);
        broadcast('product:updated', { id: productId, is_active: false }, 'products');
        return { success: true };
    });
}

export async function restoreProduct(productId: number, userId: number, companyId: number) {
    return db.transaction(async (tx) => {
        const [updated] = await tx
            .update(products)
            .set({ is_active: true, updated_at: new Date(), updated_by: userId })
            .where(and(eq(products.id, productId), eq(products.company_id, companyId)))
            .returning();

        if (!updated) throw new DomainError('Producto no encontrado', 404);

        await tx.update(productVariants)
            .set({ is_active: true })
            .where(and(eq(productVariants.product_id, productId), eq(productVariants.company_id, companyId)));

        cacheService.invalidate(`products:c${companyId}:*`);
        broadcast('product:updated', { id: productId, is_active: true }, 'products');
        return { success: true };
    });
}

export async function hardDeleteProduct(productId: number, companyId: number) {
    const refs = await checkProductReferences(productId, companyId);
    if (!refs.canDelete) {
        const details: string[] = [];
        if (refs.inventoryStock > 0) details.push(`stock: ${refs.inventoryStock}`);
        if (refs.inventoryMovements > 0) details.push(`movimientos: ${refs.inventoryMovements}`);
        if (refs.purchaseOrderItems > 0) details.push(`órdenes de compra: ${refs.purchaseOrderItems}`);
        if (refs.invoiceItems > 0) details.push(`facturas: ${refs.invoiceItems}`);
        if (refs.workOrderItems > 0) details.push(`órdenes de trabajo: ${refs.workOrderItems}`);
        if (refs.manufacturingOrders > 0) details.push(`órdenes de manufactura: ${refs.manufacturingOrders}`);
        if (refs.supplierProducts > 0) details.push(`proveedores: ${refs.supplierProducts}`);
        if (refs.materialRequestItems > 0) details.push(`solicitudes: ${refs.materialRequestItems}`);
        throw new DomainError(
            `No se puede eliminar: el producto tiene ${refs.total} referencia(s) en el sistema (${details.join(', ')})`,
            409
        );
    }

    const productImages = await db
        .select({ image_urls: products.image_urls })
        .from(products)
        .where(and(eq(products.id, productId), eq(products.company_id, companyId)));
    
    const variantImages = await db
        .select({ image_urls: productVariants.image_urls })
        .from(productVariants)
        .where(eq(productVariants.product_id, productId));

    const [deleted] = await db
        .delete(products)
        .where(and(eq(products.id, productId), eq(products.company_id, companyId)))
        .returning();

    if (!deleted) throw new DomainError('Producto no encontrado', 404);

    const allUrls: string[] = [];
    if (productImages[0]?.image_urls) {
        allUrls.push(...(productImages[0].image_urls as string[]));
    }
    for (const v of variantImages) {
        if (v.image_urls && Array.isArray(v.image_urls)) {
            allUrls.push(...(v.image_urls as string[]));
        }
    }
    if (allUrls.length > 0) {
        Promise.allSettled(
            allUrls.map(url => publicStorageService.deleteObject(url))
        ).catch(err => console.warn('[R2] Deferred product image cleanup failed:', err));
    }

    cacheService.invalidate(`products:c${companyId}:*`);
    broadcast('product:deleted', { id: productId }, 'products');
    return { success: true };
}

// =============================================================================
// Bulk Operations
// =============================================================================

export async function bulkDeactivateProducts(ids: number[], userId: number, companyId: number) {
    await db.transaction(async (tx) => {
        await tx
            .update(products)
            .set({ is_active: false, updated_at: new Date(), updated_by: userId })
            .where(and(inArray(products.id, ids), eq(products.company_id, companyId)));

        await tx
            .update(productVariants)
            .set({ is_active: false })
            .where(and(inArray(productVariants.product_id, ids), eq(productVariants.company_id, companyId)));
    });

    cacheService.invalidate(`products:c${companyId}:*`);
    broadcast('product:updated', { ids, is_active: false }, 'products');
    return { affected: ids.length };
}

export async function bulkRestoreProducts(ids: number[], userId: number, companyId: number) {
    await db.transaction(async (tx) => {
        await tx
            .update(products)
            .set({ is_active: true, updated_at: new Date(), updated_by: userId })
            .where(and(inArray(products.id, ids), eq(products.company_id, companyId)));

        await tx
            .update(productVariants)
            .set({ is_active: true })
            .where(and(inArray(productVariants.product_id, ids), eq(productVariants.company_id, companyId)));
    });

    cacheService.invalidate(`products:c${companyId}:*`);
    broadcast('product:updated', { ids, is_active: true }, 'products');
    return { affected: ids.length };
}
