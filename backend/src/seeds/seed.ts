// Run with: bun run db:seed
import { and, eq, sql } from '@app/schema';
import { normalizeTenantSlug } from '@app/schema/utils';
import { SAAS_PLAN_IDS, BUSINESS_TYPES, type BusinessType, type SaasPlanId } from '@app/schema/enums';
import {
    account,
    authMenuItems,
    authPermissions,
    authRoles,
    authUsers,
    companies,
    entities,
    member,
    organization,
    saasAddons,
    saasDocumentPackages,
    saasFeatures,
    saasPlanFeatures,
    saasPlans,
    saasTenantSubscriptions,
    sriEstablishments,
    uom,
} from '@app/schema/tables';
import { v7 as uuidv7 } from 'uuid';
import { auth } from '../config/better-auth';
import { env } from '../config/env';
import {
    applyTenantContextToTransaction,
    closeDatabaseConnections,
    db,
    type Tx,
} from '../core/db';
import { disconnectRedis } from '../core/cache/redis';
import { hashPassword } from '../core/security';
import { createCredentialIdentity } from '../modules/auth/identity.service';
import {
    seedCompanyMenus,
    seedCompanyRBAC,
    seedCompanySubscription,
    seedCompanyUOMs,
    seedCompanyVirtualLocations,
    seedCompanyWarehouse,
} from '../modules/auth/provisioning.service';
import { DOCUMENT_PACKAGES, SAAS_ADDONS, SAAS_FEATURES, SAAS_PLAN_FEATURES, SAAS_PLANS } from './saas-seed-data';
import { UOM_DATA } from './seed-data';

interface BootstrapConfig {
    company: {
        slug: string;
        ruc: string;
        businessName: string;
        tradeName: string | null;
        mainAddress: string;
        businessType: BusinessType;
    };
    owner: {
        name: string;
        email: string;
        username: string;
        password: string;
    };
}

type BootstrapCompany = Pick<
    typeof companies.$inferSelect,
    'id' | 'organization_id' | 'slug' | 'business_name' | 'main_address'
>;

interface SeedSummary {
    company: BootstrapCompany;
    ownerId: string;
    ownerEmailVerified: boolean;
    counts: {
        plans: number;
        features: number;
        addons: number;
        documentPackages: number;
        users: number;
        members: number;
        roles: number;
        permissions: number;
        menuItems: number;
    };
}

function requiredText(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`Missing required seed configuration: ${name}`);
    return value;
}

function readBootstrapConfig(): BootstrapConfig {
    const slug = normalizeTenantSlug(requiredText('BOOTSTRAP_COMPANY_SLUG'));
    if (!slug) throw new Error('BOOTSTRAP_COMPANY_SLUG is invalid or reserved');

    const ruc = requiredText('BOOTSTRAP_COMPANY_RUC');
    if (!/^\d{13}$/.test(ruc)) throw new Error('BOOTSTRAP_COMPANY_RUC must contain exactly 13 digits');

    const businessType = requiredText('BOOTSTRAP_COMPANY_BUSINESS_TYPE').toUpperCase();
    if (!(BUSINESS_TYPES as readonly string[]).includes(businessType)) {
        throw new Error(`BOOTSTRAP_COMPANY_BUSINESS_TYPE must be one of: ${BUSINESS_TYPES.join(', ')}`);
    }

    const email = requiredText('BOOTSTRAP_ADMIN_EMAIL').toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('BOOTSTRAP_ADMIN_EMAIL is not a valid email address');
    }

    const username = requiredText('BOOTSTRAP_ADMIN_USERNAME').toLowerCase();
    if (!/^[a-z0-9_-]{3,30}$/.test(username)) {
        throw new Error('BOOTSTRAP_ADMIN_USERNAME must be 3-30 lowercase letters, digits, _ or -');
    }

    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
    if (!password || password.length < 8) {
        throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be configured and contain at least 16 characters');
    }
    if (!env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY is required to deliver the mandatory bootstrap email verification');
    }

    return {
        company: {
            slug,
            ruc,
            businessName: requiredText('BOOTSTRAP_COMPANY_NAME'),
            tradeName: process.env.BOOTSTRAP_COMPANY_TRADE_NAME?.trim() || null,
            mainAddress: requiredText('BOOTSTRAP_COMPANY_MAIN_ADDRESS'),
            businessType: businessType as BusinessType,
        },
        owner: {
            name: requiredText('BOOTSTRAP_ADMIN_NAME'),
            email,
            username,
            password,
        },
    };
}

