import { and, eq, count, inArray } from '@app/schema';
import { db } from '../../core/db';
import { entities, entityAddresses, employeeDetails, entityContacts, carrierVehicles, carrierDrivers, supplierProducts, workOrders, electronicDocuments, departments, jobTitles } from '@app/schema/tables';
import { DomainError } from '../../core/errors';
import { cacheService } from '../../core/cache';
import { broadcast } from '../../core/sse/events';
import { RealtimeEvents } from '@app/schema/realtime-events';
import { withAuditTransaction, type AuditContext } from '../audit/audit.service';
import type { EntityBodyType, EntityContactType, EntityAddressType, EntityReferencesType, DepartmentType, JobTitleType } from '@app/schema/dto';
import type { EntityType } from '@app/schema/enums';

// Helper for numeric conversion
const toDecimal = (val?: number | null): string | undefined =>
    val !== undefined && val !== null ? val.toString() : undefined;

/** Filter out undefined values to prevent Drizzle from setting columns to NULL */
function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
    return Object.fromEntries(
        Object.entries(obj).filter(([_, v]) => v !== undefined)
    ) as Partial<T>;
}

// =============================================================================
// Create Entity
// =============================================================================

export async function createEntity(type: EntityType, payload: EntityBodyType, audit: AuditContext | undefined, companyId: number) {
    return await withAuditTransaction(audit, async (tx) => {
        const typeColumn = type === 'client' ? 'is_client' : type === 'supplier' ? 'is_supplier' : type === 'employee' ? 'is_employee' : 'is_carrier';
        const cleanTaxId = payload.taxId.trim();

        // 1. Check if entity with taxId already exists in this company
        const [existing] = await tx
            .select()
            .from(entities)
            .where(and(eq(entities.company_id, companyId), eq(entities.tax_id, cleanTaxId)))
            .limit(1);

        if (existing) {
            // If already has the target role active -> 409 Conflict
            if (existing[typeColumn] && existing.is_active) {
                const roleName = type === 'client' ? 'cliente' : type === 'supplier' ? 'proveedor' : type === 'employee' ? 'empleado' : 'transportista';
                throw new DomainError(`Ya existe un ${roleName} registrado con el número de identificación ${cleanTaxId}`, 409);
            }

            // PROMOTION OF ROLE
            const [promoted] = await tx
                .update(entities)
                .set(stripUndefined({
                    [typeColumn]: true,
                    is_active: true,
                    deleted_at: null,
                    deleted_by: null,
                    business_name: payload.businessName.trim() || existing.business_name,
                    trade_name: payload.tradeName?.trim() ?? existing.trade_name,
                    email_billing: payload.emailBilling?.trim() ?? existing.email_billing,
                    phone: payload.phone?.trim() ?? existing.phone,
                    person_type: payload.personType ?? existing.person_type,
                    tax_regime_type: payload.taxRegimeType ?? existing.tax_regime_type,
                    obligado_contabilidad: payload.obligadoContabilidad ?? existing.obligado_contabilidad,
                    is_retention_agent: payload.isRetentionAgent ?? existing.is_retention_agent,
                    is_special_contributor: payload.isSpecialContributor ?? existing.is_special_contributor,
                    is_client: type === 'client' ? true : (payload.isClient ?? existing.is_client),
                    is_supplier: type === 'supplier' ? true : (payload.isSupplier ?? existing.is_supplier),
                    is_employee: type === 'employee' ? true : (payload.isEmployee ?? existing.is_employee),
                    is_carrier: type === 'carrier' ? true : (payload.isCarrier ?? existing.is_carrier),
                    updated_at: new Date(),
                }))
                .where(eq(entities.id, existing.id))
                .returning();

            // Employee Details Upsert
            if (type === 'employee' || payload.isEmployee || type === 'carrier' || payload.isCarrier) {
                if (payload.employeeDetails) {
                    const [existingEmp] = await tx
                        .select({ id: employeeDetails.id })
                        .from(employeeDetails)
                        .where(eq(employeeDetails.entity_id, existing.id))
                        .limit(1);

                    if (existingEmp) {
                        await tx
                            .update(employeeDetails)
                            .set(stripUndefined({
                                department_id: payload.employeeDetails.departmentId,
                                job_title_id: payload.employeeDetails.jobTitleId,
                                salary_base: toDecimal(payload.employeeDetails.salaryBase),
                                hire_date: payload.employeeDetails.hireDate,
                                cost_per_hour: toDecimal(payload.employeeDetails.costPerHour),
                            }))
                            .where(eq(employeeDetails.id, existingEmp.id));
                    } else {
                        await tx.insert(employeeDetails).values({
                            entity_id: existing.id,
                            department_id: payload.employeeDetails.departmentId ?? null,
                            job_title_id: payload.employeeDetails.jobTitleId ?? null,
                            salary_base: toDecimal(payload.employeeDetails.salaryBase),
                            hire_date: payload.employeeDetails.hireDate,
                            cost_per_hour: toDecimal(payload.employeeDetails.costPerHour),
                        });
                    }
                }
            }

            // Carrier Vehicles & Drivers Upsert
            if (type === 'carrier' || payload.isCarrier) {
                if (payload.vehicles && payload.vehicles.length > 0) {
                    await tx.insert(carrierVehicles).values(
                        payload.vehicles.map(v => ({
                            company_id: companyId,
                            carrier_id: existing.id,
                            license_plate: v.licensePlate.toUpperCase().trim(),
                            description: v.description || null,
                            is_active: v.isActive ?? true,
                        }))
                    ).onConflictDoNothing();
                }
                if (payload.drivers && payload.drivers.length > 0) {
                    await tx.insert(carrierDrivers).values(
                        payload.drivers.map(d => ({
                            carrier_id: existing.id,
                            identification_number: d.identificationNumber.trim(),
                            full_name: d.fullName.trim(),
                            phone: d.phone || null,
                            is_active: d.isActive ?? true,
                        }))
                    ).onConflictDoNothing();
                }
            }

            // Append new addresses if provided
            if (payload.addresses && payload.addresses.length > 0) {
                await tx.insert(entityAddresses).values(
                    payload.addresses.map(addr => ({
                        entity_id: existing.id,
                        address_line: addr.addressLine,
                        city: addr.city,
                        country: addr.country,
                        country_code: addr.countryCode,
                        postal_code: addr.postalCode,
                        is_main: addr.isMain ?? false
                    }))
                );
            }

            // Append new contacts if provided
            if (payload.contacts && payload.contacts.length > 0) {
                await tx.insert(entityContacts).values(
                    payload.contacts.map(contact => ({
                        entity_id: existing.id,
                        name: contact.name,
                        position: contact.position,
                        email: contact.email,
                        phone: contact.phone,
                        is_primary: contact.isPrimary ?? false
                    }))
                );
            }

            await cacheService.invalidate(`entity:c${companyId}:${existing.id}`);
            await cacheService.invalidate(`${type}s:c${companyId}:*`);
            await cacheService.invalidate(`entities:c${companyId}:*`);
            broadcast(RealtimeEvents.ENTITY.CREATED, { type, entity: promoted, clientId: audit?.clientId }, `${type}s`);

            return promoted;
        }

        // 2. New Entity Insertion
        const [created] = await tx
            .insert(entities)
            .values({
                company_id: companyId,
                tax_id: cleanTaxId,
                tax_id_type: payload.taxIdType,
                person_type: payload.personType ?? 'NATURAL',
                business_name: payload.businessName.trim(),
                trade_name: payload.tradeName?.trim() || null,
                email_billing: payload.emailBilling?.trim() || null,
                phone: payload.phone?.trim() || null,
                tax_regime_type: payload.taxRegimeType,
                obligado_contabilidad: payload.obligadoContabilidad ?? false,
                is_client: type === 'client' || (payload.isClient ?? false),
                is_supplier: type === 'supplier' || (payload.isSupplier ?? false),
                is_employee: type === 'employee' || (payload.isEmployee ?? false),
                is_carrier: type === 'carrier' || (payload.isCarrier ?? false),
                is_retention_agent: payload.isRetentionAgent ?? false,
                is_special_contributor: payload.isSpecialContributor ?? false,
            })
            .returning();

        if (type === 'employee' || payload.isEmployee || type === 'carrier' || payload.isCarrier) {
            if (payload.employeeDetails) {
                await tx.insert(employeeDetails).values({
                    entity_id: created.id,
                    department_id: payload.employeeDetails.departmentId ?? null,
                    job_title_id: payload.employeeDetails.jobTitleId ?? null,
                    salary_base: toDecimal(payload.employeeDetails.salaryBase),
                    hire_date: payload.employeeDetails.hireDate,
                    cost_per_hour: toDecimal(payload.employeeDetails.costPerHour),
                });
            }
        }

        if (payload.addresses && payload.addresses.length > 0) {
            await tx.insert(entityAddresses).values(
                payload.addresses.map(addr => ({
                    entity_id: created.id,
                    address_line: addr.addressLine,
                    city: addr.city,
                    country: addr.country,
                    country_code: addr.countryCode,
                    postal_code: addr.postalCode,
                    is_main: addr.isMain ?? false
                }))
            );
        }

        if (payload.contacts && payload.contacts.length > 0) {
            await tx.insert(entityContacts).values(
                payload.contacts.map(contact => ({
                    entity_id: created.id,
                    name: contact.name,
                    position: contact.position,
                    email: contact.email,
                    phone: contact.phone,
                    is_primary: contact.isPrimary ?? false
                }))
            );
        }

        if (payload.isCarrier || type === 'carrier') {
            if (payload.vehicles && payload.vehicles.length > 0) {
                await tx.insert(carrierVehicles).values(
                    payload.vehicles.map(v => ({
                        company_id: companyId,
                        carrier_id: created.id,
                        license_plate: v.licensePlate.toUpperCase().trim(),
                        description: v.description || null,
                        is_active: v.isActive ?? true,
                    }))
                );
            }
            if (payload.drivers && payload.drivers.length > 0) {
                await tx.insert(carrierDrivers).values(
                    payload.drivers.map(d => ({
                        carrier_id: created.id,
                        identification_number: d.identificationNumber.trim(),
                        full_name: d.fullName.trim(),
                        phone: d.phone || null,
                        is_active: d.isActive ?? true,
                    }))
                );
            }
        }

        await cacheService.invalidate(`${type}s:c${companyId}:*`);
        await cacheService.invalidate(`entities:c${companyId}:*`);
        broadcast(RealtimeEvents.ENTITY.CREATED, { type, entity: created, clientId: audit?.clientId }, `${type}s`);

        return created;
    });
}

