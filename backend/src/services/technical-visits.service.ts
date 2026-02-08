import { db } from '../db';
import { technicalVisits, entities } from '@app/schema/tables';
import { eq, desc, and } from '@app/schema';
import { DomainError } from './errors';

export class TechnicalVisitsService {
    async findAll() {
        return await db.query.technicalVisits.findMany({
            with: {
                client: true,
                assignedEmployee: true,
            },
            orderBy: [desc(technicalVisits.visit_date)],
        });
    }

    async findById(id: number) {
        const visit = await db.query.technicalVisits.findFirst({
            where: eq(technicalVisits.id, id),
            with: {
                client: true,
                assignedEmployee: true,
            },
        });

        if (!visit) {
            throw new DomainError('Visita técnica no encontrada', 404);
        }

        return visit;
    }

    async create(data: typeof technicalVisits.$inferInsert) {
        // Validar que el cliente exista
        const client = await db.query.entities.findFirst({
            where: eq(entities.id, data.client_id),
        });

        if (!client) {
            throw new DomainError('Cliente no encontrado', 404);
        }

        const [newVisit] = await db
            .insert(technicalVisits)
            .values(data)
            .returning();

        return newVisit;
    }

    async update(id: number, data: Partial<typeof technicalVisits.$inferInsert>) {
        const visit = await this.findById(id);

        const [updatedVisit] = await db
            .update(technicalVisits)
            .set(data)
            .where(eq(technicalVisits.id, id))
            .returning();

        return updatedVisit;
    }

    async cancel(id: number) {
        const visit = await this.findById(id);

        if (visit.status === 'COMPLETED') {
            throw new DomainError('No se puede cancelar una visita completada');
        }

        const [cancelledVisit] = await db
            .update(technicalVisits)
            .set({ status: 'CANCELLED' })
            .where(eq(technicalVisits.id, id))
            .returning();

        return cancelledVisit;
    }
}

export const technicalVisitsService = new TechnicalVisitsService();
