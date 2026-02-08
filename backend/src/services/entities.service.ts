import { and, desc, eq, ilike, or, sql } from '@app/schema';
import { db } from '../db';
import { entities, entityAddresses, employeeDetails, entityContacts } from '@app/schema/tables';
import { DomainError } from './errors';
import { cacheService } from './cache.service';
import { broadcast } from '../plugins/ws';
import type { TaxIdType, PersonType, SriContributorType } from '@app/schema/enums';

// Entity type discriminator
export type EntityType = 'client' | 'supplier' | 'employee' | 'carrier';

// Re-export imported types for consumers of this service
export type { TaxIdType, PersonType, SriContributorType };

export interface EntityPayload {
    taxId: string;
    taxIdType: TaxIdType;
    personType?: PersonType;
    businessName: string;
    tradeName?: string;
    emailBilling: string;
    phone?: string;
    addressFiscal: string;
    sriContributorType?: SriContributorType;
    obligadoContabilidad?: boolean;
    parteRelacionada?: boolean;
    // Employee specific
    department?: string;
    jobTitle?: string;
    salaryBase?: number;
    hireDate?: string;
    costPerHour?: number;
    isCarrier?: boolean;
}

export interface ContactPayload {
    name: string;
    position?: string;
    email?: string;
    phone?: string;
    isPrimary?: boolean;
}

export interface AddressPayload {
    addressLine: string;
    city?: string;
    isMain?: boolean;
}

interface ListFilters {
    search?: string;
    limit?: number;
    offset?: number;
    isCarrier?: boolean;
}

// Helper for numeric conversion
const toDecimal = (val?: number | null): string | undefined =>
    val !== undefined && val !== null ? val.toString() : undefined;

/**
 * List entities by type with caching
 */
export async function listEntities(type: EntityType, filters: ListFilters) {
    const cacheKey = `${type}s:list:${JSON.stringify(filters)}`;

    return cacheService.getOrSet(cacheKey, async () => {
        const { search, limit = 25, offset = 0, isCarrier } = filters;
        const conditions = [];

        switch (type) {
            case 'client':
                conditions.push(eq(entities.is_client, true));
                break;
            case 'supplier':
                conditions.push(eq(entities.is_supplier, true));
                break;
            case 'employee':
                conditions.push(eq(entities.is_employee, true));
                if (isCarrier !== undefined) {
                    conditions.push(eq(entities.is_carrier, isCarrier));
                }
                break;
            case 'carrier':
                conditions.push(eq(entities.is_carrier, true));
                break;
        }

        if (search) {
            const pattern = `%${search}%`;
            conditions.push(
                or(
                    ilike(entities.business_name, pattern),
                    ilike(entities.tax_id, pattern),
                    ilike(entities.trade_name, pattern)
                )
            );
        }

        conditions.push(eq(entities.is_active, true));
        const whereClause = and(...conditions);

        const data = await db
            .select()
            .from(entities)
            .where(whereClause)
            .limit(limit)
            .offset(offset)
            .orderBy(desc(entities.created_at));

        const [{ count }] = await db
            .select({ count: sql<number>`count(*)`.mapWith(Number) })
            .from(entities)
            .where(whereClause);

        return { data, meta: { total: count, limit, offset } };
    }, 3600);
}

/**
 * Get single entity by ID with addresses and contacts
 */
export async function getEntity(id: number) {
    const cacheKey = `entity:${id}`;

    return cacheService.getOrSet(cacheKey, async () => {
        const [entity] = await db.select().from(entities).where(eq(entities.id, id));
        if (!entity) throw new DomainError('Entidad no encontrada', 404);

        const addresses = await db
            .select()
            .from(entityAddresses)
            .where(eq(entityAddresses.entity_id, id));

        const contacts = await db
            .select()
            .from(entityContacts)
            .where(eq(entityContacts.entity_id, id));

        let details = null;
        if (entity.is_employee) {
            const [empDetails] = await db
                .select()
                .from(employeeDetails)
                .where(eq(employeeDetails.entity_id, id));
            details = empDetails || null;
        }

        return { ...entity, addresses, contacts, employeeDetails: details };
    }, 3600);
}

/**
 * Create entity with type flags
 */
export async function createEntity(type: EntityType, payload: EntityPayload) {
    const existing = await db
        .select({ id: entities.id })
        .from(entities)
        .where(eq(entities.tax_id, payload.taxId));

    if (existing.length) {
        throw new DomainError('El número de identificación ya está registrado', 409);
    }

    return db.transaction(async (tx) => {
        const [created] = await tx
            .insert(entities)
            .values({
                tax_id: payload.taxId,
                tax_id_type: payload.taxIdType,
                person_type: payload.personType ?? 'NATURAL',
                business_name: payload.businessName,
                trade_name: payload.tradeName,
                email_billing: payload.emailBilling,
                phone: payload.phone,
                address_fiscal: payload.addressFiscal,
                sri_contributor_type: payload.sriContributorType,
                obligado_contabilidad: payload.obligadoContabilidad ?? false,
                parte_relacionada: payload.parteRelacionada ?? false,
                is_client: type === 'client',
                is_supplier: type === 'supplier',
                is_employee: type === 'employee' || type === 'carrier',
                is_carrier: type === 'carrier' || payload.isCarrier,
            })
            .returning();

        if (type === 'employee' || type === 'carrier') {
            await tx.insert(employeeDetails).values({
                entity_id: created.id,
                department: payload.department,
                job_title: payload.jobTitle,
                salary_base: toDecimal(payload.salaryBase),
                hire_date: payload.hireDate,
                cost_per_hour: toDecimal(payload.costPerHour),
            });
        }

        cacheService.invalidate(`${type}s:*`);
        broadcast('entity:created', { type, entity: created }, `${type}s`);

        return created;
    });
}