// =============================================================================
// Update Entity
// =============================================================================

function getTypeColumn(type: EntityType) {
    switch (type) {
        case 'client': return entities.is_client;
        case 'supplier': return entities.is_supplier;
        case 'employee': return entities.is_employee;
        case 'carrier': return entities.is_carrier;
    }
}

export async function updateEntity(id: string, type: EntityType, payload: Partial<EntityBodyType>, audit: AuditContext | undefined, companyId: number) {
    return withAuditTransaction(audit, async (tx) => {
        const typeColumn = getTypeColumn(type);
        const [updated] = await tx
            .update(entities)
            .set(stripUndefined({
                business_name: payload.businessName,
                trade_name: payload.tradeName,
                email_billing: payload.emailBilling,
                phone: payload.phone,
                person_type: payload.personType,
                tax_regime_type: payload.taxRegimeType,
                obligado_contabilidad: payload.obligadoContabilidad,
                is_retention_agent: payload.isRetentionAgent,
                is_special_contributor: payload.isSpecialContributor,
                is_client: payload.isClient,
                is_supplier: payload.isSupplier,
                is_employee: payload.isEmployee,
                is_carrier: payload.isCarrier,
                updated_at: new Date(),
            }))
            .where(and(eq(entities.id, id), eq(entities.company_id, companyId), eq(typeColumn, true)))
            .returning();

        if (!updated) throw new DomainError(`Entidad no encontrada o no es de tipo ${type}`, 404);

        if ((type === 'employee' || payload.isEmployee || type === 'carrier') && payload.employeeDetails) {
            const result = await tx
                .update(employeeDetails)
                .set(stripUndefined({
                    department_id: payload.employeeDetails.departmentId,
                    job_title_id: payload.employeeDetails.jobTitleId,
                    salary_base: toDecimal(payload.employeeDetails.salaryBase),
                    hire_date: payload.employeeDetails.hireDate,
                    cost_per_hour: toDecimal(payload.employeeDetails.costPerHour),
                }))
                .where(eq(employeeDetails.entity_id, id))
                .returning();
            
            if (result.length === 0) {
                await tx.insert(employeeDetails).values({
                    entity_id: id,
                    department_id: payload.employeeDetails.departmentId ?? null,
                    job_title_id: payload.employeeDetails.jobTitleId ?? null,
                    salary_base: toDecimal(payload.employeeDetails.salaryBase),
                    hire_date: payload.employeeDetails.hireDate,
                    cost_per_hour: toDecimal(payload.employeeDetails.costPerHour),
                });
            }
        }

        if (payload.addresses) {
            await tx.delete(entityAddresses).where(eq(entityAddresses.entity_id, id));
            if (payload.addresses.length > 0) {
                await tx.insert(entityAddresses).values(
                    payload.addresses.map(a => ({
                        entity_id: id,
                        address_line: a.addressLine,
                        city: a.city,
                        country: a.country,
                        country_code: a.countryCode,
                        postal_code: a.postalCode,
                        is_main: a.isMain ?? false,
                    }))
                );
            }
        }

        if (payload.contacts) {
            await tx.delete(entityContacts).where(eq(entityContacts.entity_id, id));
            if (payload.contacts.length > 0) {
                await tx.insert(entityContacts).values(
                    payload.contacts.map(c => ({
                        entity_id: id,
                        name: c.name,
                        position: c.position,
                        email: c.email,
                        phone: c.phone,
                        is_primary: c.isPrimary ?? false,
                    }))
                );
            }
        }

        if ((type === 'carrier' || payload.isCarrier)) {
            if (payload.vehicles) {
                await tx.delete(carrierVehicles).where(eq(carrierVehicles.carrier_id, id));
                if (payload.vehicles.length > 0) {
                    await tx.insert(carrierVehicles).values(
                        payload.vehicles.map(v => ({
                            company_id: companyId,
                            carrier_id: id,
                            license_plate: v.licensePlate.trim().toUpperCase(),
                            description: v.description || null,
                            is_active: v.isActive ?? true,
                        }))
                    );
                }
            }
            if (payload.drivers) {
                await tx.delete(carrierDrivers).where(eq(carrierDrivers.carrier_id, id));
                if (payload.drivers.length > 0) {
                    await tx.insert(carrierDrivers).values(
                        payload.drivers.map(d => ({
                            carrier_id: id,
                            identification_number: d.identificationNumber.trim(),
                            full_name: d.fullName.trim(),
                            phone: d.phone || null,
                            is_active: d.isActive ?? true,
                        }))
                    );
                }
            }
        }

        await cacheService.invalidate(`entity:c${companyId}:${id}`);
        await cacheService.invalidate(`${type}s:c${companyId}:*`);
        await cacheService.invalidate(`entities:c${companyId}:*`);
        broadcast(RealtimeEvents.ENTITY.UPDATED, { type, entity: updated, clientId: audit?.clientId }, `${type}s`);

        return updated;
    });
}

