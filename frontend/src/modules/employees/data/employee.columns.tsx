import { Show } from 'solid-js';
import { Link } from '@tanstack/solid-router';
import type { ColumnDef } from '@tanstack/solid-table';
import type { EmployeeListItem } from '../data/employees.api';
import { useAuth } from '@/modules/auth/store/auth.store';
import { DataTableColumnHeader } from '@shared/ui/DataTable/DataTableColumnHeader';
import type { ColumnFilterConfig } from '@modules/entities/data/createEntityColumns';
import { createBaseEntityColumns } from '@modules/entities/data/createEntityColumns';

export interface EmployeeColumnHandlers {
    onDelete: (employee: EmployeeListItem) => void;
    onRestore: (employee: EmployeeListItem) => void;
    auth: ReturnType<typeof useAuth>;
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
        permissionKey: 'employees',
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
        {
            accessorKey: 'tax_id',
            header: ({ column }) => (
                <DataTableColumnHeader
                    column={column}
                    title="Identificación"
                    filterOptions={handlers.filters?.taxIdType?.options()}
                    selectedFilters={handlers.filters?.taxIdType?.selected()}
                    onFilterChange={handlers.filters?.taxIdType?.onChange}
                    isFilterLoading={handlers.filters?.taxIdType?.isLoading()}
                />
            ),
            meta: { title: 'Identificación' },
            size: 170,
            cell: (info) => (
                <Link
                    to={`/employees/${info.row.original.id}/show`}
                    preload="intent"
                    class="block cursor-pointer group/cell"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div class="font-mono text-sm font-semibold text-primary group-hover/cell:underline underline-offset-2 transition-colors duration-150">
                        {info.getValue<string>()}
                    </div>
                    <div class="text-xs text-muted">{info.row.original.tax_id_type}</div>
                </Link>
            ),
        },
        {
            accessorKey: 'email_billing',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Contacto" />,
            meta: { title: 'Contacto' },
            size: 200,
            cell: (info) => (
                <div class="min-w-0">
                    <div class="text-sm truncate">{info.getValue<string>()}</div>
                    <div class="text-xs text-muted truncate">{info.row.original.phone}</div>
                </div>
            ),
        },
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
        {
            accessorKey: 'is_active',
            header: ({ column }) => (
                <DataTableColumnHeader
                    column={column}
                    title="Estado"
                    filterOptions={handlers.filters?.isActive?.options()}
                    selectedFilters={handlers.filters?.isActive?.selected()}
                    onFilterChange={handlers.filters?.isActive?.onChange}
                    isFilterLoading={handlers.filters?.isActive?.isLoading()}
                />
            ),
            meta: { title: 'Estado' },
            size: 120,
            cell: (info) => <StatusBadge isActive={info.getValue<boolean>()} />,
        },
        {
            id: 'actions',
            header: '',
            size: 50,
            enableHiding: false,
            cell: (info) => {
                const employee = info.row.original;
                return (
                    <ActionMenu
                        module="employees"
                        isActive={employee.is_active ?? false}
                        showTo={`/employees/${employee.id}/show`}
                        editTo={`/employees/${employee.id}/edit`}
                        onRestore={() => handlers.onRestore(employee)}
                        onDelete={() => handlers.onDelete(employee)}
                    />
                );
            },
        },
    ];
}
