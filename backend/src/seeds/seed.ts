// src/seeds/seed.ts
// Run with: bun run db:seed
import { db, withTenantContext } from '../db';
import { authPermissions, authRoles, authRolePermissions, authUserRoles, authUsers, uom, entities, companies, sriEstablishments, authMenuItems, warehouseLocations } from '@app/schema/tables';
import { sql } from '@app/schema';
import { PERMISSIONS, ROLES, ROLE_PERMISSIONS, UOM_DATA, DERIVED_UOM_DATA, MENU_ITEMS } from './seed-data';

async function seedMenuItems() {
    console.log('\n🌱 Starting Menu Items seed...');
    console.log('📂 Inserting parent menu items...');
    const parentMap = new Map<string, number>();

    for (const item of MENU_ITEMS) {
        const [result] = await db
            .insert(authMenuItems)
            .values({
                key: item.key,
                label: item.label,
                icon: item.icon,
                path: item.path || null,
                parent_id: null,
                sort_order: item.sort_order,
                permission_prefix: item.permission_prefix || null,
            })
            .onConflictDoUpdate({
                target: authMenuItems.key,
                set: {
                    label: item.label,
                    icon: item.icon,
                    path: item.path || null,
                    sort_order: item.sort_order,
                    permission_prefix: item.permission_prefix || null,
                }
            })
            .returning({ id: authMenuItems.id });

        parentMap.set(item.key, result.id);
        console.log(`   ✅ ${item.label} (id: ${result.id})`);
    }

    console.log('\n📁 Inserting child menu items...');
    for (const parent of MENU_ITEMS) {
        if (!parent.children) continue;

        const parentId = parentMap.get(parent.key);
        if (!parentId) continue;

        for (const child of parent.children) {
            const [result] = await db
                .insert(authMenuItems)
                .values({
                    key: child.key,
                    label: child.label,
                    icon: child.icon,
                    path: child.path || null,
                    parent_id: parentId,
                    sort_order: child.sort_order,
                    permission_prefix: child.permission_prefix || null,
                })
                .onConflictDoUpdate({
                    target: authMenuItems.key,
                    set: {
                        label: child.label,
                        icon: child.icon,
                        path: child.path || null,
                        parent_id: parentId,
                        sort_order: child.sort_order,
                        permission_prefix: child.permission_prefix || null,
                    }
                })
                .returning({ id: authMenuItems.id });

            console.log(`   └─ ${child.label} (id: ${result.id})`);
        }
    }
}

