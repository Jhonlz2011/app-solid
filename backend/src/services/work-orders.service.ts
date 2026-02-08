import { and, desc, eq, ilike, sql } from '@app/schema';
import { db } from '../db';
import {
  workOrders,
  materialRequests,
  materialRequestItems,
  entities,
  authUsers,
  manufacturingOrders,
  manufacturingOrderInputs,
} from '@app/schema/tables';
import { DomainError } from './errors';
import { cacheService } from './cache.service';
import { broadcast } from '../plugins/ws';

type WorkOrderStatus = 'DRAFT' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED' | 'INVOICED';

export interface WorkOrderPayload {
  clientId: number;
  status?: WorkOrderStatus;
  startDate?: string;
  deliveryDate?: string;
  totalEstimated?: number;
  notes?: string;
  initialMaterials?: { productId: number; quantity: number }[];
}

interface WorkOrderFilters {
  status?: WorkOrderStatus;
  clientId?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function listWorkOrders(filters: WorkOrderFilters) {
  const cacheKey = `work-orders:list:${JSON.stringify(filters)}`;

  return cacheService.getOrSet(cacheKey, async () => {
    const { status, clientId, search, limit = 25, offset = 0 } = filters;
    const conditions = [];

    if (status) conditions.push(eq(workOrders.status, status));
    if (clientId) conditions.push(eq(workOrders.client_id, clientId));
    if (search) conditions.push(ilike(workOrders.notes, `%${search}%`));

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const data = await db
      .select({
        id: workOrders.id,
        codeSequence: workOrders.code_sequence,
        clientId: workOrders.client_id,
        status: workOrders.status,
        startDate: workOrders.start_date,
        deliveryDate: workOrders.delivery_date,
        totalEstimated: workOrders.total_estimated,
        notes: workOrders.notes,
        createdAt: workOrders.created_at,
        clientName: entities.business_name,
      })
      .from(workOrders)
      .leftJoin(entities, eq(workOrders.client_id, entities.id))
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(workOrders.created_at));

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(workOrders)
      .where(whereClause);

    return { data, meta: { total: count, limit, offset } };
  }, 120);
}

export async function getWorkOrder(id: number) {
  const [workOrder] = await db
    .select({
      id: workOrders.id,
      codeSequence: workOrders.code_sequence,
      clientId: workOrders.client_id,
      status: workOrders.status,
      startDate: workOrders.start_date,
      deliveryDate: workOrders.delivery_date,
      totalEstimated: workOrders.total_estimated,
      notes: workOrders.notes,
      createdAt: workOrders.created_at,
      clientName: entities.business_name,
    })
    .from(workOrders)
    .leftJoin(entities, eq(workOrders.client_id, entities.id))
    .where(eq(workOrders.id, id));

  if (!workOrder) throw new DomainError('Orden de trabajo no encontrada', 404);

  // Get material requests
  const requests = await db
    .select()
    .from(materialRequests)
    .where(eq(materialRequests.work_order_id, id));

  // Get manufacturing orders
  const manufacturing = await db
    .select()
    .from(manufacturingOrders)
    .where(eq(manufacturingOrders.work_order_id, id));

  return { ...workOrder, materialRequests: requests, manufacturingOrders: manufacturing };
}

export async function createWorkOrder(payload: WorkOrderPayload, userId: number) {
  return db.transaction(async (tx) => {
    // Get next code sequence
    const [lastOrder] = await tx
      .select({ codeSequence: workOrders.code_sequence })
      .from(workOrders)
      .orderBy(desc(workOrders.code_sequence))
      .limit(1);

    const nextSequence = (lastOrder?.codeSequence ?? 0) + 1;

    const [workOrder] = await tx
      .insert(workOrders)
      .values({
        code_sequence: nextSequence,
        client_id: payload.clientId,
        status: payload.status ?? 'DRAFT',
        start_date: payload.startDate ?? null,
        delivery_date: payload.deliveryDate ?? null,
        total_estimated: payload.totalEstimated?.toString(),
        notes: payload.notes,
      })
      .returning();

    // Create initial material request if provided
    if (payload.initialMaterials?.length) {
      // Get entity_id from user for requester
      const [user] = await tx.select({ entityId: authUsers.entity_id }).from(authUsers).where(eq(authUsers.id, userId));

      const [request] = await tx
        .insert(materialRequests)
        .values({
          work_order_id: workOrder.id,
          requester_id: user?.entityId ?? null,
          status: 'PENDING',
        })
        .returning();

      await tx.insert(materialRequestItems).values(
        payload.initialMaterials.map((m) => ({
          request_id: request.id,
          product_id: m.productId,
          quantity_requested: m.quantity.toString(),
        }))
      );
    }

    cacheService.invalidate('work-orders:*');
    broadcast('work-order:created', workOrder, 'work-orders');

    return workOrder;
  });
}

export async function updateWorkOrder(workOrderId: number, payload: Partial<WorkOrderPayload>, userId: number) {
  const updateValues: any = {};

  if (payload.clientId !== undefined) updateValues.client_id = payload.clientId;
  if (payload.status !== undefined) updateValues.status = payload.status;
  if (payload.startDate !== undefined) updateValues.start_date = payload.startDate;
  if (payload.deliveryDate !== undefined) updateValues.delivery_date = payload.deliveryDate;
  if (payload.totalEstimated !== undefined) updateValues.total_estimated = payload.totalEstimated.toString();
  if (payload.notes !== undefined) updateValues.notes = payload.notes;

  const [updated] = await db
    .update(workOrders)
    .set(updateValues)
    .where(eq(workOrders.id, workOrderId))
    .returning();

  if (!updated) throw new DomainError('Orden de trabajo no encontrada', 404);

  cacheService.invalidate('work-orders:*');
  broadcast('work-order:updated', updated, 'work-orders');

  return updated;
}

export async function deleteWorkOrder(workOrderId: number, userId: number) {
  const [deleted] = await db
    .delete(workOrders)
    .where(eq(workOrders.id, workOrderId))
    .returning();

  if (!deleted) throw new DomainError('Orden de trabajo no encontrada', 404);

  cacheService.invalidate('work-orders:*');
  broadcast('work-order:deleted', { id: workOrderId }, 'work-orders');

  return { success: true };
}

// --- Manufacturing Logic ---

export async function createManufacturingOrder(
  workOrderId: number,
  payload: {
    outputProductId?: number;
    targetQuantity: number;
    customWidth?: number;
    customHeight?: number;
    customThickness?: number;
    inputs?: { productId: number; plannedQuantity: number; notes?: string }[];
  }
) {
  return db.transaction(async (tx) => {
    const [mo] = await tx
      .insert(manufacturingOrders)
      .values({
        work_order_id: workOrderId,
        output_product_id: payload.outputProductId,
        target_quantity: payload.targetQuantity.toString(),
        custom_width: payload.customWidth?.toString(),
        custom_height: payload.customHeight?.toString(),
        custom_thickness: payload.customThickness?.toString(),
        status: 'PLANNED',
      })
      .returning();

    if (payload.inputs && payload.inputs.length > 0) {
      await tx.insert(manufacturingOrderInputs).values(
        payload.inputs.map((input) => ({
          manufacturing_order_id: mo.id,
          product_id: input.productId,
          planned_quantity: input.plannedQuantity.toString(),
          notes: input.notes,
        }))
      );
    }

    return mo;
  });
}
