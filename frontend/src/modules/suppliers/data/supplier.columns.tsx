import { Show } from 'solid-js';
import { Link } from '@tanstack/solid-router';
import type { ColumnDef } from '@tanstack/solid-table';
import type { SupplierListItem } from '../data/suppliers.api';
import { Badge } from '@shared/ui/Badge';
import { DataTableColumnHeader } from '@shared/ui/DataTable/DataTableColumnHeader';
import type { ColumnFilterConfig } from '@modules/entities/data/createEntityColumns';
import { createBaseEntityColumns } from '@modules/entities/data/createEntityColumns';

export interface SupplierColumnHandlers {
    onDelete: (supplier: SupplierListItem) => void;
    onRestore: (supplier: SupplierListItem) => void;
    filters?: {
        businessName?: ColumnFilterConfig;
        taxIdType?: ColumnFilterConfig;
        personType?: ColumnFilterConfig;
        isActive?: ColumnFilterConfig;
    };
}

export function createSupplierColumns(handlers: SupplierColumnHandlers): ColumnDef<SupplierListItem>[] {
    const base = createBaseEntityColumns<SupplierListItem>({
        ...handlers,
        baseRoute: 'suppliers',
    });
    return [
        base.select,
        base.businessName,
        base.taxId,
        {
            accessorKey: 'person_type',
            header: ({ column }) => (
                <DataTableColumnHeader
                    column={column}
                    title="Tipo"
                    filterOptions={handlers.filters?.personType?.options()}
                    selectedFilters={handlers.filters?.personType?.selected()}
                    onFilterChange={handlers.filters?.personType?.onChange}
                    isFilterLoading={handlers.filters?.personType?.isLoading?.()}
                />
            ),
            meta: { title: 'Tipo de Persona' },
            size: 120,
            cell: (info) => {
                const type = info.getValue<string>();
                const isJuridica = type === 'JURIDICA';
                return (
                    <Badge
                        variant={isJuridica ? 'primary' : 'info'}
                        class="text-[11px] uppercase tracking-wider border-primary/20"
                    >
                        {isJuridica ? 'Jurídica' : 'Natural'}
                    </Badge>
                );
            },
        },
        base.fiscal,
        base.contactInfo,
        base.isActive,
        base.actions,
    ];
}
