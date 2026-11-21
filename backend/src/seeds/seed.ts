// Run with: bun run db:seed
import { isNull, sql } from '@app/schema';
import { SAAS_PLAN_IDS } from '@app/schema/enums';
import {
    authMenuItems,
    authPermissions,
    saasAddons,
    saasDocumentPackages,
    saasFeatures,
    saasPlanFeatures,
    saasPlans,
    uom,
} from '@app/schema/tables';
import { disconnectRedis } from '../core/cache/redis';
import {
    adminDb,
    closeDatabaseConnections,
    type Tx,
} from '../core/db';
import { seedCompanyMenus } from '../modules/auth/provisioning.service';
import {
    DOCUMENT_PACKAGES,
    SAAS_ADDONS,
    SAAS_FEATURES,
    SAAS_PLAN_FEATURES,
    SAAS_PLANS,
} from './saas-seed-data';
import { PERMISSIONS, UOM_DATA } from './seed-data';

interface GlobalSeedSummary {
    plans: number;
    features: number;
    addons: number;
    documentPackages: number;
    globalUoms: number;
    menuItems: number;
    permissions: number;
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

async function seedGlobalPermissions(tx: Tx): Promise<void> {
    await tx.insert(authPermissions).values(PERMISSIONS).onConflictDoUpdate({
        target: authPermissions.slug,
        set: {
            module: sql`excluded.module`,
            action: sql`excluded.action`,
            description: sql`excluded.description`,
        },
    });
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
    validateCatalogDefinitions();

    console.log('🌱 Iniciando seed maestro de catálogos globales de Zelys ERP...');
    console.log(`📦 SaaS: ${SAAS_FEATURES.length} features, ${SAAS_PLANS.length} planes, ${SAAS_PLAN_FEATURES.length} reglas plan-feature`);

    const summary = await adminDb.transaction(async (tx): Promise<GlobalSeedSummary> => {
        await seedSaasCatalogs(tx);
        await seedGlobalUnitsOfMeasure(tx);
        await seedCompanyMenus(tx);
        await seedGlobalPermissions(tx);

        const [planCount] = await tx.select({ count: sql<number>`count(*)::int` }).from(saasPlans);
        const [featureCount] = await tx.select({ count: sql<number>`count(*)::int` }).from(saasFeatures);
        const [addonCount] = await tx.select({ count: sql<number>`count(*)::int` }).from(saasAddons);
        const [packageCount] = await tx.select({ count: sql<number>`count(*)::int` }).from(saasDocumentPackages);
        const [uomCount] = await tx.select({ count: sql<number>`count(*)::int` }).from(uom).where(isNull(uom.company_id));
        const [menuCount] = await tx.select({ count: sql<number>`count(*)::int` }).from(authMenuItems);
        const [permissionCount] = await tx.select({ count: sql<number>`count(*)::int` }).from(authPermissions);

        return {
            plans: planCount.count,
            features: featureCount.count,
            addons: addonCount.count,
            documentPackages: packageCount.count,
            globalUoms: uomCount.count,
            menuItems: menuCount.count,
            permissions: permissionCount.count,
        };
    });

    console.log('✅ Seed de catálogos globales completado');
    console.log(`   Planes/features/add-ons/paquetes: ${summary.plans}/${summary.features}/${summary.addons}/${summary.documentPackages}`);
    console.log(`   UOMs globales / Menús globales / Permisos RBAC: ${summary.globalUoms}/${summary.menuItems}/${summary.permissions}`);
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