// =============================================================================
// Soft Delete / Restore / Hard Delete
// =============================================================================

export async function deactivateEntity(
    id: string,
    type: EntityType,
    deletedBy: number | undefined,
    audit: AuditContext | undefined,
    companyId: number
) {
    return withAuditTransaction(audit, async (tx) => {
        const typeColumn = getTypeColumn(type);
        const [existing] = await tx
            .select()
            .from(entities)
            .where(and(eq(entities.id, id), eq(entities.company_id, companyId), eq(typeColumn, true)))
            .limit(1);

        if (!existing) throw new DomainError(`Entidad no encontrada o no es de tipo ${type}`, 404);

        const otherRolesActive = [
            type !== 'client' && existing.is_client,
            type !== 'supplier' && existing.is_supplier,
            type !== 'employee' && existing.is_employee,
            type !== 'carrier' && existing.is_carrier,
        ].filter(Boolean).length;

        let updated;
        if (otherRolesActive > 0) {
            // Only deactivate the specific role for this entity
            [updated] = await tx
                .update(entities)
                .set({
                    [type === 'client' ? 'is_client' : type === 'supplier' ? 'is_supplier' : type === 'employee' ? 'is_employee' : 'is_carrier']: false,
                    updated_at: new Date(),
                })
                .where(and(eq(entities.id, id), eq(entities.company_id, companyId)))
                .returning();
        } else {
            // Full entity deactivation
            [updated] = await tx
                .update(entities)
                .set({
                    [type === 'client' ? 'is_client' : type === 'supplier' ? 'is_supplier' : type === 'employee' ? 'is_employee' : 'is_carrier']: false,
                    is_active: false,
                    deleted_at: new Date(),
                    deleted_by: deletedBy ?? null,
                    updated_at: new Date(),
                })
                .where(and(eq(entities.id, id), eq(entities.company_id, companyId)))
                .returning();
        }

        await cacheService.invalidate(`entity:c${companyId}:${id}`);
        await cacheService.invalidate(`${type}s:c${companyId}:*`);
        await cacheService.invalidate(`entities:c${companyId}:*`);
        
        broadcast(RealtimeEvents.ENTITY.UPDATED, { type, entity: updated, clientId: audit?.clientId }, `${type}s`);

        return { success: true };
    });
}

