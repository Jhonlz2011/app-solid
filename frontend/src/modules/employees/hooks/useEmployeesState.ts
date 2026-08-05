import { createSignal, createMemo, batch } from 'solid-js';
import { useQueryClient } from '@tanstack/solid-query';
import { useNavigate } from '@tanstack/solid-router';
import { toast } from 'solid-sonner';
import { copyToClipboard } from '@shared/utils/clipboard';
import { buildFilterOptions } from '@shared/utils/facets.utils';
import { isActiveLabels } from '@shared/constants/labels';
import { taxIdTypeLabels, personTypeLabels } from '../models/employee.types';
import { useDataTable } from '@shared/hooks/useDataTable';
import { useDataTableSSE, useRealtimeInvalidation } from '@shared/hooks/useDataTableSSE';
import { useAuth } from '@/modules/auth/store/auth.store';

import {
    useEmployees,
    useEmployeeFacets,
} from '../data/employees.queries';
import {
    useDeleteEmployee,
    useBulkDeleteEmployee,
    useBulkRestoreEmployee,
    useRestoreEmployee,
} from '../data/employees.mutations';
import { employeeKeys } from '../data/employees.keys';
import { employeesApi, type EmployeeListItem } from '../data/employees.api';
import type { EmployeeFilters } from '../models/employee.types';
import { createEmployeeColumns } from '../data/employee.columns';

