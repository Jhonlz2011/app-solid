import { createEntityService } from './entities.service';

/**
 * Service for managing Client entities.
 * Uses the generic entity service factory to provide standard CRUD operations.
 */
export const clientsService = createEntityService('client');