/**
 * Update entity
 */
export async function updateEntity(id: number, type: EntityType, payload: Partial<EntityPayload>) {
    return db.transaction(async (tx) => {
        const [updated] = await tx
            .update(entities)
            .set({
                business_name: payload.businessName,
                trade_name: payload.tradeName,
                email_billing: payload.emailBilling,
                phone: payload.phone,
                address_fiscal: payload.addressFiscal,
                sri_contributor_type: payload.sriContributorType,
                obligado_contabilidad: payload.obligadoContabilidad,
                parte_relacionada: payload.parteRelacionada,
                is_carrier: payload.isCarrier,
                updated_at: new Date(),
            })
            .where(eq(entities.id, id))
            .returning();

        if (!updated) throw new DomainError('Entidad no encontrada', 404);

        if ((type === 'employee' || type === 'carrier') &&
            (payload.department || payload.jobTitle || payload.salaryBase || payload.costPerHour)) {
            await tx
                .update(employeeDetails)
                .set({
                    department: payload.department,
                    job_title: payload.jobTitle,
                    salary_base: toDecimal(payload.salaryBase),
                    cost_per_hour: toDecimal(payload.costPerHour),
                })
                .where(eq(employeeDetails.entity_id, id));
        }

        cacheService.invalidate(`entity:${id}`);
        cacheService.invalidate(`${type}s:*`);
        broadcast('entity:updated', { type, entity: updated }, `${type}s`);

        return updated;
    });
}

/**
 * Soft delete entity
 */
export async function deactivateEntity(id: number, type: EntityType) {
    const [updated] = await db
        .update(entities)
        .set({ is_active: false, updated_at: new Date() })
        .where(eq(entities.id, id))
        .returning();

    if (!updated) throw new DomainError('Entidad no encontrada', 404);

    cacheService.invalidate(`entity:${id}`);
    cacheService.invalidate(`${type}s:*`);
    broadcast('entity:deleted', { type, id }, `${type}s`);

    return { success: true };
}

// --- CONTACTS ---

export async function addContact(entityId: number, payload: ContactPayload) {
    if (payload.isPrimary) {
        await db
            .update(entityContacts)
            .set({ is_primary: false })
            .where(eq(entityContacts.entity_id, entityId));
    }

    const [contact] = await db
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

    cacheService.invalidate(`entity:${entityId}`);
    return contact;
}

export async function updateContact(contactId: number, payload: Partial<ContactPayload>) {
    const [contact] = await db
        .select()
        .from(entityContacts)
        .where(eq(entityContacts.id, contactId));

    if (!contact) throw new DomainError('Contacto no encontrado', 404);

    if (payload.isPrimary) {
        await db
            .update(entityContacts)
            .set({ is_primary: false })
            .where(eq(entityContacts.entity_id, contact.entity_id));
    }

    const [updated] = await db
        .update(entityContacts)
        .set({
            name: payload.name,
            position: payload.position,
            email: payload.email,
            phone: payload.phone,
            is_primary: payload.isPrimary,
        })
        .where(eq(entityContacts.id, contactId))
        .returning();

    cacheService.invalidate(`entity:${contact.entity_id}`);
    return updated;
}

export async function deleteContact(contactId: number) {
    const [contact] = await db
        .select()
        .from(entityContacts)
        .where(eq(entityContacts.id, contactId));

    if (!contact) throw new DomainError('Contacto no encontrado', 404);

    await db.delete(entityContacts).where(eq(entityContacts.id, contactId));
    cacheService.invalidate(`entity:${contact.entity_id}`);

    return { success: true };
}

export async function getContacts(entityId: number) {
    return db.select().from(entityContacts).where(eq(entityContacts.entity_id, entityId));
}

// --- ADDRESSES ---

export async function addAddress(entityId: number, payload: AddressPayload) {
    if (payload.isMain) {
        await db
            .update(entityAddresses)
            .set({ is_main: false })
            .where(eq(entityAddresses.entity_id, entityId));
    }

    const [address] = await db
        .insert(entityAddresses)
        .values({
            entity_id: entityId,
            address_line: payload.addressLine,
            city: payload.city,
            is_main: payload.isMain ?? false,
        })
        .returning();

    cacheService.invalidate(`entity:${entityId}`);
    return address;
}

export async function getAddresses(entityId: number) {
    return db.select().from(entityAddresses).where(eq(entityAddresses.entity_id, entityId));
}
