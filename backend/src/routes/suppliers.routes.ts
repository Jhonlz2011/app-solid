import { createEntityRoutes } from './entities.routes';

/**
 * Routes for managing Supplier entities.
 * Generated dynamically using the generic entity routes factory.
 */
export const supplierRoutes = createEntityRoutes({
    prefix: '/suppliers',
    type: 'supplier',
    permission: 'suppliers'
});
