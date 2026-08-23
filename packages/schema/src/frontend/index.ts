// ============================================================================
// FRONTEND SCHEMAS & FORM VALIDATION — Modular Valibot Layer for SolidJS
// ============================================================================

// Re-export enum types for frontend convenience
export { type TaxIdEnum, type TaxIdTypeForm, type PersonType, type TaxRegimeType } from '../enums';
export { type RbacModule, type RbacAction, type PermissionSlug } from '../enums';
export { type ProductType, type ProductSubtype } from '../enums';
export { TAX_ID_TYPES_FORM, PRODUCT_TYPES, PRODUCT_SUBTYPES, ATTRIBUTE_DATA_TYPES, UOM_GROUPS, LOCATION_TYPES } from '../enums';
export { type AttributeDataType, type UomGroup } from '../enums';

// Domain-Specific Valibot Form Schemas
export * from './products.schema';
export * from './catalog.schema';
export * from './entities.schema';
export * from './inventory.schema';
export * from './auth.schema';
export * from './users.schema';
export * from './profile.schema';
export * from './settings.schema';
