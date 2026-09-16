// src/seeds/seed.ts
// Run with: bun run db:seed
import { db, withTenantContext } from '../core/db';
import {
    authPermissions,
    authRoles,
    authUserRoles,
    authUsers,
    account,
    organization,
    member,
    uom,
    entities,
    companies,
    sriEstablishments,
    authMenuItems,
    saasPlans,
    saasFeatures,
    saasPlanFeatures,
    saasAddons,
    saasDocumentPackages,
} from '@app/schema/tables';
import { sql, eq, and } from '@app/schema';
import {
    seedCompanyRBAC,
    seedCompanySubscription,
    seedCompanyMenus,
    seedCompanyUOMs,
    seedCompanyVirtualLocations,
    seedCompanyWarehouse,
} from '../modules/auth/provisioning.service';
import { hashPassword } from '../core/security';
import { UOM_DATA } from './seed-data';
import {
    SAAS_FEATURES,
    SAAS_PLANS,
    SAAS_PLAN_FEATURES,
    SAAS_ADDONS,
    DOCUMENT_PACKAGES,
} from './saas-seed-data';
import { v7 as uuidv7 } from 'uuid';

/**
 * Sembrado de Catálogos Maestros de SaaS (Planes, Features, Add-ons, Packs Prepago)
 */
async function seedSaasCatalogs(database: typeof db) {
    console.log('\n📦 Sembrando Catálogos Maestros SaaS...');

    // 1. Features maestras
    console.log(`   ⚙️ Insertando ${SAAS_FEATURES.length} features y límites...`);
    for (const f of SAAS_FEATURES) {
        await database
            .insert(saasFeatures)
            .values({
                code: f.code,
                name: f.name,
                description: f.description,
                type: f.type,
                category: f.category,
                unit_label: f.unitLabel || null,
            })
            .onConflictDoUpdate({
                target: saasFeatures.code,
                set: {
                    name: f.name,
                    description: f.description,
                    type: f.type,
                    category: f.category,
                    unit_label: f.unitLabel || null,
                },
            });
    }

    // 2. Planes SaaS
    console.log(`   🏷️ Insertando ${SAAS_PLANS.length} planes comerciales...`);
    for (const p of SAAS_PLANS) {
        await database
            .insert(saasPlans)
            .values({
                id: p.id,
                name: p.name,
                description: p.description,
                interval: p.interval,
                price_usd: p.priceUsd.toFixed(2),
                annual_discount_percent: p.annualDiscountPercent || 0,
                trial_days: p.trialDays,
                is_popular: p.isPopular ?? false,
                sort_order: p.sortOrder,
                is_active: true,
                updated_at: new Date(),
            })
            .onConflictDoUpdate({
                target: saasPlans.id,
                set: {
                    name: p.name,
                    description: p.description,
                    interval: p.interval,
                    price_usd: p.priceUsd.toFixed(2),
                    annual_discount_percent: p.annualDiscountPercent || 0,
                    trial_days: p.trialDays,
                    is_popular: p.isPopular ?? false,
                    sort_order: p.sortOrder,
                    is_active: true,
                    updated_at: new Date(),
                },
            });
    }

    // 3. Matriz Plan - Features
    console.log(`   🔗 Insertando ${SAAS_PLAN_FEATURES.length} relaciones plan-feature...`);
    for (const pf of SAAS_PLAN_FEATURES) {
        await database
            .insert(saasPlanFeatures)
            .values({
                plan_id: pf.planId,
                feature_code: pf.featureCode,
                value_boolean: pf.valueBoolean ?? null,
                value_numeric: pf.valueNumeric ?? null,
            })
            .onConflictDoUpdate({
                target: [saasPlanFeatures.plan_id, saasPlanFeatures.feature_code],
                set: {
                    value_boolean: pf.valueBoolean ?? null,
                    value_numeric: pf.valueNumeric ?? null,
                },
            });
    }

    // 4. Catálogo de Add-ons recurrentes
    console.log(`   🧩 Insertando ${SAAS_ADDONS.length} add-ons...`);
    for (const a of SAAS_ADDONS) {
        await database
            .insert(saasAddons)
            .values({
                id: a.id,
                name: a.name,
                description: a.description,
                addon_type: a.addonType,
                billing_type: a.billingType,
                price_usd: a.priceUsd.toFixed(2),
                quantity: a.quantity,
                unit_label: a.unitLabel,
                validity_days: a.validityDays ?? null,
                is_popular: a.isPopular ?? false,
                sort_order: a.sortOrder,
                is_active: true,
            })
            .onConflictDoUpdate({
                target: saasAddons.id,
                set: {
                    name: a.name,
                    description: a.description,
                    addon_type: a.addonType,
                    billing_type: a.billingType,
                    price_usd: a.priceUsd.toFixed(2),
                    quantity: a.quantity,
                    unit_label: a.unitLabel,
                    validity_days: a.validityDays ?? null,
                    is_popular: a.isPopular ?? false,
                    sort_order: a.sortOrder,
                    is_active: true,
                },
            });
    }

    // 5. Catálogo de Paquetes de Documentos Prepago SRI
    console.log(`   📄 Insertando ${DOCUMENT_PACKAGES.length} paquetes de comprobantes SRI...`);
    for (const dp of DOCUMENT_PACKAGES) {
        await database
            .insert(saasDocumentPackages)
            .values({
                id: dp.id,
                name: dp.name,
                description: dp.description,
                document_count: dp.documentCount,
                price_usd: dp.priceUsd.toFixed(2),
                unit_cost_usd: dp.unitCostUsd.toFixed(4),
                validity_days: dp.validityDays ?? null,
                is_popular: dp.isPopular ?? false,
                sort_order: dp.sortOrder,
                is_active: true,
            })
            .onConflictDoUpdate({
                target: saasDocumentPackages.id,
                set: {
                    name: dp.name,
                    description: dp.description,
                    document_count: dp.documentCount,
                    price_usd: dp.priceUsd.toFixed(2),
                    unit_cost_usd: dp.unitCostUsd.toFixed(4),
                    validity_days: dp.validityDays ?? null,
                    is_popular: dp.isPopular ?? false,
                    sort_order: dp.sortOrder,
                    is_active: true,
                },
            });
    }

    console.log('   ✅ Catálogos maestros SaaS sembrados exitosamente.');
}

