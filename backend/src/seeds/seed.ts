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
} from '@app/schema/tables';
import { sql, eq, and } from '@app/schema';
import {
    seedCompanyRBAC,
    seedCompanyMenus,
    seedCompanyUOMs,
    seedCompanyVirtualLocations,
    seedCompanyWarehouse,
} from '../modules/auth/provisioning.service';
import { UOM_DATA } from './seed-data';
import { v7 as uuidv7 } from 'uuid';

async function seed() {
    console.log('🌱 Starting Complete System & Better-Auth Seed...\n');

    try {
        // =========================================================================
        // 0. CREATE / VERIFY DEFAULT DEV COMPANY & BETTER-AUTH ORGANIZATION
        // =========================================================================
        console.log('🏢 Creating / verifying default dev company...');
        const [devCompany] = await db
            .insert(companies)
            .values({
                slug: 'dev',
                ruc: '9999999999001',
                business_name: 'Empresa de Desarrollo',
                trade_name: 'DevCo',
                main_address: 'Dirección de prueba',
                business_type: 'COMERCIO',
            })
            .onConflictDoUpdate({
                target: companies.ruc,
                set: { business_name: 'Empresa de Desarrollo', slug: 'dev' },
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
                    is_active: true,
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
            const hashedPassword = await Bun.password.hash(defaultPassword, {
                algorithm: 'argon2id',
                memoryCost: 65536,
                timeCost: 2,
            });

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
            // 5. SEED RBAC ROLES & PERMISSIONS FOR DEV COMPANY
            // =====================================================================
            console.log('\n🛡️ Seeding company RBAC roles & permissions...');
            const superadminId = userIds.get('superadmin') || '';
            const roleMap = await seedCompanyRBAC(db as any, devCompany.id, superadminId);
            console.log(`   ✅ Roles & permissions linked (owner assigned to superadmin)`);

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
            // 6. SUMMARY & VERIFICATION
            // =====================================================================
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
            console.log(`📊 Statistics:`);
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
