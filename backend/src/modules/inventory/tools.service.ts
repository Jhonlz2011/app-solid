import { eq, and, sql, desc, or, ilike, alias } from '@app/schema';
import { db } from '../../core/db';
import {
    toolLoans,
    toolLoanItems,
    toolReturns,
    toolReturnItems,
    toolItems,
    entities,
    productVariants,
    products,
    member,
} from '@app/schema/tables';
import { DomainError } from '../../core/errors';
import { cacheService } from '../../core/cache/cache.service';
import { broadcastToTenant } from '../../core/sse/events';
import { RealtimeEvents } from '@app/schema/realtime-events';
import type {
    ToolLoanBodyType,
    ToolReturnBodyType,
    ToolLoanQueryType,
    ToolLoanNode,
    ToolLoanDetail,
    ToolLoanItemDetail,
    EmployeeCustodySummary,
} from '@app/schema/dto';

// =============================================================================
// TOOLS SERVICE — Tool Crib & Equipment Custody Management (Odoo Standard)
// =============================================================================

/**
 * Resolves a fallback entity ID for the current authenticated user if not provided explicitly.
 */
async function resolveEntityForUser(userId: string, companyId: number): Promise<string> {
    // 1. Check member link
    const [mem] = await db
        .select({ entityId: member.entityId })
        .from(member)
        .where(eq(member.userId, userId));

    if (mem?.entityId) return mem.entityId;

    // 2. Check if any employee entity exists for this company
    const [anyEmployee] = await db
        .select({ id: entities.id })
        .from(entities)
        .where(and(eq(entities.company_id, companyId), eq(entities.is_employee, true)));

    if (anyEmployee) return anyEmployee.id;

    // 3. Fallback to any entity
    const [firstEntity] = await db
        .select({ id: entities.id })
        .from(entities)
        .where(eq(entities.company_id, companyId));

    if (!firstEntity) throw new DomainError('No hay entidades registradas en la empresa para asociar el despacho', 400);
    return firstEntity.id;
}

