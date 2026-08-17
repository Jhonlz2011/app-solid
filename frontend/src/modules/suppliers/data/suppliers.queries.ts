import { api } from '@shared/lib/eden';
import { createEntityQueries } from '@modules/entities/data/entities.queries';
import { suppliersApi } from './suppliers.api';
import { supplierKeys } from './suppliers.keys';

export const supplierQueries = createEntityQueries(suppliersApi, supplierKeys, api.api.suppliers.facets);

export const useSuppliers = supplierQueries.useList;
export const useInfiniteSuppliers = supplierQueries.useInfinite;
export const useSupplierFacets = supplierQueries.useFacets;
export const useSupplier = supplierQueries.useDetail;
export const useCheckSupplierReferences = supplierQueries.useCheckReferences;