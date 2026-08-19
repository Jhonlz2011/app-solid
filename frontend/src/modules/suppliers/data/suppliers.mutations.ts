import { api } from '@shared/lib/eden';
import { createEntityMutations } from '@modules/entities/data/entities.mutations';
import { suppliersApi } from './suppliers.api';
import { supplierKeys } from './suppliers.keys';

export const supplierMutations = createEntityMutations(suppliersApi, supplierKeys, api.suppliers);

export const useCreateSupplier = supplierMutations.useCreate;
export const useUpdateSupplier = supplierMutations.useUpdate;
export const useDeleteSupplier = supplierMutations.useDelete;
export const useBulkDeleteSupplier = supplierMutations.useBulkDelete;
export const useBulkRestoreSupplier = supplierMutations.useBulkRestore;
export const useRestoreSupplier = supplierMutations.useRestore;
export const useHardDeleteSupplier = supplierMutations.useHardDelete;
