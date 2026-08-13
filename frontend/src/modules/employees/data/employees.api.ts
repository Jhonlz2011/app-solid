/**
 * employees.api.ts — Export generic API for employees
 */
import { api } from '@shared/lib/eden';
import { createEntityApi } from '@modules/entities/data/entities.api';

export const employeesApi = createEntityApi(api.api.employees);

export type EmployeeListItem = Awaited<ReturnType<typeof employeesApi.list>>['data'][number];