export function useEmployeesState() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const auth = useAuth();

    const [personTypeFilter, setPersonTypeFilter] = createSignal<string[]>([]);
    const [taxIdTypeFilter, setTaxIdTypeFilter] = createSignal<string[]>([]);
    const [isActiveFilter, setIsActiveFilter] = createSignal<string[]>([]);
    const [businessNameFilter, setBusinessNameFilter] = createSignal<string[]>([]);
    const [showFilterSheet, setShowFilterSheet] = createSignal(false);

    const [deleteTarget, setDeleteTarget] = createSignal<EmployeeListItem | null>(null);
    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = createSignal(false);
    const [showBulkRestoreConfirm, setShowBulkRestoreConfirm] = createSignal(false);

    useDataTableSSE({ room: 'employees', queryKey: employeeKeys.lists() });
    useRealtimeInvalidation([...employeeKeys.all, 'facets']);

    let getQueryData = () => [] as EmployeeListItem[];
    let getQueryMeta = () => undefined as any;

    const tableState = useDataTable<EmployeeListItem>({
        data: () => getQueryData(),
        meta: () => getQueryMeta(),
        isCursorBased: true
    });

    const filters = (): EmployeeFilters => ({
        cursor: tableState.isSortedMode() ? undefined : tableState.cursor(),
        direction: tableState.isSortedMode() ? undefined : tableState.direction(),
        sortBy: tableState.sortBy(),
        sortOrder: tableState.sortOrder(),
        page: tableState.isSortedMode() ? tableState.page() : undefined,
        limit: tableState.pageSize(),
        search: tableState.search() || undefined,
        personType: personTypeFilter().length > 0 ? personTypeFilter() : undefined,
        taxIdType: taxIdTypeFilter().length > 0 ? taxIdTypeFilter() : undefined,
        isActive: isActiveFilter().length > 0 ? isActiveFilter() : undefined,
        businessName: businessNameFilter().length > 0 ? businessNameFilter() : undefined,
    });

    const employeesQuery = useEmployees(filters);
    getQueryData = () => employeesQuery.data?.data ?? [];
    getQueryMeta = () => employeesQuery.data?.meta;
    const facetsQuery = useEmployeeFacets(
        () => tableState.search() || undefined,
        () => ({
            personType: personTypeFilter().length > 0 ? personTypeFilter() : undefined,
            taxIdType: taxIdTypeFilter().length > 0 ? taxIdTypeFilter() : undefined,
            isActive: isActiveFilter().length > 0 ? isActiveFilter() : undefined,
            businessName: businessNameFilter().length > 0 ? businessNameFilter() : undefined,
        })
    );

    const deleteMutation = useDeleteEmployee();
    const bulkRestoreMutation = useBulkRestoreEmployee();
    const bulkDeleteMutation = useBulkDeleteEmployee();
    const restoreMutation = useRestoreEmployee();

    const employees = () => employeesQuery.data?.data ?? [];
    const meta = () => employeesQuery.data?.meta;

    const selectedActiveCount = () => tableState.selectedItems().filter(s => s.is_active).length;
    const selectedInactiveCount = () => tableState.selectedItems().filter(s => !s.is_active).length;

    const handleClosePanel = () => navigate({ to: '.', search: (prev: any) => ({ ...prev, panel: undefined, id: undefined, from: undefined }) } as any);
    const handlePrefetch = (s: EmployeeListItem) => {
        queryClient.prefetchQuery({
            queryKey: employeeKeys.detail(s.id),
            queryFn: () => employeesApi.get(s.id),
            staleTime: 1000 * 60 * 5,
        });
    };

    const handleCopySelection = async () => {
        const selected = tableState.selectedItems();
        if (selected.length === 0) return;
        const text = selected.map(s => {
            const parts = [
                `Nombre: ${s.business_name} (${s.tax_id})`,
                s.email_billing ? `Correo: ${s.email_billing}` : null,
                s.phone ? `Tel: ${s.phone}` : null,
            ].filter(Boolean);
            return parts.join(' | ');
        }).join('\n');
        const ok = await copyToClipboard(text);
        if (ok) toast.success(`Copiado ${selected.length} empleados al portapapeles`);
        else toast.error('Error al copiar al portapapeles');
        tableState.setRowSelection({});
    };

    const handleDelete = (employee: EmployeeListItem) => setDeleteTarget(employee);

    const handleRestore = (employee: EmployeeListItem) => {
        restoreMutation.mutate(employee.id, {
            onSuccess: () => toast.success(`Se ha restaurado '${employee.business_name}'`),
            onError: (err: any) => toast.error(err.message || 'Error al restaurar'),
        });
    };

    const handleBulkDelete = () => setShowBulkDeleteConfirm(true);

    const confirmBulkDelete = () => {
        const ids = tableState.selectedItems().filter(s => s.is_active).map(s => s.id);
        if (ids.length === 0) return;
        bulkDeleteMutation.mutate(ids, {
            onSuccess: () => { toast.success(`${ids.length} empleados eliminados`); tableState.setRowSelection({}); setShowBulkDeleteConfirm(false); },
            onError: (err: any) => toast.error(err.message || 'Error al eliminar'),
        });
    };

    const confirmBulkRestore = () => {
        const ids = tableState.selectedItems().filter(s => !s.is_active).map(s => s.id);
        if (ids.length === 0) return;
        bulkRestoreMutation.mutate(ids, {
            onSuccess: () => { toast.success(`${ids.length} empleados restaurados`); tableState.setRowSelection({}); setShowBulkRestoreConfirm(false); },
            onError: (err: any) => toast.error(err.message || 'Error al restaurar'),
        });
    };

    const handleFilterChange = (setter: (v: string[]) => void) => (selected: string[]) => {
        batch(() => { setter(selected); tableState.setCursor(undefined); tableState.setDirection('first'); });
    };

    const businessNameFilterOptions = createMemo(() => buildFilterOptions(facetsQuery.data, 'business_name'));
    const taxIdTypeFilterOptions = createMemo(() => buildFilterOptions(facetsQuery.data, 'tax_id_type', taxIdTypeLabels));
    const personTypeFilterOptions = createMemo(() => buildFilterOptions(facetsQuery.data, 'person_type', personTypeLabels));
    const isActiveFilterOptions = createMemo(() => buildFilterOptions(facetsQuery.data, 'is_active', isActiveLabels));

    const columns = createMemo(() =>
        createEmployeeColumns({
            onDelete: handleDelete,
            onRestore: handleRestore,
            auth,
            filters: {
                businessName: { options: businessNameFilterOptions, selected: businessNameFilter, onChange: handleFilterChange(setBusinessNameFilter), isLoading: () => facetsQuery.isPending },
                taxIdType: { options: taxIdTypeFilterOptions, selected: taxIdTypeFilter, onChange: handleFilterChange(setTaxIdTypeFilter), isLoading: () => facetsQuery.isPending },
                personType: { options: personTypeFilterOptions, selected: personTypeFilter, onChange: handleFilterChange(setPersonTypeFilter), isLoading: () => facetsQuery.isPending },
                isActive: { options: isActiveFilterOptions, selected: isActiveFilter, onChange: handleFilterChange(setIsActiveFilter), isLoading: () => facetsQuery.isPending },
            },
        })
    );

    return {
        ...tableState,
        auth, handleClosePanel,
        showFilterSheet, setShowFilterSheet, deleteTarget, setDeleteTarget,
        showBulkDeleteConfirm, setShowBulkDeleteConfirm, showBulkRestoreConfirm, setShowBulkRestoreConfirm,
        employeesQuery, facetsQuery, employees, meta,
        selectedActiveCount, selectedInactiveCount,
        deleteMutation, bulkDeleteMutation, bulkRestoreMutation,
        handlePrefetch, handleCopySelection, handleDelete, handleRestore, handleBulkDelete,
        confirmBulkDelete, confirmBulkRestore, handleFilterChange, filters,
        columns,
        filterSheetConfig: {
            personType: { options: personTypeFilterOptions, selected: personTypeFilter, onChange: handleFilterChange(setPersonTypeFilter), isLoading: () => facetsQuery.isPending },
            taxIdType: { options: taxIdTypeFilterOptions, selected: taxIdTypeFilter, onChange: handleFilterChange(setTaxIdTypeFilter), isLoading: () => facetsQuery.isPending },
            isActive: { options: isActiveFilterOptions, selected: isActiveFilter, onChange: handleFilterChange(setIsActiveFilter), isLoading: () => facetsQuery.isPending },
            businessName: { options: businessNameFilterOptions, selected: businessNameFilter, onChange: handleFilterChange(setBusinessNameFilter), isLoading: () => facetsQuery.isPending },
        },
        hasActiveFilters: () => personTypeFilter().length > 0 || taxIdTypeFilter().length > 0 || isActiveFilter().length > 0 || businessNameFilter().length > 0,
    };
}

export type EmployeesState = ReturnType<typeof useEmployeesState>;
