import { and, desc, eq, sql } from '@app/schema';
import { db } from '../db';
import { electronicDocuments, remissionGuides, entities } from '@app/schema/tables';
import { DomainError } from './errors';
import { cacheService } from './cache.service';
import { broadcast } from '../plugins/ws';
import { getNextSequential } from './electronic-documents.service';

interface RemissionGuidePayload {
    establishment: string;
    emissionPoint: string;
    issueDate: string;
    entityId: number; // Destinatario
    workOrderId?: number;
    relatedInvoiceId?: number;
    carrierId?: number;
    vehiclePlate: string;
    startDate: string;
    endDate: string;
    routeOrigin: string;
    routeDestination: string;
    reason?: string;
    customsDoc?: string;
}

interface ListFilters {
    entityId?: number;
    carrierId?: number;
    status?: string;
    limit?: number;
    offset?: number;
}

/**
 * List remission guides
 */
export async function listRemissionGuides(filters: ListFilters) {
    const cacheKey = `remission:list:${JSON.stringify(filters)}`;

    return cacheService.getOrSet(cacheKey, async () => {
        const { entityId, carrierId, status, limit = 25, offset = 0 } = filters;
        const conditions = [eq(electronicDocuments.type, 'REMISSION_GUIDE')];

        if (entityId) conditions.push(eq(electronicDocuments.entity_id, entityId));
        if (status) conditions.push(eq(electronicDocuments.status, status as any));

        const whereClause = and(...conditions);

        const data = await db
            .select({
                id: electronicDocuments.id,
                status: electronicDocuments.status,
                establishment: electronicDocuments.establishment,
                emissionPoint: electronicDocuments.emission_point,
                sequential: electronicDocuments.sequential,
                issueDate: electronicDocuments.issue_date,
                entityId: electronicDocuments.entity_id,
                createdAt: electronicDocuments.created_at,
                vehiclePlate: remissionGuides.vehicle_plate,
                routeOrigin: remissionGuides.route_origin,
                routeDestination: remissionGuides.route_destination,
            })
            .from(electronicDocuments)
            .innerJoin(remissionGuides, eq(electronicDocuments.id, remissionGuides.document_id))
            .where(whereClause)
            .limit(limit)
            .offset(offset)
            .orderBy(desc(electronicDocuments.created_at));

        const [{ count }] = await db
            .select({ count: sql<number>`count(*)`.mapWith(Number) })
            .from(electronicDocuments)
            .innerJoin(remissionGuides, eq(electronicDocuments.id, remissionGuides.document_id))
            .where(whereClause);

        return { data, meta: { total: count, limit, offset } };
    }, 120);
}

/**
 * Get remission guide by ID
 */
export async function getRemissionGuide(id: number) {
    const cacheKey = `remission:${id}`;

    return cacheService.getOrSet(cacheKey, async () => {
        const [doc] = await db
            .select()
            .from(electronicDocuments)
            .where(and(eq(electronicDocuments.id, id), eq(electronicDocuments.type, 'REMISSION_GUIDE')));

        if (!doc) throw new DomainError('Guía de remisión no encontrada', 404);

        const [guide] = await db.select().from(remissionGuides).where(eq(remissionGuides.document_id, id));
        if (!guide) throw new DomainError('Detalles de guía no encontrados', 404);

        // Get entity (destinatario)
        const [entity] = await db
            .select({ id: entities.id, businessName: entities.business_name, taxId: entities.tax_id })
            .from(entities)
            .where(eq(entities.id, doc.entity_id));

        // Get carrier if exists
        let carrier = null;
        if (guide.carrier_id) {
            const [c] = await db
                .select({ id: entities.id, businessName: entities.business_name, taxId: entities.tax_id })
                .from(entities)
                .where(eq(entities.id, guide.carrier_id));
            carrier = c;
        }

        return { ...doc, ...guide, entity, carrier };
    }, 300);
}

/**
 * Create remission guide
 */
export async function createRemissionGuide(payload: RemissionGuidePayload, userId: number) {
    return db.transaction(async (tx) => {
        const sequential = await getNextSequential(
            payload.establishment,
            payload.emissionPoint,
            'REMISSION_GUIDE'
        );

        // Create parent document
        const [doc] = await tx
            .insert(electronicDocuments)
            .values({
                type: 'REMISSION_GUIDE',
                establishment: payload.establishment,
                emission_point: payload.emissionPoint,
                sequential,
                issue_date: payload.issueDate,
                entity_id: payload.entityId,
                work_order_id: payload.workOrderId,
                status: 'DRAFT',
                created_by: userId,
            })
            .returning();

        // Create remission guide details
        const [guide] = await tx
            .insert(remissionGuides)
            .values({
                document_id: doc.id,
                related_invoice_id: payload.relatedInvoiceId,
                carrier_id: payload.carrierId,
                vehicle_plate: payload.vehiclePlate,
                start_date: payload.startDate,
                end_date: payload.endDate,
                route_origin: payload.routeOrigin,
                route_destination: payload.routeDestination,
                reason: payload.reason,
                customs_doc: payload.customsDoc,
            })
            .returning();

        cacheService.invalidate('remission:*');
        cacheService.invalidate('docs:*');
        broadcast('remission:created', { id: doc.id }, 'documents');

        return { ...doc, ...guide };
    });
}

/**
 * Update remission guide
 */
export async function updateRemissionGuide(id: number, payload: Partial<RemissionGuidePayload>) {
    const [existing] = await db
        .select()
        .from(electronicDocuments)
        .where(and(eq(electronicDocuments.id, id), eq(electronicDocuments.type, 'REMISSION_GUIDE')));

    if (!existing) throw new DomainError('Guía de remisión no encontrada', 404);
    if (existing.status !== 'DRAFT') throw new DomainError('Solo se pueden editar guías en borrador', 400);

    return db.transaction(async (tx) => {
        if (payload.entityId || payload.issueDate) {
            await tx
                .update(electronicDocuments)
                .set({
                    entity_id: payload.entityId,
                    issue_date: payload.issueDate,
                })
                .where(eq(electronicDocuments.id, id));
        }

        const [updated] = await tx
            .update(remissionGuides)
            .set({
                carrier_id: payload.carrierId,
                vehicle_plate: payload.vehiclePlate,
                start_date: payload.startDate,
                end_date: payload.endDate,
                route_origin: payload.routeOrigin,
                route_destination: payload.routeDestination,
                reason: payload.reason,
                customs_doc: payload.customsDoc,
            })
            .where(eq(remissionGuides.document_id, id))
            .returning();

        cacheService.invalidate(`remission:${id}`);
        cacheService.invalidate('remission:list:*');
        broadcast('remission:updated', { id }, 'documents');

        return updated;
    });
}