function validateCatalogDefinitions(): void {
    const featureCodes = new Set(SAAS_FEATURES.map((feature) => feature.code));
    const planIds = new Set(SAAS_PLANS.map((plan) => plan.id));
    const featurePairs = new Set<string>();

    if (featureCodes.size !== SAAS_FEATURES.length) throw new Error('Duplicate feature code in SaaS seed catalog');
    if (planIds.size !== SAAS_PLANS.length) throw new Error('Duplicate plan id in SaaS seed catalog');

    for (const plan of SAAS_PLANS) {
        if (!(SAAS_PLAN_IDS as readonly string[]).includes(plan.id)) {
            throw new Error(`Unknown SaaS plan id in seed catalog: ${plan.id}`);
        }
    }

    for (const item of SAAS_PLAN_FEATURES) {
        if (!planIds.has(item.planId)) throw new Error(`Plan-feature references unknown plan: ${item.planId}`);
        if (!featureCodes.has(item.featureCode)) throw new Error(`Plan-feature references unknown feature: ${item.featureCode}`);
        const key = `${item.planId}\u0000${item.featureCode}`;
        if (featurePairs.has(key)) throw new Error(`Duplicate plan-feature mapping: ${item.planId}/${item.featureCode}`);
        featurePairs.add(key);
    }
}

/** Seed global SaaS catalogs in five batched, idempotent statements. */
async function seedSaasCatalogs(tx: Tx): Promise<void> {
    const now = new Date();

    await tx.insert(saasFeatures).values(SAAS_FEATURES.map((feature) => ({
        code: feature.code,
        name: feature.name,
        description: feature.description,
        type: feature.type,
        category: feature.category,
        unit_label: feature.unitLabel ?? null,
    }))).onConflictDoUpdate({
        target: saasFeatures.code,
        set: {
            name: sql`excluded.name`,
            description: sql`excluded.description`,
            type: sql`excluded.type`,
            category: sql`excluded.category`,
            unit_label: sql`excluded.unit_label`,
        },
    });

    await tx.insert(saasPlans).values(SAAS_PLANS.map((plan) => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        interval: plan.interval,
        price_usd: plan.priceUsd.toFixed(2),
        annual_discount_percent: plan.annualDiscountPercent ?? 0,
        trial_days: plan.trialDays,
        is_popular: plan.isPopular ?? false,
        sort_order: plan.sortOrder,
        is_active: true,
        updated_at: now,
    }))).onConflictDoUpdate({
        target: saasPlans.id,
        set: {
            name: sql`excluded.name`,
            description: sql`excluded.description`,
            interval: sql`excluded.interval`,
            price_usd: sql`excluded.price_usd`,
            annual_discount_percent: sql`excluded.annual_discount_percent`,
            trial_days: sql`excluded.trial_days`,
            is_popular: sql`excluded.is_popular`,
            sort_order: sql`excluded.sort_order`,
            updated_at: now,
        },
    });

    await tx.insert(saasPlanFeatures).values(SAAS_PLAN_FEATURES.map((item) => ({
        plan_id: item.planId,
        feature_code: item.featureCode,
        value_boolean: item.valueBoolean ?? null,
        value_numeric: item.valueNumeric ?? null,
    }))).onConflictDoUpdate({
        target: [saasPlanFeatures.plan_id, saasPlanFeatures.feature_code],
        set: {
            value_boolean: sql`excluded.value_boolean`,
            value_numeric: sql`excluded.value_numeric`,
        },
    });

    await tx.insert(saasAddons).values(SAAS_ADDONS.map((addon) => ({
        id: addon.id,
        name: addon.name,
        description: addon.description,
        addon_type: addon.addonType,
        billing_type: addon.billingType,
        price_usd: addon.priceUsd.toFixed(2),
        quantity: addon.quantity,
        unit_label: addon.unitLabel,
        validity_days: addon.validityDays ?? null,
        is_popular: addon.isPopular ?? false,
        sort_order: addon.sortOrder,
        is_active: true,
    }))).onConflictDoUpdate({
        target: saasAddons.id,
        set: {
            name: sql`excluded.name`,
            description: sql`excluded.description`,
            addon_type: sql`excluded.addon_type`,
            billing_type: sql`excluded.billing_type`,
            price_usd: sql`excluded.price_usd`,
            quantity: sql`excluded.quantity`,
            unit_label: sql`excluded.unit_label`,
            validity_days: sql`excluded.validity_days`,
            is_popular: sql`excluded.is_popular`,
            sort_order: sql`excluded.sort_order`,
        },
    });

    await tx.insert(saasDocumentPackages).values(DOCUMENT_PACKAGES.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        document_count: item.documentCount,
        price_usd: item.priceUsd.toFixed(2),
        unit_cost_usd: item.unitCostUsd.toFixed(4),
        validity_days: item.validityDays,
        is_popular: item.isPopular ?? false,
        sort_order: item.sortOrder,
        is_active: true,
    }))).onConflictDoUpdate({
        target: saasDocumentPackages.id,
        set: {
            name: sql`excluded.name`,
            description: sql`excluded.description`,
            document_count: sql`excluded.document_count`,
            price_usd: sql`excluded.price_usd`,
            unit_cost_usd: sql`excluded.unit_cost_usd`,
            validity_days: sql`excluded.validity_days`,
            is_popular: sql`excluded.is_popular`,
            sort_order: sql`excluded.sort_order`,
        },
    });
}

