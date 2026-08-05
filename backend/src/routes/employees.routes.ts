import { createEntityRoutes } from './entities.routes';

/**
 * Routes for managing Employee entities.
 * Generated dynamically using the generic entity routes factory.
 */
export const employeeRoutes = createEntityRoutes({
    prefix: '/employees',
    type: 'employee',
    permission: 'employees'
});
