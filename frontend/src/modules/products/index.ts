// products/index.ts
// Barrel exports for the products module

// Data layer
export * from './data/products.api';
export * from './data/products.keys';
export * from './data/products.queries';

// Types
export * from './models/products.type';

// Components
export { ProductClassBadge } from './components/ProductClassBadge';
export { HasPermission } from '../auth/components/HasPermission';