async function seed() {
    console.log('🌱 Iniciando Sembrado Completo del Sistema Zelys ERP...\n');

    try {
        // =========================================================================
        // 0. SEED SAAS MASTER CATALOGS (Planes, Features, Add-ons, Packs)
        // =========================================================================
        await seedSaasCatalogs(db as any);

        // =========================================================================
        // 0.1 CREATE / VERIFY DEFAULT DEV COMPANY & BETTER-AUTH ORGANIZATION
        // =========================================================================
        console.log('\n🏢 Creating / verifying default dev company...');
        const [devCompany] = await db
            .insert(companies)
            .values({
                slug: 'dev',
                ruc: '9999999999001',
                business_name: 'Empresa de Desarrollo',
                trade_name: 'DevCo',
                main_address: 'Dirección de prueba',
                business_type: 'COMERCIO',
                plan: 'enterprise_yearly',
            })
            .onConflictDoUpdate({
                target: companies.ruc,
                set: { business_name: 'Empresa de Desarrollo', slug: 'dev', plan: 'enterprise_yearly' },
            })
            .returning();
        console.log(`   ✅ Company verified: ${devCompany.business_name} (id: ${devCompany.id}, slug: ${devCompany.slug})`);

        // Register organization in Better-Auth for multi-tenancy & company switching
        console.log('🏢 Creating / verifying Better-Auth organization...');
        const orgId = devCompany.organization_id || uuidv7();
        await db
            .insert(organization)
            .values({
                id: orgId,
                name: devCompany.business_name,
                slug: devCompany.slug,
            })
            .onConflictDoUpdate({
                target: organization.slug,
                set: { name: devCompany.business_name },
            });
        
        // Link company to organization
        await db
            .update(companies)
            .set({ organization_id: orgId })
            .where(eq(companies.id, devCompany.id));
        console.log(`   ✅ Better-Auth Organization verified: ${devCompany.slug} (org: ${orgId})`);

        // =========================================================================
        // 1. SYSTEM GLOBAL UOMs (company_id = null)
        // =========================================================================
        console.log('\n📏 Inserting global system UOMs...');
        for (const unit of UOM_DATA) {
            await db
                .insert(uom)
                .values({ ...unit, company_id: null, is_system: true })
                .onConflictDoNothing();
        }
        console.log(`   ✅ ${UOM_DATA.length} global system UOMs processed`);

        // =========================================================================
        // 2. SYSTEM GLOBAL MENUS (Parent & Children dynamic navigation tree)
        // =========================================================================
        console.log('\n📂 Seeding global system menu items...');
        await seedCompanyMenus(db as any);
        console.log('   ✅ Global system menus seeded/updated');

        // =========================================================================
        // 3. TENANT-SCOPED INITIALIZATION (DEV COMPANY)
        // =========================================================================
        await withTenantContext({ companyId: devCompany.id }, async () => {
            // 3.1 Derived UOMs
            console.log('\n📏 Seeding derived UOMs for dev company...');
            await seedCompanyUOMs(db as any, devCompany.id);
            console.log('   ✅ Derived UOMs processed');

            // 3.2 SRI Establishment
            console.log('\n🏗️ Creating default SRI establishment (Matriz 001)...');
            await db
                .insert(sriEstablishments)
                .values({
                    company_id: devCompany.id,
                    code: '001',
                    name: 'Matriz',
                    address: devCompany.main_address,
                    emission_points: ['001'],
                })
                .onConflictDoNothing();
            console.log('   ✅ SRI establishment verified');

            // 3.3 Consumidor Final Client Entity
            console.log('\n👤 Creating default CONSUMIDOR FINAL client...');
            const [consumidorFinal] = await db
                .insert(entities)
                .values({
                    company_id: devCompany.id,
                    tax_id: '9999999999999',
                    tax_id_type: 'CONSUMIDOR_FINAL',
                    person_type: 'NATURAL',
                    business_name: 'CONSUMIDOR FINAL',
                    is_client: true,
                    is_system: true,
                    obligado_contabilidad: false,
                })
                .onConflictDoUpdate({
                    target: [entities.company_id, entities.tax_id],
                    set: { business_name: 'CONSUMIDOR FINAL', is_system: true }
                })
                .returning();
            console.log(`   ✅ Entity verified: ${consumidorFinal.business_name}`);

            // 3.4 Virtual Locations (SUPPLIER, CUSTOMER, ADJUSTMENT, PRODUCTION)
            console.log('\n📍 Seeding virtual warehouse locations...');
            await seedCompanyVirtualLocations(db as any, devCompany.id);
            console.log('   ✅ Virtual locations verified');

            // 3.5 Physical Warehouse (BOD-001) & Default Location (General)
            console.log('\n📦 Seeding default physical warehouse & location...');
            await seedCompanyWarehouse(db as any, devCompany.id, devCompany.main_address);
            console.log('   ✅ Default warehouse & location verified');

            // =====================================================================
            // 4. SEED USERS & BETTER-AUTH CREDENTIALS (user, account, member)
            // =====================================================================
            console.log('\n👥 Seeding Better-Auth users & credentials...');

            const defaultPassword = 'password123';
            const hashedPassword = await hashPassword(defaultPassword);

            const usersToCreate = [
                {
                    username: 'superadmin',
                    name: 'Super Administrador',
                    email: 'superadmin@zelys.app',
                    role: 'superadmin',
                },
                {
                    username: 'admin',
                    name: 'Administrador',
                    email: 'admin@zelys.app',
                    role: 'admin',
                }
            ];

            const userIds = new Map<string, string>();

            for (const userData of usersToCreate) {
                // 1. Insert / Upsert into Better-Auth 'user' table
                const [userRecord] = await db
                    .insert(authUsers)
                    .values({
                        name: userData.name,
                        email: userData.email.toLowerCase(),
                        username: userData.username.toLowerCase(),
                        displayUsername: userData.username,
                        company_id: devCompany.id,
                        is_active: true,
                        emailVerified: true,
                    })
                    .onConflictDoUpdate({
                        target: authUsers.username,
                        set: {
                            name: userData.name,
                            email: userData.email.toLowerCase(),
                            displayUsername: userData.username,
                            company_id: devCompany.id,
                            is_active: true,
                            emailVerified: true,
                        }
                    })
                    .returning({ id: authUsers.id, email: authUsers.email, username: authUsers.username });

                const userId = userRecord.id;
                userIds.set(userData.username, userId);
                console.log(`   ✅ User verified: ${userData.username} (${userData.email}) [id: ${userId}]`);

                // 2. Insert / Update Better-Auth 'account' (Password Credential)
                const existingAccount = await db
                    .select({ id: account.id })
                    .from(account)
                    .where(and(eq(account.userId, userId), eq(account.providerId, 'credential')))
                    .limit(1);

                if (existingAccount.length === 0) {
                    await db.insert(account).values({
                        accountId: userId,
                        providerId: 'credential',
                        userId: userId,
                        password: hashedPassword,
                    });
                    console.log(`      🔑 Created Better-Auth credential account for ${userData.username}`);
                } else {
                    await db
                        .update(account)
                        .set({ password: hashedPassword })
                        .where(eq(account.id, existingAccount[0].id));
                    console.log(`      🔑 Updated Better-Auth credential password for ${userData.username}`);
                }

                // 3. Insert Better-Auth 'member' (Organization Membership)
                await db
                    .insert(member)
                    .values({
                        organizationId: orgId,
                        userId: userId,
                        role: userData.role === 'superadmin' ? 'owner' : 'admin',
                    })
                    .onConflictDoNothing();
                console.log(`      🏢 Added to Better-Auth organization membership: role ${userData.role}`);
            }

            // =====================================================================
            // 5. SEED RBAC ROLES & PERMISSIONS FOR DEV COMPANY (Plan-Aware)
            // =====================================================================
            console.log('\n🛡️ Seeding company RBAC roles & permissions...');
            const superadminId = userIds.get('superadmin') || '';
            const roleMap = await seedCompanyRBAC(db as any, devCompany.id, superadminId, 'enterprise_yearly');
            await seedCompanySubscription(db as any, devCompany.id, 'enterprise_yearly');
            console.log(`   ✅ Roles, permissions & SaaS subscription linked (owner assigned to superadmin)`);

            // Assign admin role to admin user
            const adminId = userIds.get('admin');
            const adminRoleId = roleMap.get('admin');
            if (adminId && adminRoleId) {
                await db
                    .insert(authUserRoles)
                    .values({ user_id: adminId, role_id: adminRoleId, company_id: devCompany.id })
                    .onConflictDoNothing();
                console.log(`   🔗 Assigned admin role to admin user`);
            }

            // =====================================================================
            // 5.1 SEED DEV COMPANY MENUS & ROUTE ALIASES
            // =====================================================================
            console.log('\n📂 Seeding tenant menu items for dev company...');
            await seedCompanyMenus(db as any, devCompany.id);
            console.log('   ✅ Dev company menus seeded');

            // =====================================================================
            // 6. SUMMARY & VERIFICATION
            // =====================================================================
            const planCount = await db.select({ count: sql<number>`count(*)` }).from(saasPlans);
            const featureCount = await db.select({ count: sql<number>`count(*)` }).from(saasFeatures);
            const addonCount = await db.select({ count: sql<number>`count(*)` }).from(saasAddons);
            const packCount = await db.select({ count: sql<number>`count(*)` }).from(saasDocumentPackages);
            const permCount = await db.select({ count: sql<number>`count(*)` }).from(authPermissions);
            const roleCount = await db.select({ count: sql<number>`count(*)` }).from(authRoles);
            const userCount = await db.select({ count: sql<number>`count(*)` }).from(authUsers);
            const companyCount = await db.select({ count: sql<number>`count(*)` }).from(companies);
            const menuCount = await db.select({ count: sql<number>`count(*)` }).from(authMenuItems);
            const memberCount = await db.select({ count: sql<number>`count(*)` }).from(member);
            const accountCount = await db.select({ count: sql<number>`count(*)` }).from(account);

            console.log('\n=============================================================');
            console.log('🎉 SEED COMPLETED SUCCESSFULLY!');
            console.log('=============================================================');
            console.log(`📊 SaaS Master Catalogs:`);
            console.log(`   - Plans:                    ${planCount[0].count}`);
            console.log(`   - Features & Limits:        ${featureCount[0].count}`);
            console.log(`   - Add-ons:                  ${addonCount[0].count}`);
            console.log(`   - Document Packages (SRI):  ${packCount[0].count}`);
            console.log(`📊 Tenant & System Statistics:`);
            console.log(`   - Companies:                ${companyCount[0].count}`);
            console.log(`   - Total Users:              ${userCount[0].count}`);
            console.log(`   - Better-Auth Accounts:     ${accountCount[0].count}`);
            console.log(`   - Organization Members:     ${memberCount[0].count}`);
            console.log(`   - RBAC Roles:               ${roleCount[0].count}`);
            console.log(`   - Permissions:              ${permCount[0].count}`);
            console.log(`   - Dynamic Menu Items:       ${menuCount[0].count}`);
            console.log('\n🔑 Default Credentials:');
            console.log('   - Superadmin: superadmin@zelys.app / password123');
            console.log('   - Admin:      admin@zelys.app      / password123');
            console.log('=============================================================\n');
        });

    } catch (error) {
        console.error('❌ Seed failed:', error);
        process.exit(1);
    }

    process.exit(0);
}

seed();
