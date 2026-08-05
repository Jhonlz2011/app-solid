
import { createEntityService } from './entities.service';

/**
 * Service for managing Supplier entities.
 * Uses the generic entity service factory to provide standard CRUD operations.
 */
export const suppliersService = createEntityService('supplier');