export async function restoreEntity(
    id: string,
    type: EntityType,
    audit: AuditContext | undefined,
    companyId: number
) {
    return withAuditTransaction(audit, async (tx) => {
        const typeColumn = getTypeColumn(type);
        const [updated] = await tx
            .update(entities)
            .set({
                is_active: true,
                deleted_at: null,
                deleted_by: null,
                updated_at: new Date(),
            })
            .where(and(eq(entities.id, id), eq(entities.company_id, companyId), eq(typeColumn, true)))
            .returning();

        if (!updated) throw new DomainError(`Entidad no encontrada o no es de tipo ${type}`, 404);

        await cacheService.invalidate(`entity:c${companyId}:${id}`);
        await cacheService.invalidate(`${type}s:c${companyId}:*`);
        await cacheService.invalidate(`entities:c${companyId}:*`);
        broadcast(RealtimeEvents.ENTITY.UPDATED, { type, entity: updated, clientId: audit?.clientId }, `${type}s`);

        return { success: true };
    });
}

export async function checkEntityReferences(id: string, companyId: number): Promise<EntityReferencesType> {
    const [[spCount], [docCount], [woCount]] = await Promise.all([
        db.select({ value: count() }).from(supplierProducts).where(
            and(eq(supplierProducts.supplier_id, id), eq(supplierProducts.company_id, companyId))
        ),
        db.select({ value: count() }).from(electronicDocuments).where(
            and(eq(electronicDocuments.entity_id, id), eq(electronicDocuments.company_id, companyId))
        ),
        db.select({ value: count() }).from(workOrders).where(
            and(eq(workOrders.client_id, id), eq(workOrders.company_id, companyId))
        ),
    ]);

    const total =
        (spCount?.value ?? 0) +
        (docCount?.value ?? 0) +
        (woCount?.value ?? 0);

    return {
        supplierProducts: Number(spCount?.value ?? 0),
        invoices: Number(docCount?.value ?? 0),
        workOrders: Number(woCount?.value ?? 0),
        total: Number(total),
        canDelete: Number(total) === 0,
    };
}

