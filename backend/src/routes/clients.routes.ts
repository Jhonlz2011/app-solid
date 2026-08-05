import { createEntityRoutes } from './entities.routes';

/**
 * Routes for managing Client entities.
 * Generated dynamically using the generic entity routes factory.
 */
export const clientRoutes = createEntityRoutes({
    prefix: '/clients',
    type: 'client',
    permission: 'clients'
});
