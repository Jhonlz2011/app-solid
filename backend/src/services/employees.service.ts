import { createEntityService } from './entities.service';

/**
 * Service for managing Employee entities.
 * Uses the generic entity service factory to provide standard CRUD operations.
 */
export const employeesService = createEntityService('employee');