export async function hardDeleteEntity(
    id: string,
    type: EntityType,
    audit: AuditContext | undefined,
    companyId: number
) {
    const refs = await checkEntityReferences(id, companyId);
    if (!refs.canDelete) {
        throw new DomainError(
            `No se puede eliminar permanentemente: la entidad tiene ${refs.total} registro(s) relacionado(s)`,
            409
        );
    }

    return withAuditTransaction(audit, async (tx) => {
        const typeColumn = getTypeColumn(type);
        const [target] = await tx
            .select({ id: entities.id })
            .from(entities)
            .where(and(eq(entities.id, id), eq(entities.company_id, companyId), eq(typeColumn, true)));

        if (!target) throw new DomainError(`Entidad no encontrada o no es de tipo ${type}`, 404);

        await tx.delete(entities).where(and(eq(entities.id, id), eq(entities.company_id, companyId), eq(typeColumn, true)));
        
        await cacheService.invalidate(`entity:c${companyId}:${id}`);
        await cacheService.invalidate(`${type}s:c${companyId}:*`);
        await cacheService.invalidate(`entities:c${companyId}:*`);
        
        broadcast(RealtimeEvents.ENTITY.DELETED, { type, id, clientId: audit?.clientId }, `${type}s`);
        return { success: true };
    });
}

