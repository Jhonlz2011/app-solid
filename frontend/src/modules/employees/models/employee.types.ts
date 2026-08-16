/**
 * employee.types.ts — Employee domain types and API response types
 */
import { employeesApi } from '../data/employees.api';

export type { EntityFilters as EmployeeFilters, EntityReferences as EmployeeReferences } from '@app/schema/dto';
export { taxIdTypeLabels, personTypeLabels, taxRegimeTypeLabels } from '@modules/entities/models/entity.types';

export type Employee = Awaited<ReturnType<typeof employeesApi.get>>;
export type EmployeesResponse = Awaited<ReturnType<typeof employeesApi.list>>;