async function seedGlobalUnitsOfMeasure(tx: Tx): Promise<void> {
    await tx.insert(uom).values(UOM_DATA.map((unit) => ({
        ...unit,
        company_id: null,
        is_system: true,
    }))).onConflictDoNothing();
}

async function ensureBootstrapCompany(tx: Tx, config: BootstrapConfig['company']): Promise<BootstrapCompany> {
    const [existingByRuc] = await tx.select({
        id: companies.id,
        organization_id: companies.organization_id,
        slug: companies.slug,
        business_name: companies.business_name,
        main_address: companies.main_address,
    }).from(companies).where(eq(companies.ruc, config.ruc)).limit(1);

    if (existingByRuc) {
        if (existingByRuc.slug !== config.slug) {
            throw new Error('BOOTSTRAP_COMPANY_RUC already belongs to a different company slug; refusing to relink tenants');
        }
        const [linkedOrganization] = await tx.select({ id: organization.id })
            .from(organization)
            .where(eq(organization.id, existingByRuc.organization_id))
            .limit(1);
        if (!linkedOrganization) throw new Error('Existing bootstrap company has no Better Auth organization');
        return existingByRuc;
    }

    const [existingBySlug] = await tx.select({ id: companies.id, ruc: companies.ruc })
        .from(companies)
        .where(eq(companies.slug, config.slug))
        .limit(1);
    if (existingBySlug) throw new Error('BOOTSTRAP_COMPANY_SLUG is already assigned to a different RUC');

    let [tenantOrganization] = await tx.select({ id: organization.id })
        .from(organization)
        .where(eq(organization.slug, config.slug))
        .limit(1);

    if (tenantOrganization) {
        const [linkedCompany] = await tx.select({ id: companies.id })
            .from(companies)
            .where(eq(companies.organization_id, tenantOrganization.id))
            .limit(1);
        const [existingMember] = await tx.select({ id: member.id })
            .from(member)
            .where(eq(member.organizationId, tenantOrganization.id))
            .limit(1);
        if (linkedCompany || existingMember) {
            throw new Error('The bootstrap organization slug is already in use; refusing to adopt an existing tenant');
        }
    } else {
        [tenantOrganization] = await tx.insert(organization).values({
            id: uuidv7(),
            name: config.tradeName ?? config.businessName,
            slug: config.slug,
        }).onConflictDoNothing({ target: organization.slug }).returning({ id: organization.id });

        // A concurrent seed may have inserted the unique slug while this transaction waited.
        if (!tenantOrganization) {
            [tenantOrganization] = await tx.select({ id: organization.id })
                .from(organization)
                .where(eq(organization.slug, config.slug))
                .limit(1);
        }
    }

    if (!tenantOrganization) throw new Error('Unable to create or resolve the bootstrap organization');

    const [createdCompany] = await tx.insert(companies).values({
        organization_id: tenantOrganization.id,
        slug: config.slug,
        ruc: config.ruc,
        business_name: config.businessName,
        trade_name: config.tradeName,
        main_address: config.mainAddress,
        business_type: config.businessType,
    }).onConflictDoNothing({ target: companies.ruc }).returning({
        id: companies.id,
        organization_id: companies.organization_id,
        slug: companies.slug,
        business_name: companies.business_name,
        main_address: companies.main_address,
    });

    if (createdCompany) return createdCompany;

    // Resolve an idempotent concurrent insert without changing tenant ownership or branding.
    const [concurrentCompany] = await tx.select({
        id: companies.id,
        organization_id: companies.organization_id,
        slug: companies.slug,
        business_name: companies.business_name,
        main_address: companies.main_address,
    }).from(companies).where(eq(companies.ruc, config.ruc)).limit(1);
    if (!concurrentCompany || concurrentCompany.slug !== config.slug || concurrentCompany.organization_id !== tenantOrganization.id) {
        throw new Error('A conflicting company was created during bootstrap; refusing to attach the wrong organization');
    }
    return concurrentCompany;
}

