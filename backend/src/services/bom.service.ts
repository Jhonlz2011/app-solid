import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import { bomHeaders, bomDetails, products } from '../schema';
import { DomainError } from './errors';
import { cacheService } from './cache.service';
import { broadcast } from '../plugins/ws';

// ====== BOM (Bill of Materials) ======

interface BomPayload {
    productId: number;
    name?: string;
    revision?: number;
    components: { componentProductId: number; quantityNeeded: number; wastagePercent?: number }[];
}

export async function getBomForProduct(productId: number) {
    const cacheKey = `bom:product:${productId}`;

    return cacheService.getOrSet(cacheKey, async () => {
        const [header] = await db
            .select()
            .from(bomHeaders)
            .where(eq(bomHeaders.product_id, productId))
            .orderBy(desc(bomHeaders.revision))
            .limit(1);

        if (!header) return null;

        const details = await db
            .select({
                id: bomDetails.id,
                componentProductId: bomDetails.component_product_id,
                quantityNeeded: bomDetails.quantity_needed,
                wastagePercent: bomDetails.wastage_percent,
                componentName: products.name,
                componentSku: products.sku,
            })
            .from(bomDetails)
            .leftJoin(products, eq(bomDetails.component_product_id, products.id))
            .where(eq(bomDetails.bom_id, header.id));

        return { ...header, components: details };
    }, 600);
}

export async function getBom(id: number) {
    const [header] = await db.select().from(bomHeaders).where(eq(bomHeaders.id, id));
    if (!header) throw new DomainError('BOM no encontrado', 404);

    const details = await db
        .select({
            id: bomDetails.id,
            componentProductId: bomDetails.component_product_id,
            quantityNeeded: bomDetails.quantity_needed,
            wastagePercent: bomDetails.wastage_percent,
            componentName: products.name,
            componentSku: products.sku,
        })
        .from(bomDetails)
        .leftJoin(products, eq(bomDetails.component_product_id, products.id))
        .where(eq(bomDetails.bom_id, id));

    return { ...header, components: details };
}

export async function createBom(payload: BomPayload) {
    return db.transaction(async (tx) => {
        // Get current max revision
        const [existing] = await tx
            .select({ revision: bomHeaders.revision })
            .from(bomHeaders)
            .where(eq(bomHeaders.product_id, payload.productId))
            .orderBy(desc(bomHeaders.revision))
            .limit(1);

        const newRevision = payload.revision ?? (existing ? (existing.revision || 0) + 1 : 1);

        const [header] = await tx.insert(bomHeaders).values({
            product_id: payload.productId,
            name: payload.name || `BOM Rev ${newRevision}`,
            revision: newRevision,
        }).returning();

        await tx.insert(bomDetails).values(
            payload.components.map((c) => ({
                bom_id: header.id,
                component_product_id: c.componentProductId,
                quantity_needed: c.quantityNeeded.toString(),
                wastage_percent: (c.wastagePercent ?? 0).toString(),
            }))
        );

        cacheService.invalidate(`bom:product:${payload.productId}`);
        broadcast('bom:created', header, 'bom');

        return header;
    });
}

export async function updateBom(id: number, payload: Partial<BomPayload>) {
    return db.transaction(async (tx) => {
        const [header] = await tx.update(bomHeaders).set({
            name: payload.name,
        }).where(eq(bomHeaders.id, id)).returning();

        if (!header) throw new DomainError('BOM no encontrado', 404);

        // If components provided, replace all
        if (payload.components?.length) {
            await tx.delete(bomDetails).where(eq(bomDetails.bom_id, id));

            await tx.insert(bomDetails).values(
                payload.components.map((c) => ({
                    bom_id: id,
                    component_product_id: c.componentProductId,
                    quantity_needed: c.quantityNeeded.toString(),
                    wastage_percent: (c.wastagePercent ?? 0).toString(),
                }))
            );
        }

        cacheService.invalidate(`bom:product:${header.product_id}`);
        broadcast('bom:updated', header, 'bom');

        return header;
    });
}

export async function deleteBom(id: number) {
    const [deleted] = await db.delete(bomHeaders).where(eq(bomHeaders.id, id)).returning();
    if (!deleted) throw new DomainError('BOM no encontrado', 404);

    cacheService.invalidate(`bom:product:${deleted.product_id}`);
    broadcast('bom:deleted', { id }, 'bom');

    return { success: true };
}
