/**
 * useEntityQueries.ts
 *
 * Form-level queries and quick-create mutations for auxiliary entities (Departments & Job Titles).
 */
import type { Accessor } from 'solid-js';
import { useQueryClient, createQuery, createMutation } from '@tanstack/solid-query';
import { toast } from 'solid-sonner';
import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import { STALE_TIME } from '@shared/constants/cache.constants';
import type { EntityFormApi } from '../entity-form.types';

export function useEntityQueries(form: EntityFormApi, enabled: Accessor<boolean>) {
    const queryClient = useQueryClient();

    // =========================================================================
    // Queries
    // =========================================================================
    const departmentsQuery = createQuery(() => ({
        queryKey: ['entities', 'departments'],
        queryFn: async () => {
            const { data, error } = await api.entities.departments.get();
            if (error) throwApiError(error);
            return (data || []) as Array<{ id: number; name: string; code?: string | null; is_active: boolean }>;
        },
        staleTime: STALE_TIME.MEDIUM,
        enabled: enabled(),
    }));

    const jobTitlesQuery = createQuery(() => ({
        queryKey: ['entities', 'job-titles'],
        queryFn: async () => {
            const { data, error } = await api.entities['job-titles'].get({ query: {} });
            if (error) throwApiError(error);
            return (data || []) as Array<{ id: number; name: string; department_id?: number | null; is_active: boolean }>;
        },
        staleTime: STALE_TIME.MEDIUM,
        enabled: enabled(),
    }));

    // =========================================================================
    // Mutations
    // =========================================================================
    const createDeptMutation = createMutation(() => ({
        mutationFn: async (name: string) => {
            const { data, error } = await api.entities.departments.post({ name });
            if (error) throwApiError(error);
            return data!;
        },
        onSuccess: (newDept) => {
            queryClient.invalidateQueries({ queryKey: ['entities', 'departments'] });
            form.setFieldValue('employeeDetails.departmentId', newDept.id);
            toast.success(`Departamento "${newDept.name}" creado`);
        },
    }));

    const createJobTitleMutation = createMutation(() => ({
        mutationFn: async (name: string) => {
            const deptId = form.getFieldValue('employeeDetails.departmentId');
            const { data, error } = await api.entities['job-titles'].post({ name, departmentId: deptId ?? undefined });
            if (error) throwApiError(error);
            return data!;
        },
        onSuccess: (newJob) => {
            queryClient.invalidateQueries({ queryKey: ['entities', 'job-titles'] });
            form.setFieldValue('employeeDetails.jobTitleId', newJob.id);
            toast.success(`Cargo "${newJob.name}" creado`);
        },
    }));

    // =========================================================================
    // Helpers & Option Selectors
    // =========================================================================
    const departmentOptions = () => (departmentsQuery.data || []).map((d) => ({ value: d.id, label: d.name }));

    const getJobTitleOptions = (deptId?: number | null) => {
        const all = jobTitlesQuery.data || [];
        const filtered = deptId ? all.filter((j) => !j.department_id || j.department_id === deptId) : all;
        return filtered.map((j) => ({ value: j.id, label: j.name }));
    };

    const handleCreateDepartment = (name: string) => {
        if (name && name.trim()) {
            createDeptMutation.mutate(name.trim());
        }
    };

    const handleCreateJobTitle = (name: string) => {
        if (name && name.trim()) {
            createJobTitleMutation.mutate(name.trim());
        }
    };

    return {
        departmentsQuery,
        jobTitlesQuery,
        departmentOptions,
        getJobTitleOptions,
        createDeptMutation,
        createJobTitleMutation,
        handleCreateDepartment,
        handleCreateJobTitle,
    };
}

export type EntityFormQueries = ReturnType<typeof useEntityQueries>;