async function seed() {
    console.log('🌱 Starting RBAC seed...');

    try {
        // 0. Create default dev company
        console.log('🏢 Creating default dev company...');
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
        console.log(`   ✅ Company created/verified: ${devCompany.business_name} (id: ${devCompany.id})`);

        // 1. Insert UOMs (global system UOMs, company_id = null)
        console.log('📏 Inserting system UOMs...');
        for (const unit of UOM_DATA) {
            await db
                .insert(uom)
                .values({ ...unit, company_id: null, is_system: true })
                .onConflictDoNothing();
        }
        console.log(`   ✅ ${UOM_DATA.length} system UOMs processed`);

        await withTenantContext({ companyId: devCompany.id }, async () => {
            console.log('📏 Inserting derived UOMs for dev company...');
            for (const unit of DERIVED_UOM_DATA) {
                await db
                    .insert(uom)
                    .values({ ...unit, company_id: devCompany.id, is_system: false })
                    .onConflictDoNothing();
            }
            console.log(`   ✅ ${DERIVED_UOM_DATA.length} derived UOMs processed`);

            // 2. Insert permissions (global, not company-scoped)
            console.log('📝 Inserting permissions...');
            for (const perm of PERMISSIONS) {
                await db
                    .insert(authPermissions)
                    .values(perm)
                    .onConflictDoNothing({ target: authPermissions.slug });
            }
            console.log(`   ✅ ${PERMISSIONS.length} permissions processed`);

            // 3. Insert roles (upsert)
            console.log('👥 Inserting roles...');
            for (const role of ROLES) {
                await db
                    .insert(authRoles)
                    .values({ ...role, company_id: devCompany.id })
                    .onConflictDoNothing({ target: [authRoles.company_id, authRoles.name] });
            }
            console.log(`   ✅ ${ROLES.length} roles processed`);

            // 4. Get all permissions and roles from DB
            const allPermissions = await db.select().from(authPermissions);
            const allRoles = await db.select().from(authRoles);

            const permMap = new Map(allPermissions.map(p => [p.slug, p.id]));
            const roleMap = new Map(allRoles.map(r => [r.name, r.id]));

            // 5. Assign permissions to roles
            console.log('🔗 Assigning permissions to roles...');
            for (const [roleName, checkFn] of Object.entries(ROLE_PERMISSIONS)) {
                const roleId = roleMap.get(roleName);
                if (!roleId) continue;

                const permissionsForRole = PERMISSIONS
                    .filter(p => checkFn(p.slug))
                    .map(p => permMap.get(p.slug))
                    .filter((id): id is number => id !== undefined);

                for (const permissionId of permissionsForRole) {
                    await db
                        .insert(authRolePermissions)
                        .values({ role_id: roleId, permission_id: permissionId, company_id: devCompany.id })
                        .onConflictDoNothing();
                }

                console.log(`   ✅ ${roleName}: ${permissionsForRole.length} permissions`);
            }

            // 6. Create default SRI establishment
            console.log('🏗️ Creating default SRI establishment...');
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
            console.log('   ✅ SRI establishment created/verified');

            // 7. Create Consumidor Final Client
            console.log('🏢 Creating default CONSUMIDOR FINAL client...');
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
                    obligado_contabilidad: false,
                })
                .onConflictDoUpdate({
                    target: [entities.company_id, entities.tax_id],
                    set: { business_name: 'CONSUMIDOR FINAL' }
                })
                .returning();
            console.log(`   ✅ Entity created/verified: ${consumidorFinal.business_name}`);

            // 7.5 Create dev company virtual locations
            console.log('🏢 Seeding virtual locations for dev company...');
            const devVirtuals = [
                { name: 'Virtual: Proveedores', type: 'SUPPLIER' as const },
                { name: 'Virtual: Clientes', type: 'CUSTOMER' as const },
                { name: 'Virtual: Ajustes y Mermas', type: 'ADJUSTMENT' as const },
                { name: 'Virtual: Consumo Producción', type: 'PRODUCTION' as const },
            ];
            for (const v of devVirtuals) {
                await db.insert(warehouseLocations).values({
                    company_id: devCompany.id,
                    warehouse_id: null,
                    parent_id: null,
                    name: v.name,
                    path: '', // Trigger BEFORE INSERT recalculates and overrides this
                    type: v.type,
                    depth: 0,
                    is_active: true,
                }).onConflictDoNothing();
            }
            console.log('   ✅ Virtual locations seeded/verified');

            // 8. Create Default Users
            console.log('👤 Creating default users...');

            const defaultPassword = 'password123';
            const hashedPassword = await Bun.password.hash(defaultPassword);

            const usersToCreate = [
                {
                    username: 'superadmin',
                    email: 'superadmin@zelys.app',
                    role: 'superadmin',
                    is_owner: true,
                    is_verified: true,
                    entity_id: null
                },
                {
                    username: 'admin',
                    email: 'admin@zelys.app',
                    role: 'admin',
                    entity_id: null
                }
            ];

            for (const userData of usersToCreate) {
                // Check if user exists
                const existingUser = await db.select().from(authUsers).where(sql`${authUsers.email} = ${userData.email}`).limit(1);

                let userId;

                if (existingUser.length === 0) {
                    const [newUser] = await db.insert(authUsers).values({
                        company_id: devCompany.id,
                        username: userData.username,
                        email: userData.email,
                        password_hash: hashedPassword,
                        is_active: true,
                        is_owner: userData.is_owner ?? false,
                        email_verified_at: new Date(), // pre-verify seed user
                        entity_id: userData.entity_id
                    }).returning();
                    userId = newUser.id;
                    console.log(`  ✅ Created user: ${userData.username}`);
                } else {
                    userId = existingUser[0].id;
                    console.log(`  ℹ️ User already exists: ${userData.username}`);
                    // Ensure the existing user is verified and updated
                    await db.update(authUsers).set({
                        is_owner: userData.is_owner ?? false,
                        email_verified_at: existingUser[0].email_verified_at || new Date()
                    }).where(sql`${authUsers.id} = ${userId}`);
                }

                // Assign Role
                const roleId = roleMap.get(userData.role);
                if (roleId) {
                    await db
                        .insert(authUserRoles)
                        .values({ user_id: userId, role_id: roleId, company_id: devCompany.id })
                        .onConflictDoNothing();
                    console.log(`   🔗 Assigned role ${userData.role} to ${userData.username}`);
                } else {
                    console.warn(`   ⚠️ Role ${userData.role} not found for user ${userData.username}`);
                }
            }

            // 9. Seed Menu Items
            await seedMenuItems();

            console.log('\n✅ Seed completed successfully!');

            // Verification
            const permCount = await db.select({ count: sql<number>`count(*)` }).from(authPermissions);
            const roleCount = await db.select({ count: sql<number>`count(*)` }).from(authRoles);
            const userCount = await db.select({ count: sql<number>`count(*)` }).from(authUsers);
            const companyCount = await db.select({ count: sql<number>`count(*)` }).from(companies);
            const menuCount = await db.select({ count: sql<number>`count(*)` }).from(authMenuItems);

            console.log(`\n📊 Summary:`);
            console.log(`   - Total companies: ${companyCount[0].count}`);
            console.log(`   - Total permissions: ${permCount[0].count}`);
            console.log(`   - Total roles: ${roleCount[0].count}`);
            console.log(`   - Total users: ${userCount[0].count}`);
            console.log(`   - Total menu items: ${menuCount[0].count}`);
        });


    } catch (error) {
        console.error('❌ Seed failed:', error);
        process.exit(1);
    }

    process.exit(0);
}

seed();
