import { text, integer, boolean, timestamp, numeric, uuid, primaryKey, index, unique, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { pgTableV2, TZ, tenantPolicy } from '../utils';
import { companies } from './config';
import type { SaasAddonStatus, SaasDocumentPackStatus, SaasPaymentMethodType, SaasPlanInterval, SaasSubscriptionStatus } from '../enums';

// ============================================================================
// 1. CATÁLOGOS MAESTROS GLOBALES (Sin RLS — Disponibles para todo el sistema)
// ============================================================================

/**
 * Catálogo Maestro de Planes SaaS
 */
export const saasPlans = pgTableV2("saas_plans", {
    id: text("id").primaryKey(), // 'free', 'starter_monthly', 'starter_yearly', 'pro_monthly', 'pro_yearly', 'enterprise_monthly', 'enterprise_yearly'
    name: text("name").notNull(),
    description: text("description").notNull(),
    interval: text("interval").$type<SaasPlanInterval>().notNull(),
    price_usd: numeric("price_usd", { precision: 10, scale: 2 }).default('0.00').notNull(),
    annual_discount_percent: integer("annual_discount_percent").default(0),
    trial_days: integer("trial_days").default(0).notNull(),
    is_popular: boolean("is_popular").default(false).notNull(),
    sort_order: integer("sort_order").default(0).notNull(),
    is_active: boolean("is_active").default(true).notNull(),
    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
    updated_at: timestamp("updated_at", TZ).defaultNow().notNull(),
}, (t) => [
    check("saas_plans_interval_check", sql`${t.interval} IN ('MONTHLY', 'YEARLY')`),
    index("idx_saas_plans_order").on(t.sort_order),
    index("idx_saas_plans_interval").on(t.interval),
]);

/**
 * Catálogo Maestro de Características y Límites (Features)
 */
export const saasFeatures = pgTableV2("saas_features", {
    code: text("code").primaryKey(), // 'max_users', 'modules.pos', 'modules.accounting', etc.
    name: text("name").notNull(),
    description: text("description").notNull(),
    type: text("type").notNull(), // 'BOOLEAN' | 'NUMERIC'
    category: text("category").notNull(), // 'core' | 'modules' | 'limits' | 'storage' | 'integrations' | 'compliance'
    unit_label: text("unit_label"), // 'docs/mes', 'usuarios', 'GB', 'cajas POS'
    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
}, (t) => [
    index("idx_saas_features_category").on(t.category),
]);

/**
 * Matriz Relacional Plan - Feature (Valores y límites asignados a cada plan)
 */
export const saasPlanFeatures = pgTableV2("saas_plan_features", {
    plan_id: text("plan_id").references(() => saasPlans.id, { onDelete: 'cascade' }).notNull(),
    feature_code: text("feature_code").references(() => saasFeatures.code, { onDelete: 'cascade' }).notNull(),
    value_boolean: boolean("value_boolean"),
    value_numeric: integer("value_numeric"), // -1 indica ILIMITADO
}, (t) => [
    primaryKey({ columns: [t.plan_id, t.feature_code] }),
    index("idx_saas_plan_features_code").on(t.feature_code),
]);

/**
 * Catálogo de Add-ons Recurrentes (Asientos extra, Almacenamiento, Cajas POS)
 */
export const saasAddons = pgTableV2("saas_addons", {
    id: text("id").primaryKey(), // 'addon_user_single', 'addon_pos_register_single', etc.
    name: text("name").notNull(),
    description: text("description").notNull(),
    addon_type: text("addon_type").notNull(), // 'USER_SEATS' | 'STORAGE_GB' | 'BRANCHES' | 'SRI_DOCUMENTS' | 'INTEGRATION' | 'POS_REGISTERS'
    billing_type: text("billing_type").notNull(), // 'RECURRING' | 'ONE_TIME'
    price_usd: numeric("price_usd", { precision: 10, scale: 2 }).notNull(),
    quantity: integer("quantity").notNull(), // Cantidad que añade (ej. 1 usuario, 10 GB)
    unit_label: text("unit_label").notNull(), // 'usuario adicional', 'caja POS'
    validity_days: integer("validity_days"), // null = no expira; 365 = 1 año
    is_popular: boolean("is_popular").default(false).notNull(),
    sort_order: integer("sort_order").default(0).notNull(),
    is_active: boolean("is_active").default(true).notNull(),
    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
}, (t) => [
    index("idx_saas_addons_type").on(t.addon_type),
]);

/**
 * Catálogo de Paquetes Prepago de Comprobantes Electrónicos SRI (One-Time)
 */
export const saasDocumentPackages = pgTableV2("saas_document_packages", {
    id: text("id").primaryKey(), // 'pack_10_docs', 'pack_50_docs', 'pack_100_docs', etc.
    name: text("name").notNull(),
    description: text("description").notNull(),
    document_count: integer("document_count").notNull(),
    price_usd: numeric("price_usd", { precision: 10, scale: 2 }).notNull(),
    unit_cost_usd: numeric("unit_cost_usd", { precision: 10, scale: 4 }).notNull(),
    validity_days: integer("validity_days"), // null = no expira; 365 = 1 año
    is_popular: boolean("is_popular").default(false).notNull(),
    sort_order: integer("sort_order").default(0).notNull(),
    is_active: boolean("is_active").default(true).notNull(),
    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
}, (t) => [
    index("idx_saas_doc_packs_order").on(t.sort_order),
]);

// ============================================================================
// 2. TABLAS ESPECÍFICAS DE CADA EMPRESA / TENANT (Con RLS)
// ============================================================================

/**
 * Suscripción Actual del Tenant
 */
export const saasTenantSubscriptions = pgTableV2("saas_tenant_subscriptions", {
    id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
    company_id: integer("company_id").references(() => companies.id, { onDelete: 'cascade' }).notNull().unique(),
    plan_id: text("plan_id").references(() => saasPlans.id).notNull(),
    // Callers must choose ACTIVE/TRIAL/PENDING_PAYMENT explicitly; no implicit paid activation.
    status: text("status").$type<SaasSubscriptionStatus>().notNull(),
    current_period_start: timestamp("current_period_start", TZ).defaultNow().notNull(),
    current_period_end: timestamp("current_period_end", TZ),
    grace_period_ends_at: timestamp("grace_period_ends_at", TZ), // Fecha límite si falla cobro recurrente
    cancel_at_period_end: boolean("cancel_at_period_end").default(false).notNull(),
    payment_method_type: text("payment_method_type").$type<SaasPaymentMethodType | null>().default('FREE'),
    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
    updated_at: timestamp("updated_at", TZ).defaultNow().notNull(),
}, (t) => [
    check("saas_tenant_subscriptions_status_check", sql`${t.status} IN ('ACTIVE', 'TRIAL', 'PENDING_PAYMENT', 'GRACE_PERIOD', 'PAST_DUE', 'SUSPENDED')`),
    check("saas_tenant_subscriptions_payment_method_check", sql`${t.payment_method_type} IS NULL OR ${t.payment_method_type} IN ('FREE', 'TRANSFER', 'CARD')`),
    check("saas_tenant_subscriptions_plan_payment_check", sql`(${t.plan_id} = 'free' AND ${t.payment_method_type} IS NOT NULL AND ${t.payment_method_type} = 'FREE') OR (${t.plan_id} <> 'free' AND ${t.payment_method_type} IS DISTINCT FROM 'FREE')`),
    index("idx_saas_sub_status").on(t.status),
    tenantPolicy(),
]).enableRLS();

/**
 * Add-ons Contratados por el Tenant (Cajas POS extra, Asientos extra, Espacio)
 */
export const saasTenantAddons = pgTableV2("saas_tenant_addons", {
    id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
    company_id: integer("company_id").references(() => companies.id, { onDelete: 'cascade' }).notNull(),
    addon_id: text("addon_id").references(() => saasAddons.id).notNull(),
    quantity: integer("quantity").default(1).notNull(),
    status: text("status").$type<SaasAddonStatus>().default('ACTIVE').notNull(),
    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
    updated_at: timestamp("updated_at", TZ).defaultNow().notNull(),
}, (t) => [
    check("saas_tenant_addons_status_check", sql`${t.status} IN ('ACTIVE', 'CANCELLED')`),
    index("idx_saas_tenant_addons_company").on(t.company_id),
    tenantPolicy(),
]).enableRLS();

/**
 * Bolsas de Comprobantes Prepago Compradas por el Tenant
 */
export const saasTenantDocumentPacks = pgTableV2("saas_tenant_document_packs", {
    id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
    company_id: integer("company_id").references(() => companies.id, { onDelete: 'cascade' }).notNull(),
    package_id: text("package_id").references(() => saasDocumentPackages.id).notNull(),
    total_credits: integer("total_credits").notNull(),
    remaining_credits: integer("remaining_credits").notNull(),
    expires_at: timestamp("expires_at", TZ), // null = no expira
    status: text("status").$type<SaasDocumentPackStatus>().default('ACTIVE').notNull(),
    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
    updated_at: timestamp("updated_at", TZ).defaultNow().notNull(),
}, (t) => [
    check("saas_tenant_document_packs_status_check", sql`${t.status} IN ('ACTIVE', 'DEPLETED', 'EXPIRED')`),
    index("idx_saas_tenant_doc_packs_company").on(t.company_id),
    index("idx_saas_tenant_doc_packs_status").on(t.status),
    tenantPolicy(),
]).enableRLS();

/**
 * Métricas de Consumo del Periodo Actual (Comprobantes emitidos, almacenamiento)
 */
export const saasTenantUsage = pgTableV2("saas_tenant_usage", {
    id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
    company_id: integer("company_id").references(() => companies.id, { onDelete: 'cascade' }).notNull(),
    period_key: text("period_key").notNull(), // '2026-09' (mensual) o '2026' (anual para Freemium)
    sri_documents_used: integer("sri_documents_used").default(0).notNull(),
    storage_bytes_used: numeric("storage_bytes_used", { precision: 20, scale: 0 }).default('0').notNull(),
    updated_at: timestamp("updated_at", TZ).defaultNow().notNull(),
}, (t) => [
    unique("unq_saas_tenant_usage_period").on(t.company_id, t.period_key),
    index("idx_saas_tenant_usage_company").on(t.company_id),
    tenantPolicy(),
]).enableRLS();
