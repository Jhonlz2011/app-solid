/**
 * supplier.types.ts — Supplier domain types and API response types
 */
import { suppliersApi } from '../data/suppliers.api';

export type { EntityFilters as SupplierFilters, EntityReferences as SupplierReferences } from '@app/schema/dto';
export { taxIdTypeLabels, personTypeLabels, taxRegimeTypeLabels } from '@modules/entities/models/entity.types';

export type Supplier = Awaited<ReturnType<typeof suppliersApi.get>>;
export type SuppliersResponse = Awaited<ReturnType<typeof suppliersApi.list>>;