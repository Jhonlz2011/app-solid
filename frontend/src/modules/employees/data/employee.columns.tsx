import { Show } from 'solid-js';
import { Link } from '@tanstack/solid-router';
import type { ColumnDef } from '@tanstack/solid-table';
import type { EmployeeListItem } from '../data/employees.api';
import { DataTableColumnHeader } from '@shared/ui/DataTable/DataTableColumnHeader';
import { createBaseEntityColumns, type BaseEntityHandlers } from '@modules/entities/data/createEntityColumns';

export type EmployeeColumnHandlers = BaseEntityHandlers<EmployeeListItem>;

export interface EmployeeListItemWithDetails extends EmployeeListItem {
    employeeDetails?: {
        department_name?: string | null;
        department_id?: number | null;
        job_title_name?: string | null;
        job_title_id?: number | null;
        salary_base?: string | number | null;
        hire_date?: string | null;
        cost_per_hour?: string | number | null;
    } | null;
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
                    isFilterLoading={handlers.filters?.businessName?.isLoading?.()}
                />
            ),
            meta: { title: 'Empleado' },
            size: 210,
            cell: (info) => {
                const item = info.row.original as EmployeeListItemWithDetails;
                const jobTitle = item.employeeDetails?.job_title_name;
                return (
                    <Link
                        to={`/employees/${item.id}/show`}
                        preload="intent"
                        class="min-w-0 block cursor-pointer group/cell"
                        title={info.getValue<string>()}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div class="font-medium text-text truncate group-hover/cell:text-primary transition-colors duration-150">
                            {info.getValue<string>()}
                        </div>
                        <Show when={jobTitle}>
                            <div class="text-xs text-muted truncate">
                                {jobTitle}
                            </div>
                        </Show>
                    </Link>
                );
            },
        },
        base.taxId,
        base.contactInfo,
        {
            id: 'department',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Departamento" />,
            meta: { title: 'Departamento' },
            size: 160,
            cell: (info) => {
                const item = info.row.original as EmployeeListItemWithDetails;
                const dept = item.employeeDetails?.department_name || '-';
                return (
                    <div class="min-w-0">
                        <div class="text-sm truncate">{dept}</div>
                    </div>
                );
            },
        },
        base.isActive,
        base.actions,
    ];
}
