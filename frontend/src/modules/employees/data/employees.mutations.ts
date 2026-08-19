import { api } from '@shared/lib/eden';
import { createEntityMutations } from '@modules/entities/data/entities.mutations';
import { employeesApi } from './employees.api';
import { employeeKeys } from './employees.keys';

export const employeeMutations = createEntityMutations(employeesApi, employeeKeys, api.employees);

export const useCreateEmployee = employeeMutations.useCreate;
export const useUpdateEmployee = employeeMutations.useUpdate;
export const useDeleteEmployee = employeeMutations.useDelete;
export const useBulkDeleteEmployee = employeeMutations.useBulkDelete;
export const useBulkRestoreEmployee = employeeMutations.useBulkRestore;
export const useRestoreEmployee = employeeMutations.useRestore;
export const useHardDeleteEmployee = employeeMutations.useHardDelete;