async function ensureBootstrapIdentity(
    tx: Tx,
    company: BootstrapCompany,
    config: BootstrapConfig['owner'],
    passwordHash: string,
): Promise<{ id: string; emailVerified: boolean }> {
    const [existingUser] = await tx.select({
        id: authUsers.id,
        is_active: authUsers.is_active,
        emailVerified: authUsers.emailVerified,
    }).from(authUsers).where(eq(authUsers.email, config.email)).limit(1);

    let userId: string;
    let emailVerified: boolean;

    const isExistingUser = Boolean(existingUser);
    if (existingUser) {
        if (existingUser.is_active === false) throw new Error('Bootstrap user exists but is globally disabled');
        const [existingAccount] = await tx.select({ id: account.id })
            .from(account)
            .where(eq(account.userId, existingUser.id))
            .limit(1);
        if (!existingAccount) {
            throw new Error('Bootstrap email belongs to an identity without an auth account; use the established recovery flow');
        }
        userId = existingUser.id;
        emailVerified = existingUser.emailVerified === true;
    } else {
        const [usernameOwner] = await tx.select({ id: authUsers.id })
            .from(authUsers)
            .where(eq(authUsers.username, config.username))
            .limit(1);
        if (usernameOwner) throw new Error('BOOTSTRAP_ADMIN_USERNAME is already taken; choose another username');

        const user = await createCredentialIdentity(tx, {
            name: config.name,
            email: config.email,
            username: config.username,
            displayUsername: config.name,
            passwordHash,
            emailVerified: false,
            companyId: company.id,
        });
        userId = user.id;
        emailVerified = false;
    }

    const [existingMembership] = await tx.select({
        role: member.role,
        status: member.status,
    }).from(member).where(and(
        eq(member.organizationId, company.organization_id),
        eq(member.userId, userId),
    )).limit(1);

    if (existingMembership) {
        if (existingMembership.status !== 'ACTIVE') {
            throw new Error('Bootstrap user has a suspended or removed membership; refusing to reactivate it automatically');
        }
        if (existingMembership.role !== 'owner') {
            throw new Error('Existing bootstrap identity is not already an owner; use the audited tenant invitation/role workflow');
        }
    } else {
        if (isExistingUser) {
            throw new Error('Bootstrap email already belongs to an identity outside this tenant; use the audited tenant invitation workflow');
        }
        await tx.insert(member).values({
            organizationId: company.organization_id,
            userId,
            role: 'owner',
            status: 'ACTIVE',
        });
    }

    return { id: userId, emailVerified };
}

