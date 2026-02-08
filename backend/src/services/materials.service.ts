import { and, eq, desc, sql } from '@app/schema';
import { db } from '../db';
import { materialRequests, materialRequestItems, products, entities, workOrders } from '@app/schema/tables';
import { DomainError } from './errors';
import { cacheService } from './cache.service';
import { broadcast } from '../plugins/ws';

// ====== MATERIAL REQUESTS ======

type RequestStatus = 'PENDING' | 'APPROVED' | 'DISPATCHED' | 'REJECTED';

interface RequestPayload {
    workOrderId: number;
    items: { productId: number; quantity: number }[];
}

export async function listMaterialRequests(filters: {
    workOrderId?: number;
    status?: RequestStatus;
    limit?: number;
    offset?: number;
}) {
    const { workOrderId, status, limit = 25, offset = 0 } = filters;
    const conditions = [];

    if (workOrderId) conditions.push(eq(materialRequests.work_order_id, workOrderId));
    if (status) conditions.push(eq(materialRequests.status, status));

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const data = await db
        .select({
            id: materialRequests.id,
            workOrderId: materialRequests.work_order_id,
            requesterId: materialRequests.requester_id,
            status: materialRequests.status,
            createdAt: materialRequests.created_at,
        })
        .from(materialRequests)
        .where(whereClause)
        .orderBy(desc(materialRequests.created_at))
        .limit(limit)
        .offset(offset);

    return { data, meta: { limit, offset } };
}

export async function getMaterialRequest(id: number) {
    const [request] = await db
        .select()
        .from(materialRequests)
        .where(eq(materialRequests.id, id));

    if (!request) throw new DomainError('Solicitud no encontrada', 404);

    const items = await db
        .select({
            id: materialRequestItems.id,
            productId: materialRequestItems.product_id,
            quantityRequested: materialRequestItems.quantity_requested,
            quantityDispatched: materialRequestItems.quantity_dispatched,
            productName: products.name,
            productSku: products.sku,
        })
        .from(materialRequestItems)
        .leftJoin(products, eq(materialRequestItems.product_id, products.id))
        .where(eq(materialRequestItems.request_id, id));

    return { ...request, items };
}

export async function createMaterialRequest(payload: RequestPayload, requesterId: number) {
    return db.transaction(async (tx) => {
        const [request] = await tx.insert(materialRequests).values({
            work_order_id: payload.workOrderId,
            requester_id: requesterId,
            status: 'PENDING',
        }).returning();

        await tx.insert(materialRequestItems).values(
            payload.items.map((item) => ({
                request_id: request.id,
                product_id: item.productId,
                quantity_requested: item.quantity.toString(),
                quantity_dispatched: '0',
            }))
        );

        broadcast('material-request:created', request, 'materials');
        return request;
    });
}

export async function updateRequestStatus(id: number, status: RequestStatus) {
    const [updated] = await db.update(materialRequests)
        .set({ status })
        .where(eq(materialRequests.id, id))
        .returning();

    if (!updated) throw new DomainError('Solicitud no encontrada', 404);

    broadcast('material-request:status', { id, status }, 'materials');
    return updated;
}

export async function dispatchItems(requestId: number, items: { itemId: number; quantity: number }[]) {
    return db.transaction(async (tx) => {
        for (const item of items) {
            const [current] = await tx
                .select()
                .from(materialRequestItems)
                .where(eq(materialRequestItems.id, item.itemId));

            if (!current) continue;

            const currentDispatched = parseFloat(current.quantity_dispatched || '0');
            const newDispatched = currentDispatched + item.quantity;

            await tx.update(materialRequestItems)
                .set({ quantity_dispatched: newDispatched.toString() })
                .where(eq(materialRequestItems.id, item.itemId));
        }

        // Check if all items are dispatched
        const allItems = await tx
            .select()
            .from(materialRequestItems)
            .where(eq(materialRequestItems.request_id, requestId));

        const allDispatched = allItems.every(
            (i) => parseFloat(i.quantity_dispatched || '0') >= parseFloat(i.quantity_requested || '0')
        );

        if (allDispatched) {
            await tx.update(materialRequests)
                .set({ status: 'DISPATCHED' })
                .where(eq(materialRequests.id, requestId));
        }

        broadcast('material-request:dispatched', { requestId, items }, 'materials');
        return { success: true, allDispatched };
    });
}
