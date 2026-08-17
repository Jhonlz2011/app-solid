import type { ColumnDef } from '@tanstack/solid-table';
import type { SupplierListItem } from '../data/suppliers.api';
import { createBaseEntityColumns, type BaseEntityHandlers } from '@modules/entities/data/createEntityColumns';

export type SupplierColumnHandlers = BaseEntityHandlers<SupplierListItem>;

export function createSupplierColumns(handlers: SupplierColumnHandlers): ColumnDef<SupplierListItem>[] {
    const base = createBaseEntityColumns<SupplierListItem>({
        ...handlers,
        baseRoute: 'suppliers',
    });
    return [
        base.select,
        base.businessName,
        base.taxId,
        base.personType,
        base.fiscal,
        base.contactInfo,
        base.isActive,
        base.actions,
    ];
}
