import { Show } from 'solid-js';
import { Link } from '@tanstack/solid-router';
import type { ColumnDef } from '@tanstack/solid-table';
import type { EmployeeListItem } from '../data/employees.api';
import { DataTableColumnHeader } from '@shared/ui/DataTable/DataTableColumnHeader';
import type { ColumnFilterConfig } from '@modules/entities/data/createEntityColumns';
import { createBaseEntityColumns } from '@modules/entities/data/createEntityColumns';

export interface EmployeeColumnHandlers {
    onDelete: (employee: EmployeeListItem) => void;
    onRestore: (employee: EmployeeListItem) => void;
    filters?: {
        businessName?: ColumnFilterConfig;
        taxIdType?: ColumnFilterConfig;
        personType?: ColumnFilterConfig;
        isActive?: ColumnFilterConfig;
    };
}

export function createEmployeeColumns(handlers: EmployeeColumnHandlers): ColumnDef<EmployeeListItem>[] {
    const base = createBaseEntityColumns<EmployeeListItem>({
        ...handlers,
        baseRoute: 'employees',
    });

    return [
        base.select,
        {
            accessorKey: 'business_name',
            header: ({ column }) => (
                <DataTableColumnHeader
                    column={column}
                    title="Empleado"
                    filterOptions={handlers.filters?.businessName?.options()}
                    selectedFilters={handlers.filters?.businessName?.selected()}
                    onFilterChange={handlers.filters?.businessName?.onChange}
                    isFilterLoading={handlers.filters?.businessName?.isLoading()}
                />
            ),
            meta: { title: 'Empleado' },
            size: 210,
            cell: (info) => (
                <Link
                    to={`/employees/${info.row.original.id}/show`}
                    preload="intent"
                    class="min-w-0 block cursor-pointer group/cell"
                    title={info.getValue<string>()}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div class="font-medium text-text truncate group-hover/cell:text-primary transition-colors duration-150">
                        {info.getValue<string>()}
                    </div>
                    <Show when={info.row.original.employeeDetails?.job_title}>
                        <div class="text-xs text-muted truncate">{info.row.original.employeeDetails?.job_title}</div>
                    </Show>
                </Link>
            ),
        },
        base.taxId,
        base.contactInfo,
        {
            accessorKey: 'employeeDetails.department',
            id: 'department',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Departamento" />,
            meta: { title: 'Departamento' },
            size: 160,
            cell: (info) => (
                <div class="min-w-0">
                    <div class="text-sm truncate">{info.row.original.employeeDetails?.department || '-'}</div>
                </div>
            ),
        },
        base.isActive,
        base.actions,
    ];
}
