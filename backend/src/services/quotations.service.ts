import { db } from '../db';
import { quotations, quotationItems, workOrders, entities } from '@app/schema/tables';
import { eq, desc } from '@app/schema';
import { DomainError } from './errors';

type CreateQuotationDTO = typeof quotations.$inferInsert & {
    items: Omit<typeof quotationItems.$inferInsert, 'quotation_id'>[];
};

export class QuotationsService {
    async findAll() {
        return await db.query.quotations.findMany({
            with: {
                client: true,
                items: {
                    with: {
                        product: true,
                    },
                },
            },
            orderBy: [desc(quotations.created_at)],
        });
    }

    async findById(id: number) {
        const quotation = await db.query.quotations.findFirst({
            where: eq(quotations.id, id),
            with: {
                client: true,
                items: {
                    with: {
                        product: true,
                    },
                },
            },
        });

        if (!quotation) {
            throw new DomainError('Cotización no encontrada', 404);
        }

        return quotation;
    }

    async create(data: CreateQuotationDTO) {
        // Validar cliente
        const client = await db.query.entities.findFirst({
            where: eq(entities.id, data.client_id),
        });

        if (!client) {
            throw new DomainError('Cliente no encontrado', 404);
        }

        return await db.transaction(async (tx) => {
            // 1. Crear Cabecera
            const [newQuotation] = await tx
                .insert(quotations)
                .values({
                    client_id: data.client_id,
                    technical_visit_id: data.technical_visit_id,
                    total_amount: data.total_amount,
                    valid_until: data.valid_until,
                    notes: data.notes,
                    created_by: data.created_by,
                    status: 'DRAFT',
                })
                .returning();

            // 2. Crear Items
            if (data.items && data.items.length > 0) {
                const itemsToInsert = data.items.map((item) => ({
                    ...item,
                    quotation_id: newQuotation.id,
                }));
                await tx.insert(quotationItems).values(itemsToInsert);
            }

            return newQuotation;
        });
    }

    async updateStatus(id: number, status: 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED' | 'CONVERTED_TO_WO') {
        const [updated] = await db
            .update(quotations)
            .set({ status })
            .where(eq(quotations.id, id))
            .returning();

        if (!updated) {
            throw new DomainError('Cotización no encontrada', 404);
        }

        return updated;
    }

    async convertToWorkOrder(id: number) {
        const quotation = await this.findById(id);

        if (quotation.status !== 'APPROVED') {
            throw new DomainError('Solo se pueden convertir cotizaciones APROBADAS');
        }

        return await db.transaction(async (tx) => {
            // 1. Crear Orden de Trabajo
            const [newWorkOrder] = await tx
                .insert(workOrders)
                .values({
                    client_id: quotation.client_id,
                    quotation_id: quotation.id,
                    status: 'DRAFT',
                    total_estimated: quotation.total_amount,
                    notes: `Generado desde Cotización #${quotation.id}`,
                })
                .returning();

            // 2. Actualizar estado de cotización
            await tx
                .update(quotations)
                .set({ status: 'CONVERTED_TO_WO' })
                .where(eq(quotations.id, id));

            return newWorkOrder;
        });
    }
}

export const quotationsService = new QuotationsService();