async function seedTenantData(
    tx: Tx,
    company: BootstrapCompany,
    config: BootstrapConfig,
    passwordHash: string,
): Promise<SeedSummary> {
    await applyTenantContextToTransaction(tx, { companyId: company.id });

    await seedCompanyUOMs(tx, company.id);

    await tx.insert(sriEstablishments).values({
        company_id: company.id,
        code: '001',
        name: 'Matriz',
        address: company.main_address,
        emission_points: ['001'],
    }).onConflictDoNothing({ target: [sriEstablishments.company_id, sriEstablishments.code] });

    await tx.insert(entities).values({
        company_id: company.id,
        tax_id: '9999999999999',
        tax_id_type: 'CONSUMIDOR_FINAL',
        person_type: 'NATURAL',
        business_name: 'CONSUMIDOR FINAL',
        is_client: true,
        is_system: true,
        obligado_contabilidad: false,
    }).onConflictDoUpdate({
        target: [entities.company_id, entities.tax_id],
        set: { business_name: 'CONSUMIDOR FINAL', is_system: true, is_client: true },
    });

    await seedCompanyVirtualLocations(tx, company.id);
    await seedCompanyWarehouse(tx, company.id, company.main_address);

    const owner = await ensureBootstrapIdentity(tx, company, config.owner, passwordHash);

    const [existingSubscription] = await tx.select({
        plan_id: saasTenantSubscriptions.plan_id,
        status: saasTenantSubscriptions.status,
        payment_method_type: saasTenantSubscriptions.payment_method_type,
    }).from(saasTenantSubscriptions)
        .where(eq(saasTenantSubscriptions.company_id, company.id))
        .limit(1);

    let planId: SaasPlanId = 'free';
    if (!existingSubscription) {
        await seedCompanySubscription(tx, company.id, 'free', 'ACTIVE', 'FREE');
    } else {
        if (!(SAAS_PLAN_IDS as readonly string[]).includes(existingSubscription.plan_id)) {
            throw new Error(`Tenant subscription references an unknown plan: ${existingSubscription.plan_id}`);
        }
        if (existingSubscription.plan_id !== 'free' && existingSubscription.payment_method_type === 'FREE') {
            throw new Error('Paid plan has FREE payment method; reconcile billing state before running the bootstrap seed');
        }
        planId = existingSubscription.plan_id as SaasPlanId;
    }

    await seedCompanyRBAC(tx, company.id, owner.id, planId);

    const [userCount] = await tx.select({ count: sql<number>`count(*)::int` }).from(authUsers);
    const [memberCount] = await tx.select({ count: sql<number>`count(*)::int` }).from(member)
        .where(eq(member.organizationId, company.organization_id));
    const [roleCount] = await tx.select({ count: sql<number>`count(*)::int` }).from(authRoles)
        .where(eq(authRoles.company_id, company.id));
    const [permissionCount] = await tx.select({ count: sql<number>`count(*)::int` }).from(authPermissions);
    const [menuCount] = await tx.select({ count: sql<number>`count(*)::int` }).from(authMenuItems);
    const [planCount] = await tx.select({ count: sql<number>`count(*)::int` }).from(saasPlans);
    const [featureCount] = await tx.select({ count: sql<number>`count(*)::int` }).from(saasFeatures);
    const [addonCount] = await tx.select({ count: sql<number>`count(*)::int` }).from(saasAddons);
    const [packageCount] = await tx.select({ count: sql<number>`count(*)::int` }).from(saasDocumentPackages);

    return {
        company,
        ownerId: owner.id,
        ownerEmailVerified: owner.emailVerified,
        counts: {
            plans: planCount.count,
            features: featureCount.count,
            addons: addonCount.count,
            documentPackages: packageCount.count,
            users: userCount.count,
            members: memberCount.count,
            roles: roleCount.count,
            permissions: permissionCount.count,
            menuItems: menuCount.count,
        },
    };
}

