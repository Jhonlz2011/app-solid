import { db } from '../db';
import { employeeWorkSchedules, entities } from '@app/schema/tables';
import { eq, and, gte, lte, desc } from '@app/schema';
import { DomainError } from './errors';

export class EmployeeSchedulesService {
    async getReport(startDate?: string, endDate?: string, employeeId?: number) {
        const filters = [];

        if (startDate) filters.push(gte(employeeWorkSchedules.work_date, new Date(startDate)));
        if (endDate) filters.push(lte(employeeWorkSchedules.work_date, new Date(endDate)));
        if (employeeId) filters.push(eq(employeeWorkSchedules.employee_id, employeeId));

        return await db.query.employeeWorkSchedules.findMany({
            where: filters.length > 0 ? and(...filters) : undefined,
            with: {
                employee: true,
                workOrder: true,
            },
            orderBy: [desc(employeeWorkSchedules.work_date)],
        });
    }

    async createLog(data: typeof employeeWorkSchedules.$inferInsert) {
        // Validar empleado
        const employee = await db.query.entities.findFirst({
            where: eq(entities.id, data.employee_id),
        });

        if (!employee || !employee.is_employee) {
            throw new DomainError('Empleado no válido', 400);
        }

        // Calcular totales si no vienen (Lógica básica, se puede expandir)
        // Total Cost = Labor Cost + Project Expense
        const laborCost = Number(data.labor_cost || 0);
        const projectExpense = Number(data.project_expense || 0);
        const totalCost = laborCost + projectExpense;

        const [newLog] = await db
            .insert(employeeWorkSchedules)
            .values({
                ...data,
                total_cost: totalCost.toString(),
            })
            .returning();

        return newLog;
    }

    async updateLog(id: number, data: Partial<typeof employeeWorkSchedules.$inferInsert>) {
        // Recalcular total si cambian costos
        let updateData = { ...data };

        if (data.labor_cost || data.project_expense) {
            const current = await db.query.employeeWorkSchedules.findFirst({
                where: eq(employeeWorkSchedules.id, id)
            });

            if (current) {
                const laborCost = Number(data.labor_cost ?? current.labor_cost);
                const projectExpense = Number(data.project_expense ?? current.project_expense);
                updateData.total_cost = (laborCost + projectExpense).toString();
            }
        }

        const [updatedLog] = await db
            .update(employeeWorkSchedules)
            .set(updateData)
            .where(eq(employeeWorkSchedules.id, id))
            .returning();

        if (!updatedLog) {
            throw new DomainError('Registro no encontrado', 404);
        }

        return updatedLog;
    }
}

export const employeeSchedulesService = new EmployeeSchedulesService();
