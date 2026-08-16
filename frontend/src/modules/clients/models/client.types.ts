/**
 * client.types.ts — Client domain types and API response types
 */
import { clientsApi } from '../data/clients.api';

export type { EntityFilters as ClientFilters, EntityReferences as ClientReferences } from '@app/schema/dto';
export { taxIdTypeLabels, personTypeLabels, taxRegimeTypeLabels } from '@modules/entities/models/entity.types';

export type Client = Awaited<ReturnType<typeof clientsApi.get>>;
export type ClientsResponse = Awaited<ReturnType<typeof clientsApi.list>>;