import type { ColumnDef } from '@tanstack/solid-table';
import type { ClientListItem } from '../data/clients.api';
import { createBaseEntityColumns, type BaseEntityHandlers } from '@modules/entities/data/createEntityColumns';

export type ClientColumnHandlers = BaseEntityHandlers<ClientListItem>;

export function createClientColumns(handlers: ClientColumnHandlers): ColumnDef<ClientListItem>[] {
    const base = createBaseEntityColumns<ClientListItem>({
        ...handlers,
        baseRoute: 'clients',
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