function describeSafeError(error: unknown): string {
    let current: unknown = error;
    const visited = new Set<unknown>();
    for (let depth = 0; depth < 8 && current && typeof current === 'object' && 'cause' in current; depth++) {
        if (visited.has(current)) break;
        visited.add(current);
        const cause = (current as { cause?: unknown }).cause;
        if (!cause) break;
        current = cause;
    }

    if (current && typeof current === 'object') {
        const detail = current as { code?: unknown; message?: unknown };
        const code = typeof detail.code === 'string' ? `${detail.code}: ` : '';
        const message = typeof detail.message === 'string' ? detail.message : 'Unknown error';
        return `${code}${message}`;
    }
    return String(current ?? error);
}

async function seed(): Promise<void> {
    const config = readBootstrapConfig();
    validateCatalogDefinitions();

    console.log('🌱 Iniciando seed transaccional de Zelys ERP...');
    console.log(`📦 SaaS: ${SAAS_FEATURES.length} features, ${SAAS_PLANS.length} planes, ${SAAS_PLAN_FEATURES.length} reglas plan-feature`);
    console.log(`🏢 Preparando tenant bootstrap: ${config.company.slug}`);

    // Compute the expensive password hash before acquiring database locks.
    const passwordHash = await hashPassword(config.owner.password);

    const summary = await db.transaction(async (tx) => {
        await seedSaasCatalogs(tx);
        await seedGlobalUnitsOfMeasure(tx);
        await seedCompanyMenus(tx);

        const company = await ensureBootstrapCompany(tx, config.company);
        return seedTenantData(tx, company, config, passwordHash);
    });

    // Email delivery is outside the DB transaction. A mail outage does not lose
    // the committed bootstrap records; rerunning safely retries verification.
    if (!summary.ownerEmailVerified) {
        const verification = await auth.api.sendVerificationEmail({
            body: { email: config.owner.email, callbackURL: '/verify-email' },
            headers: new Headers({ origin: env.BETTER_AUTH_URL }),
        });
        if (!verification.status) throw new Error('Better Auth did not confirm bootstrap verification email delivery');
        console.log('✉️ Email de verificación enviado al usuario bootstrap.');
    }

    console.log('\n✅ Seed completado');
    console.log(`   Tenant: ${summary.company.slug} (company ${summary.company.id})`);
    console.log(`   Owner ID: ${summary.ownerId}`);
    console.log(`   Email verificado: ${summary.ownerEmailVerified ? 'sí' : 'pendiente'}`);
    console.log(`   Planes/features/add-ons/paquetes: ${summary.counts.plans}/${summary.counts.features}/${summary.counts.addons}/${summary.counts.documentPackages}`);
    console.log(`   Usuarios/membresías/roles/permisos: ${summary.counts.users}/${summary.counts.members}/${summary.counts.roles}/${summary.counts.permissions}`);
    console.log(`   Menús globales: ${summary.counts.menuItems}`);
    console.log('   No se imprimen contraseñas ni se restablecen credenciales existentes.');
}

async function main(): Promise<void> {
    try {
        await seed();
    } catch (error) {
        console.error(`❌ Seed failed: ${describeSafeError(error)}`);
        process.exitCode = 1;
    } finally {
        const shutdown = await Promise.allSettled([disconnectRedis(), closeDatabaseConnections()]);
        for (const result of shutdown) {
            if (result.status === 'rejected') {
                console.error(`⚠️ Seed shutdown warning: ${describeSafeError(result.reason)}`);
                process.exitCode = 1;
            }
        }
    }
}

void main();