export const toolsService = {
    /**
     * List tool loans with filtering, borrower details, item counts and overdue detection
     */
    async listToolLoans(companyId: number, query: ToolLoanQueryType = {}): Promise<ToolLoanNode[]> {
        const borrower = alias(entities, 'borrower');
        const dispatcher = alias(entities, 'dispatcher');

        const conditions = [eq(toolLoans.company_id, companyId)];

        if (query.borrowerId) {
            conditions.push(eq(toolLoans.borrower_id, query.borrowerId));
        }
        if (query.workOrderId) {
            conditions.push(eq(toolLoans.work_order_id, Number(query.workOrderId)));
        }
        if (query.status) {
            conditions.push(eq(toolLoans.status, query.status as any));
        }
        if (query.search && query.search.trim()) {
            const term = `%${query.search.trim()}%`;
            conditions.push(
                or(
                    ilike(toolLoans.code, term),
                    ilike(borrower.business_name, term)
                )!
            );
        }

        const rows = await db
            .select({
                id: toolLoans.id,
                company_id: toolLoans.company_id,
                code: toolLoans.code,
                borrower_id: toolLoans.borrower_id,
                borrower_name: sql<string>`COALESCE(${borrower.business_name}, 'Desconocido')`,
                dispatched_by: toolLoans.dispatched_by,
                dispatched_by_name: sql<string>`COALESCE(${dispatcher.business_name}, 'Sistema')`,
                work_order_id: toolLoans.work_order_id,
                destination_type: toolLoans.destination_type,
                location_detail: toolLoans.location_detail,
                loan_date: toolLoans.loan_date,
                expected_return_date: toolLoans.expected_return_date,
                actual_return_date: toolLoans.actual_return_date,
                status: toolLoans.status,
                notes: toolLoans.notes,
                created_at: toolLoans.created_at,
                // Aggregates for items
                items_count: sql<number>`COALESCE((
                    SELECT COUNT(*)::int
                    FROM tool_loan_items
                    WHERE tool_loan_items.loan_id = ${toolLoans.id}
                ), 0)`,
                pending_items_count: sql<number>`COALESCE((
                    SELECT COUNT(*)::int
                    FROM tool_loan_items
                    WHERE tool_loan_items.loan_id = ${toolLoans.id}
                      AND (tool_loan_items.quantity_loaned - tool_loan_items.quantity_returned) > 0
                ), 0)`,
            })
            .from(toolLoans)
            .leftJoin(borrower, and(eq(toolLoans.borrower_id, borrower.id), eq(borrower.company_id, companyId)))
            .leftJoin(dispatcher, and(eq(toolLoans.dispatched_by, dispatcher.id), eq(dispatcher.company_id, companyId)))
            .where(and(...conditions))
            .orderBy(desc(toolLoans.loan_date));

        const now = new Date();
        const mapped = rows.map((r) => {
            const expDate = new Date(r.expected_return_date);
            const isOverdue = r.status !== 'COMPLETED' && r.status !== 'CANCELLED' && expDate < now;
            return {
                ...r,
                is_overdue: isOverdue,
            };
        });

        if (query.overdueOnly === 'true' || query.overdueOnly === true) {
            return mapped.filter((m) => m.is_overdue);
        }

        return mapped;
    },

    /**
     * Get single tool loan detail with items and returns history
     */
    async getToolLoan(id: number, companyId: number): Promise<ToolLoanDetail> {
        const [loan] = await db
            .select({
                id: toolLoans.id,
                company_id: toolLoans.company_id,
                code: toolLoans.code,
                borrower_id: toolLoans.borrower_id,
                dispatched_by: toolLoans.dispatched_by,
                work_order_id: toolLoans.work_order_id,
                destination_type: toolLoans.destination_type,
                location_detail: toolLoans.location_detail,
                loan_date: toolLoans.loan_date,
                expected_return_date: toolLoans.expected_return_date,
                actual_return_date: toolLoans.actual_return_date,
                status: toolLoans.status,
                notes: toolLoans.notes,
                created_at: toolLoans.created_at,
            })
            .from(toolLoans)
            .where(and(eq(toolLoans.id, id), eq(toolLoans.company_id, companyId)));

        if (!loan) throw new DomainError('Préstamo de herramientas no encontrado', 404);

        // Fetch borrower and dispatcher names
        const [borrower] = await db
            .select({ name: entities.business_name })
            .from(entities)
            .where(eq(entities.id, loan.borrower_id));

        const [dispatcher] = await db
            .select({ name: entities.business_name })
            .from(entities)
            .where(eq(entities.id, loan.dispatched_by));

        // Fetch loan items
        const rawItems = await db
            .select({
                id: toolLoanItems.id,
                loan_id: toolLoanItems.loan_id,
                variant_id: toolLoanItems.variant_id,
                tool_item_id: toolLoanItems.tool_item_id,
                quantity_loaned: toolLoanItems.quantity_loaned,
                quantity_returned: toolLoanItems.quantity_returned,
                notes: toolLoanItems.notes,
                variant_name: productVariants.variant_name,
                sku: productVariants.sku,
                product_name: products.name,
                tool_item_code: toolItems.internal_code,
            })
            .from(toolLoanItems)
            .innerJoin(productVariants, eq(toolLoanItems.variant_id, productVariants.id))
            .innerJoin(products, eq(productVariants.product_id, products.id))
            .leftJoin(toolItems, eq(toolLoanItems.tool_item_id, toolItems.id))
            .where(eq(toolLoanItems.loan_id, id));

        const items: ToolLoanItemDetail[] = rawItems.map((item) => {
            const loaned = Number(item.quantity_loaned);
            const returned = Number(item.quantity_returned);
            return {
                ...item,
                pending_quantity: Math.max(0, loaned - returned),
            };
        });

        // Fetch returns history
        const returnsRaw = await db
            .select({
                id: toolReturns.id,
                return_date: toolReturns.return_date,
                received_by: toolReturns.received_by,
                notes: toolReturns.notes,
                receiver_name: entities.business_name,
            })
            .from(toolReturns)
            .leftJoin(entities, eq(toolReturns.received_by, entities.id))
            .where(eq(toolReturns.loan_id, id))
            .orderBy(desc(toolReturns.return_date));

        const returnIds = returnsRaw.map((r) => r.id);
        const returnItemsRaw = returnIds.length > 0
            ? await db
                .select({
                    id: toolReturnItems.id,
                    return_id: toolReturnItems.return_id,
                    loan_item_id: toolReturnItems.loan_item_id,
                    quantity_returned: toolReturnItems.quantity_returned,
                    condition: toolReturnItems.condition,
                    damage_notes: toolReturnItems.damage_notes,
                    requires_maintenance: toolReturnItems.requires_maintenance,
                })
                .from(toolReturnItems)
                .where(sql`${toolReturnItems.return_id} IN ${returnIds}`)
            : [];

        const returnsGrouped = returnsRaw.map((r) => ({
            id: r.id,
            return_date: r.return_date,
            received_by_name: r.receiver_name ?? 'Bodeguero',
            notes: r.notes,
            items: returnItemsRaw.filter((ri) => ri.return_id === r.id),
        }));

        const isOverdue =
            loan.status !== 'COMPLETED' &&
            loan.status !== 'CANCELLED' &&
            new Date(loan.expected_return_date) < new Date();

        return {
            ...loan,
            borrower_name: borrower?.name ?? 'Desconocido',
            dispatched_by_name: dispatcher?.name ?? 'Sistema',
            items_count: items.length,
            pending_items_count: items.filter((i) => i.pending_quantity > 0).length,
            is_overdue: isOverdue,
            items,
            returns: returnsGrouped,
        };
    },

    /**
     * Create a new tool loan voucher
     */
    async createToolLoan(
        data: ToolLoanBodyType,
        companyId: number,
        currentUserId: string,
        clientId?: string
    ): Promise<ToolLoanDetail> {
        const dispatchedBy = data.dispatchedBy || (await resolveEntityForUser(currentUserId, companyId));

        // Generate loan voucher code: VAL-YYYYMM-XXXX
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const [seqRow] = await db
            .select({ count: sql<number>`COUNT(*)::int` })
            .from(toolLoans)
            .where(eq(toolLoans.company_id, companyId));
        const seq = (seqRow?.count ?? 0) + 1;
        const code = `VAL-${year}${month}-${seq.toString().padStart(4, '0')}`;

        const createdLoan = await db.transaction(async (tx) => {
            const [loan] = await tx
                .insert(toolLoans)
                .values({
                    company_id: companyId,
                    code,
                    borrower_id: data.borrowerId,
                    dispatched_by: dispatchedBy,
                    work_order_id: data.workOrderId ?? null,
                    destination_type: data.destinationType ?? 'WORKSHOP',
                    location_detail: data.locationDetail ?? null,
                    expected_return_date: data.expectedReturnDate,
                    status: 'DISPATCHED',
                    notes: data.notes ?? null,
                })
                .returning();

            // Insert items
            for (const item of data.items) {
                // Defensive resolution: ensure variantId maps to a valid product_variants.id
                let resolvedVariantId = item.variantId;
                const [v] = await tx
                    .select({ id: productVariants.id })
                    .from(productVariants)
                    .where(eq(productVariants.id, item.variantId));
                if (!v) {
                    const [defV] = await tx
                        .select({ id: productVariants.id })
                        .from(productVariants)
                        .where(and(eq(productVariants.product_id, item.variantId), eq(productVariants.is_default, true)));
                    if (defV) {
                        resolvedVariantId = defV.id;
                    } else {
                        throw new DomainError(`No se encontró variante válida para el producto/variante ${item.variantId}`, 400);
                    }
                }

                await tx.insert(toolLoanItems).values({
                    loan_id: loan.id,
                    variant_id: resolvedVariantId,
                    tool_item_id: item.toolItemId ?? null,
                    quantity_loaned: item.quantityLoaned.toString(),
                    quantity_returned: '0',
                    notes: item.notes ?? null,
                });

                // Update physical tool item status if serialized
                if (item.toolItemId) {
                    await tx
                        .update(toolItems)
                        .set({ status: 'ON_LOAN', updated_at: new Date() })
                        .where(eq(toolItems.id, item.toolItemId));
                }
            }

            return loan;
        });

        await cacheService.invalidate(`tools:c${companyId}:*`);
        broadcastToTenant(
            companyId,
            RealtimeEvents.ENTITY.CREATED,
            { type: 'tool_loan', id: createdLoan.id, entity: createdLoan, clientId },
            RealtimeEvents.ROOMS.INVENTORY
        );

        return this.getToolLoan(createdLoan.id, companyId);
    },

    /**
     * Record a tool return with physical inspection (condition GOOD | DAMAGED | UNUSABLE)
     */
    async recordToolReturn(
        loanId: number,
        data: ToolReturnBodyType,
        companyId: number,
        currentUserId: string,
        clientId?: string
    ): Promise<ToolLoanDetail> {
        const [loan] = await db
            .select()
            .from(toolLoans)
            .where(and(eq(toolLoans.id, loanId), eq(toolLoans.company_id, companyId)));

        if (!loan) throw new DomainError('Préstamo de herramientas no encontrado', 404);
        if (loan.status === 'COMPLETED') throw new DomainError('Este préstamo ya fue devuelto en su totalidad', 400);
        if (loan.status === 'CANCELLED') throw new DomainError('Este préstamo se encuentra cancelado', 400);

        const receivedBy = data.receivedBy || (await resolveEntityForUser(currentUserId, companyId));

        await db.transaction(async (tx) => {
            // 1. Create return header
            const [ret] = await tx
                .insert(toolReturns)
                .values({
                    loan_id: loanId,
                    received_by: receivedBy,
                    notes: data.notes ?? null,
                })
                .returning();

            // 2. Process each returned item
            for (const item of data.items) {
                const [loanItem] = await tx
                    .select()
                    .from(toolLoanItems)
                    .where(and(eq(toolLoanItems.id, item.loanItemId), eq(toolLoanItems.loan_id, loanId)));

                if (!loanItem) throw new DomainError(`Ítem de préstamo ${item.loanItemId} no válido`, 400);

                const currentReturned = Number(loanItem.quantity_returned);
                const newlyReturned = item.quantityReturned;
                const totalLoaned = Number(loanItem.quantity_loaned);

                if (currentReturned + newlyReturned > totalLoaned + 0.0001) {
                    throw new DomainError(`La cantidad devuelta excede la cantidad prestada para el ítem ${item.loanItemId}`, 400);
                }

                // Update quantity_returned on loan item
                await tx
                    .update(toolLoanItems)
                    .set({
                        quantity_returned: (currentReturned + newlyReturned).toString(),
                    })
                    .where(eq(toolLoanItems.id, item.loanItemId));

                // Insert inspection line
                await tx.insert(toolReturnItems).values({
                    return_id: ret.id,
                    loan_item_id: item.loanItemId,
                    quantity_returned: item.quantityReturned.toString(),
                    condition: item.condition ?? 'GOOD',
                    damage_notes: item.damageNotes ?? null,
                    requires_maintenance: item.requiresMaintenance ?? false,
                });

                // Update physical tool item if serialized
                if (loanItem.tool_item_id) {
                    const nextStatus = item.requiresMaintenance ? 'IN_MAINTENANCE' : 'AVAILABLE';
                    await tx
                        .update(toolItems)
                        .set({
                            status: nextStatus,
                            condition: item.condition ?? 'GOOD',
                            updated_at: new Date(),
                        })
                        .where(eq(toolItems.id, loanItem.tool_item_id));
                }
            }

            // 3. Re-evaluate loan status
            const allItems = await tx
                .select({
                    loaned: toolLoanItems.quantity_loaned,
                    returned: toolLoanItems.quantity_returned,
                })
                .from(toolLoanItems)
                .where(eq(toolLoanItems.loan_id, loanId));

            const isAllCompleted = allItems.every(
                (i) => Number(i.returned) >= Number(i.loaned)
            );

            await tx
                .update(toolLoans)
                .set({
                    status: isAllCompleted ? 'COMPLETED' : 'PARTIALLY_RETURNED',
                    actual_return_date: isAllCompleted ? new Date() : null,
                    updated_at: new Date(),
                })
                .where(eq(toolLoans.id, loanId));
        });

        await cacheService.invalidate(`tools:c${companyId}:*`);
        broadcastToTenant(
            companyId,
            RealtimeEvents.ENTITY.UPDATED,
            { type: 'tool_loan', id: loanId, clientId },
            RealtimeEvents.ROOMS.INVENTORY
        );

        return this.getToolLoan(loanId, companyId);
    },

    /**
     * Report all active tools currently in custody of an employee
     */
    async listEmployeeCustody(employeeId: string, companyId: number): Promise<EmployeeCustodySummary> {
        const [emp] = await db
            .select({ name: entities.business_name })
            .from(entities)
            .where(and(eq(entities.id, employeeId), eq(entities.company_id, companyId)));

        if (!emp) throw new DomainError('Empleado no encontrado', 404);

        const rows = await db
            .select({
                loanId: toolLoans.id,
                loanCode: toolLoans.code,
                loanDate: toolLoans.loan_date,
                expectedReturnDate: toolLoans.expected_return_date,
                status: toolLoans.status,
                variantId: productVariants.id,
                variantName: sql<string>`COALESCE(${productVariants.variant_name}, ${products.name})`,
                sku: productVariants.sku,
                productName: products.name,
                quantityLoaned: toolLoanItems.quantity_loaned,
                quantityReturned: toolLoanItems.quantity_returned,
            })
            .from(toolLoans)
            .innerJoin(toolLoanItems, eq(toolLoans.id, toolLoanItems.loan_id))
            .innerJoin(productVariants, eq(toolLoanItems.variant_id, productVariants.id))
            .innerJoin(products, eq(productVariants.product_id, products.id))
            .where(
                and(
                    eq(toolLoans.company_id, companyId),
                    eq(toolLoans.borrower_id, employeeId),
                    or(
                        eq(toolLoans.status, 'DISPATCHED'),
                        eq(toolLoans.status, 'PARTIALLY_RETURNED'),
                        eq(toolLoans.status, 'OVERDUE')
                    )
                )
            )
            .orderBy(desc(toolLoans.expected_return_date));

        const now = new Date();
        const items = rows
            .map((r) => {
                const loaned = Number(r.quantityLoaned);
                const returned = Number(r.quantityReturned);
                const pending = Math.max(0, loaned - returned);
                const isOverdue = new Date(r.expectedReturnDate) < now;
                return {
                    loanId: r.loanId,
                    loanCode: r.loanCode,
                    loanDate: r.loanDate,
                    expectedReturnDate: r.expectedReturnDate,
                    isOverdue,
                    variantId: r.variantId,
                    variantName: r.variantName,
                    sku: r.sku,
                    productName: r.productName,
                    quantityLoaned: loaned,
                    quantityReturned: returned,
                    quantityPending: pending,
                };
            })
            .filter((i) => i.quantityPending > 0);

        const uniqueLoanIds = new Set(items.map((i) => i.loanId));
        const overdueLoanIds = new Set(items.filter((i) => i.isOverdue).map((i) => i.loanId));

        return {
            employeeId,
            employeeName: emp.name,
            activeLoansCount: uniqueLoanIds.size,
            totalToolsInCustody: items.reduce((sum, i) => sum + i.quantityPending, 0),
            overdueLoansCount: overdueLoanIds.size,
            items,
        };
    },
};