// =============================================================================
// Contacts CRUD
// =============================================================================

export async function addContact(entityId: string, payload: EntityContactType, companyId: number) {
    return db.transaction(async (tx) => {
        const [ent] = await tx
            .select({ id: entities.id })
            .from(entities)
            .where(and(eq(entities.id, entityId), eq(entities.company_id, companyId)));
        if (!ent) throw new DomainError('Entidad no encontrada', 404);

        if (payload.isPrimary) {
            await tx
                .update(entityContacts)
                .set({ is_primary: false })
                .where(eq(entityContacts.entity_id, entityId));
        }

        const [contact] = await tx
            .insert(entityContacts)
            .values({
                entity_id: entityId,
                name: payload.name,
                position: payload.position,
                email: payload.email,
                phone: payload.phone,
                is_primary: payload.isPrimary ?? false,
            })
            .returning();

        await cacheService.invalidate(`entity:c${companyId}:${entityId}`);
        return contact;
    });
}

export async function updateContact(contactId: number, payload: Partial<EntityContactType>, companyId: number) {
    const [contact] = await db
        .select()
        .from(entityContacts)
        .where(eq(entityContacts.id, contactId));

    if (!contact) throw new DomainError('Contacto no encontrado', 404);

    const [ent] = await db
        .select({ id: entities.id })
        .from(entities)
        .where(and(eq(entities.id, contact.entity_id), eq(entities.company_id, companyId)));
    if (!ent) throw new DomainError('Entidad no encontrada', 404);

    if (payload.isPrimary) {
        await db
            .update(entityContacts)
            .set({ is_primary: false })
            .where(eq(entityContacts.entity_id, contact.entity_id));
    }

    const [updated] = await db
        .update(entityContacts)
        .set(stripUndefined({
            name: payload.name,
            position: payload.position,
            email: payload.email,
            phone: payload.phone,
            is_primary: payload.isPrimary,
        }))
        .where(eq(entityContacts.id, contactId))
        .returning();

    await cacheService.invalidate(`entity:c${companyId}:${contact.entity_id}`);
    return updated;
}

export async function deleteContact(contactId: number, companyId: number) {
    const [contact] = await db
        .select()
        .from(entityContacts)
        .where(eq(entityContacts.id, contactId));

    if (!contact) throw new DomainError('Contacto no encontrado', 404);

    const [ent] = await db
        .select({ id: entities.id })
        .from(entities)
        .where(and(eq(entities.id, contact.entity_id), eq(entities.company_id, companyId)));
    if (!ent) throw new DomainError('Entidad no encontrada', 404);

    await db.delete(entityContacts).where(eq(entityContacts.id, contactId));
    await cacheService.invalidate(`entity:c${companyId}:${contact.entity_id}`);

    return { success: true };
}

// =============================================================================
// Addresses CRUD
// =============================================================================

export async function addAddress(entityId: string, payload: EntityAddressType, companyId: number) {
    return db.transaction(async (tx) => {
        const [ent] = await tx
            .select({ id: entities.id })
            .from(entities)
            .where(and(eq(entities.id, entityId), eq(entities.company_id, companyId)));
        if (!ent) throw new DomainError('Entidad no encontrada', 404);

        if (payload.isMain) {
            await tx
                .update(entityAddresses)
                .set({ is_main: false })
                .where(eq(entityAddresses.entity_id, entityId));
        }

        const [address] = await tx
            .insert(entityAddresses)
            .values({
                entity_id: entityId,
                address_line: payload.addressLine,
                city: payload.city,
                country: payload.country,
                country_code: payload.countryCode,
                postal_code: payload.postalCode,
                is_main: payload.isMain ?? false,
            })
            .returning();

        await cacheService.invalidate(`entity:c${companyId}:${entityId}`);
        return address;
    });
}

