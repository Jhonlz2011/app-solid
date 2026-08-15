import { and, eq, isNull, desc } from '@app/schema';
import { db } from '../../core/db';
import { carrierVehicles } from '@app/schema/tables';
import { DomainError } from '../../core/errors';
import { withAuditTransaction, type AuditContext } from '../audit/audit.service';
import type { CarrierVehiclePayload } from '@app/schema/dto';

export const vehiclesService = {
    async list(companyId: number) {
        return await db
            .select()
            .from(carrierVehicles)
            .where(
                and(
                    eq(carrierVehicles.company_id, companyId),
                    isNull(carrierVehicles.carrier_id)
                )
            )
            .orderBy(desc(carrierVehicles.id));
    },

    async get(companyId: number, id: number) {
        const [vehicle] = await db
            .select()
            .from(carrierVehicles)
            .where(
                and(
                    eq(carrierVehicles.id, id),
                    eq(carrierVehicles.company_id, companyId),
                    isNull(carrierVehicles.carrier_id)
                )
            );

        if (!vehicle) throw new DomainError('Vehículo no encontrado', 404);
        return vehicle;
    },

    async create(companyId: number, data: CarrierVehiclePayload, audit?: AuditContext) {
        return await withAuditTransaction(audit, async (tx) => {
            const [created] = await tx
                .insert(carrierVehicles)
                .values({
                    company_id: companyId,
                    carrier_id: null,
                    license_plate: data.licensePlate.toUpperCase().trim(),
                    description: data.description || null,
                    is_active: data.isActive ?? true,
                })
                .returning();

            return created;
        });
    },

    async update(companyId: number, id: number, data: Partial<CarrierVehiclePayload>, audit?: AuditContext) {
        return await withAuditTransaction(audit, async (tx) => {
            const updateSet: Record<string, unknown> = {};
            if (data.licensePlate !== undefined) updateSet.license_plate = data.licensePlate.toUpperCase().trim();
            if (data.description !== undefined) updateSet.description = data.description || null;
            if (data.isActive !== undefined) updateSet.is_active = data.isActive;

            const [updated] = await tx
                .update(carrierVehicles)
                .set(updateSet)
                .where(
                    and(
                        eq(carrierVehicles.id, id),
                        eq(carrierVehicles.company_id, companyId),
                        isNull(carrierVehicles.carrier_id)
                    )
                )
                .returning();

            if (!updated) throw new DomainError('Vehículo no encontrado', 404);
            return updated;
        });
    },

    async delete(companyId: number, id: number, audit?: AuditContext) {
        return await withAuditTransaction(audit, async (tx) => {
            const [deleted] = await tx
                .delete(carrierVehicles)
                .where(
                    and(
                        eq(carrierVehicles.id, id),
                        eq(carrierVehicles.company_id, companyId),
                        isNull(carrierVehicles.carrier_id)
                    )
                )
                .returning();

            if (!deleted) throw new DomainError('Vehículo no encontrado', 404);
            return { success: true };
        });
    },
};
