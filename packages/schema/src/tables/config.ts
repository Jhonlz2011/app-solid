import { text, integer, boolean, timestamp, customType, index, unique } from 'drizzle-orm/pg-core';
import { pgTableV2, TZ, tenantPolicy } from '../utils';
import { taxRegimeTypeEnum } from '../enums';

// =============================================================================
// Custom PostgreSQL Types
// =============================================================================

/**
 * PostgreSQL `ltree` type for hierarchical data.
 * Requires: CREATE EXTENSION IF NOT EXISTS ltree;
 * Enables native operators: <@ (descendant), @> (ancestor), ~ (lquery regex)
 * Indexed with GiST for O(log n) tree queries.
 */
export const ltree = customType<{ data: string }>({
    dataType() { return 'ltree'; },
});

// =============================================================================
// MULTI-TENANT ROOT — Company (Emisor SRI)
// =============================================================================

/**
 * Root entity for multi-tenant isolation.
 * Each company = one legal entity with its own RUC, fiscal settings, and SRI credentials.
 * All transactional tables reference this via company_id.
 */
export const companies = pgTableV2("companies", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    slug: text("slug").notNull().unique(),                    // URL identifier: operaapp.com/{slug}
    ruc: text("ruc").notNull().unique(),
    business_name: text("business_name").notNull(),        // Razón social
    trade_name: text("trade_name"),                        // Nombre comercial
    main_address: text("main_address").notNull(),          // Dirección matriz
    business_type: text("business_type"),                  // 'COMERCIO' | 'OPTICA' | 'CLINICA' | etc.
    // SaaS plan
    plan: text("plan").default('free').notNull(),           // 'free' | 'starter' | 'pro' | 'enterprise'
    plan_expires_at: timestamp("plan_expires_at", TZ),     // null = no expiry (free tier)
    // Fiscal flags (required for every SRI XML)
    obligado_contabilidad: boolean("obligado_contabilidad").default(false).notNull(),
    contribuyente_especial: text("contribuyente_especial"),  // Resolución SRI (null = no es)
    agente_retencion: text("agente_retencion"),               // Resolución SRI (null = no es)
    rimpe_type: taxRegimeTypeEnum("rimpe_type"),
    // SRI environment (1=Pruebas, 2=Producción)
    sri_environment: text("sri_environment").default('2').notNull(),
    logo_url: text("logo_url"),
    primary_color: text("primary_color").default("#2563eb").notNull(),
    theme_color: text("theme_color").default("#64748b").notNull(),
    login_bg_url: text("login_bg_url"),
    email: text("email"),
    phone: text("phone"),
    is_active: boolean("is_active").default(true).notNull(),
    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
    updated_at: timestamp("updated_at", TZ).defaultNow().notNull(),
}, (t) => [
    index("idx_companies_slug").on(t.slug),
    index("idx_companies_plan").on(t.plan),
]);

// =============================================================================
// SRI ESTABLISHMENTS — Puntos de emisión autorizados
// =============================================================================

export const sriEstablishments = pgTableV2("sri_establishments", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    company_id: integer("company_id").references(() => companies.id).notNull(),
    code: text("code").notNull(),                           // "001", "002"
    name: text("name").notNull(),                           // "Matriz Quito", "Sucursal Guayaquil"
    address: text("address").notNull(),
    // Emission points authorized for this establishment
    emission_points: text("emission_points").array().notNull(),  // ["001", "002"]
    is_active: boolean("is_active").default(true).notNull(),
    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
}, (t) => [
    unique("unq_sri_estab_code").on(t.company_id, t.code),
    index("idx_sri_estab_company").on(t.company_id),
    tenantPolicy(),
]).enableRLS();

// =============================================================================
// SRI CERTIFICATES — Firma electrónica (.p12)
// =============================================================================

export const sriCertificates = pgTableV2("sri_certificates", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    company_id: integer("company_id").references(() => companies.id).notNull(),
    label: text("label").notNull(),                         // "Firma 2026"
    file_path: text("file_path").notNull(),                 // Ruta al .p12
    password_encrypted: text("password_encrypted").notNull(), // Cifrado AES
    issued_to: text("issued_to"),                           // CN del certificado
    valid_from: timestamp("valid_from", TZ),
    expires_at: timestamp("expires_at", TZ).notNull(),
    is_active: boolean("is_active").default(true).notNull(),
    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
}, (t) => [
    index("idx_sri_certs_company").on(t.company_id),
    index("idx_sri_certs_active").on(t.company_id, t.is_active),
    tenantPolicy(),
]).enableRLS();