// =============================================================================
// Bulk Operations
// =============================================================================

export async function bulkDeactivateEntities(
    type: EntityType,
    ids: string[],
    audit: AuditContext | undefined,
    companyId: number
) {
    if (ids.length === 0) return { success: true, count: 0 };
    return withAuditTransaction(audit, async (tx) => {
        const typeColumn = type === 'client' ? entities.is_client : type === 'supplier' ? entities.is_supplier : type === 'employee' ? entities.is_employee : entities.is_carrier;
        const conditions = [
            eq(typeColumn, true),
            eq(entities.is_active, true),
            eq(entities.company_id, companyId),
            inArray(entities.id, ids),
        ];

        const existing = await tx
            .select({ id: entities.id })
            .from(entities)
            .where(and(...conditions));

        const existingIds = existing.map(e => e.id);
        if (existingIds.length === 0) {
            throw new DomainError('No se encontraron entidades válidas para eliminar', 404);
        }

        const updatedEntities = await tx.update(entities).set({
            is_active: false,
            deleted_at: new Date(),
            updated_at: new Date(),
        }).where(and(eq(entities.company_id, companyId), inArray(entities.id, existingIds)))
          .returning();

        await cacheService.invalidate(`${type}s:c${companyId}:*`);
        await cacheService.invalidate(`entities:c${companyId}:*`);
        await Promise.all(existingIds.map(id => cacheService.invalidate(`entity:c${companyId}:${id}`)));

        for (const entity of updatedEntities) {
            broadcast(RealtimeEvents.ENTITY.UPDATED, {
                type,
                entity,
                clientId: audit?.clientId,
            }, `${type}s`);
        }

        return { success: true, count: existingIds.length, deletedIds: existingIds };
    });
}

export async function bulkRestoreEntities(
    type: EntityType,
    ids: string[],
    audit: AuditContext | undefined,
    companyId: number
) {
    if (ids.length === 0) return { success: true, count: 0 };
    return withAuditTransaction(audit, async (tx) => {
        const typeColumn = type === 'client' ? entities.is_client : type === 'supplier' ? entities.is_supplier : type === 'employee' ? entities.is_employee : entities.is_carrier;
        const conditions = [
            eq(typeColumn, true),
            eq(entities.is_active, false),
            eq(entities.company_id, companyId),
            inArray(entities.id, ids),
        ];

        const existing = await tx
            .select({ id: entities.id })
            .from(entities)
            .where(and(...conditions));

        const existingIds = existing.map(e => e.id);
        if (existingIds.length === 0) {
            throw new DomainError('No se encontraron entidades válidas para restaurar', 404);
        }

        const updatedEntities = await tx.update(entities).set({
            is_active: true,
            deleted_at: null,
            deleted_by: null,
            updated_at: new Date(),
        }).where(and(eq(entities.company_id, companyId), inArray(entities.id, existingIds)))
          .returning();

        await cacheService.invalidate(`${type}s:c${companyId}:*`);
        await cacheService.invalidate(`entities:c${companyId}:*`);
        await Promise.all(existingIds.map(id => cacheService.invalidate(`entity:c${companyId}:${id}`)));

        for (const entity of updatedEntities) {
            broadcast(RealtimeEvents.ENTITY.UPDATED, {
                type,
                entity,
                clientId: audit?.clientId,
            }, `${type}s`);
        }

        return { success: true, count: existingIds.length, restoredIds: existingIds };
    });
}

// =============================================================================
// Departments & Job Titles CRUD
// =============================================================================

export async function createDepartment(payload: DepartmentType, companyId: number) {
    const [created] = await db
        .insert(departments)
        .values({
            company_id: companyId,
            name: payload.name.trim(),
            code: payload.code?.trim() || null,
            is_active: true,
        })
        .returning();
    return created;
}

export async function createJobTitle(payload: JobTitleType, companyId: number) {
    const [created] = await db
        .insert(jobTitles)
        .values({
            company_id: companyId,
            department_id: payload.departmentId ?? null,
            name: payload.name.trim(),
            is_active: true,
        })
        .returning();
    return created;
}
