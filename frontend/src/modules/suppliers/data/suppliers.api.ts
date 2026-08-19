/**
 * suppliers.api.ts — Export generic API for suppliers
 */
import { api } from '@shared/lib/eden';
import { createEntityApi } from '@modules/entities/data/entities.api';

export const suppliersApi = createEntityApi(api.suppliers);
export type SupplierListItem = Awaited<ReturnType<typeof suppliersApi.list>>['data'][number];
