import { api } from '@shared/lib/eden';
import { createEntityQueries } from '@modules/entities/data/entities.queries';
import { employeesApi } from './employees.api';
import { employeeKeys } from './employees.keys';

export const employeeQueries = createEntityQueries(employeesApi, employeeKeys, api.employees.facets);

export const useEmployees = employeeQueries.useList;
export const useInfiniteEmployees = employeeQueries.useInfinite;
export const useEmployeeFacets = employeeQueries.useFacets;
export const useEmployee = employeeQueries.useDetail;
export const useCheckEmployeeReferences = employeeQueries.useCheckReferences;
