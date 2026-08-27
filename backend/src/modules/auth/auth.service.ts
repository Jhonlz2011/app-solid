import { db, adminDb } from '../../core/db';
import { authUsers as users, companies, sriEstablishments, entities, authUserRoles, authRoles, authRolePermissions, authPermissions, account, organization, member } from '@app/schema/tables';
import { eq, and, sql } from '@app/schema';
import type { TaxRegimeType } from '@app/schema/enums';
import { DomainError } from '../../core/errors';
import {
  seedCompanyRBAC,
  seedCompanyMenus,
  seedCompanyUOMs,
  seedCompanyVirtualLocations,
  seedCompanyWarehouse,
} from './provisioning.service';
import { verifyTurnstileToken, hashPassword } from '../../core/security';
import { v7 as uuidv7 } from 'uuid';
import { mapEntity } from '../profile/profile.service';
import { auth } from '../../config/better-auth';
import { env } from '../../config/env';
import { redis } from '../../core/cache/redis';

// ============================================================================
// SHARED TYPES
// ============================================================================

interface CompanyData {
  slug: string;
  ruc: string;
  businessName: string;
  tradeName?: string;
  businessType?: string;
  mainAddress?: string;
  obligadoContabilidad?: boolean;
  contribuyenteEspecial?: string;
  taxRegime?: string;
  cedula?: string;
  phone?: string;
}

interface ProvisionResult {
  company: {
    id: number;
    slug: string;
    businessName: string;
    organizationId: string;
  };
  user: {
    id: string;
    companyId: number;
    companySlug: string;
    username: string | null;
    email: string;
    isActive: boolean | null;
    lastLogin: Date | null;
    entityId: string | null;
    emailVerifiedAt: Date | null;
    roles: string[];
    permissions: string[];
    entity: ReturnType<typeof mapEntity>;
  };
}

// ============================================================================
// CORE TENANT PROVISIONING (Shared between register & onboard)
// ============================================================================

/**
 * Provisions a new tenant: Company, Organization, Owner Entity, RBAC seeds.
 * Called by both `register()` (new user) and `onboardTenant()` (existing OAuth user).
 */
async function provisionTenant(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  data: CompanyData,
  ownerInfo: {
    userId: string;
    fullName: string;
    email: string;
    entityId?: string | null;
    companyId?: number | null;
  },
): Promise<ProvisionResult> {
  // 1. Validate slug & RUC uniqueness
  const [existingSlug] = await tx.select({ id: companies.id }).from(companies).where(eq(companies.slug, data.slug)).limit(1);
  if (existingSlug) throw new DomainError('Este identificador (slug) ya está en uso', 409);

  const [existingRuc] = await tx.select({ id: companies.id }).from(companies).where(eq(companies.ruc, data.ruc)).limit(1);
  if (existingRuc) throw new DomainError('Este RUC ya está registrado', 409);

  // 2. Create Better Auth Organization (UUIDv7)
  const orgId = uuidv7();
  await tx.insert(organization).values({
    id: orgId,
    name: data.businessName,
    slug: data.slug,
  });

  // 3. Create company with organization_id link
  const [company] = await tx
    .insert(companies)
    .values({
      organization_id: orgId,
      slug: data.slug,
      ruc: data.ruc,
      business_name: data.businessName,
      trade_name: data.tradeName || null,
      main_address: data.mainAddress || data.businessName,
      business_type: data.businessType || null,
      obligado_contabilidad: data.obligadoContabilidad ?? false,
      contribuyente_especial: data.contribuyenteEspecial || null,
      rimpe_type: (data.taxRegime || 'GENERAL') as TaxRegimeType,
    })
    .returning();

  // 4. Set RLS context for tenant-scoped inserts
  await tx.execute(sql`SELECT set_config('app.current_company_id', ${company.id.toString()}, true)`);

  // 5. Seed default SRI establishment
  await tx.insert(sriEstablishments).values({
    company_id: company.id,
    code: '001',
    name: 'Matriz',
    address: company.main_address,
    emission_points: ['001'],
  });

  // 6. Seed Consumidor Final entity
  await tx.insert(entities).values({
    company_id: company.id,
    tax_id: '9999999999999',
    tax_id_type: 'CONSUMIDOR_FINAL',
    person_type: 'NATURAL',
    business_name: 'CONSUMIDOR FINAL',
    is_client: true,
    is_system: true,
  });

  // 7. Create owner entity
  const [ownerEntity] = await tx.insert(entities).values({
    company_id: company.id,
    tax_id: data.cedula || data.ruc,
    tax_id_type: data.cedula ? 'CEDULA' : 'RUC',
    person_type: 'NATURAL',
    business_name: ownerInfo.fullName,
    phone: data.phone || null,
    email_billing: ownerInfo.email,
    is_employee: true,
    tax_regime_type: (data.taxRegime || 'GENERAL') as TaxRegimeType,
  }).returning();

  // 8. Create Better-Auth member (owner role) with entity_id link
  await tx.insert(member).values({
    organizationId: orgId,
    userId: ownerInfo.userId,
    role: 'owner',
    entityId: ownerEntity.id,
  });

  // 9. Seed initial system data
  await seedCompanyRBAC(tx, company.id, ownerInfo.userId);
  await seedCompanyMenus(tx);
  await seedCompanyUOMs(tx, company.id);
  await seedCompanyVirtualLocations(tx, company.id);
  await seedCompanyWarehouse(tx, company.id, company.main_address, ownerEntity.id);

  // 10. Query roles and permissions for initial response (type-safe Drizzle)
  const txRoles = await tx
    .select({ roleName: authRoles.name })
    .from(authUserRoles)
    .innerJoin(authRoles, eq(authUserRoles.role_id, authRoles.id))
    .where(eq(authUserRoles.user_id, ownerInfo.userId));

  const txPermissions = await tx
    .selectDistinct({ slug: authPermissions.slug })
    .from(authUserRoles)
    .innerJoin(authRolePermissions, eq(authUserRoles.role_id, authRolePermissions.role_id))
    .innerJoin(authPermissions, eq(authRolePermissions.permission_id, authPermissions.id))
    .where(eq(authUserRoles.user_id, ownerInfo.userId));

  const roles = txRoles.map(r => r.roleName);
  const permissions = txPermissions.map(r => r.slug);

  return {
    company: {
      id: company.id,
      slug: company.slug,
      businessName: company.business_name,
      organizationId: orgId,
    },
    user: {
      id: ownerInfo.userId,
      companyId: company.id,
      companySlug: company.slug,
      username: null,  // Overridden by caller
      email: ownerInfo.email,
      isActive: true,
      lastLogin: null,
      entityId: ownerEntity.id,
      emailVerifiedAt: null,  // Overridden by caller
      roles,
      permissions,
      entity: mapEntity(ownerEntity),
    },
  };
}

// ============================================================================
// PUBLIC API: Register (new user + new tenant)
// ============================================================================

/**
 * Register new tenant, owner entity, user, credential account, organization, and seed initial system data.
 */
export async function register(
  data: CompanyData & {
    fullName: string;
    username: string;
    email: string;
    password: string;
    turnstileToken?: string;
  },
  _userAgent?: string,
  ipAddress?: string
) {
  await verifyTurnstileToken(data.turnstileToken, ipAddress);

  const normalizedUsername = data.username.trim().toLowerCase();
  const normalizedEmail = data.email.trim().toLowerCase();

  // Validate global username uniqueness
  const existingUsername = await adminDb.query.authUsers.findFirst({
    where: eq(users.username, normalizedUsername),
  });
  if (existingUsername) {
    throw new DomainError('Este nombre de usuario ya está registrado en el sistema', 409);
  }

  // Check if the email was already verified globally in any previous account
  const globallyVerifiedUser = await adminDb.query.authUsers.findFirst({
    where: and(
      eq(users.email, normalizedEmail),
      eq(users.emailVerified, true)
    ),
  });
  const isAlreadyVerified = Boolean(globallyVerifiedUser);

  const result = await db.transaction(async (tx) => {
    // ⚠️ CRITICAL: hashPassword() is called MANUALLY here because this flow
    // bypasses Better Auth's signUp.email() — which would hash via argon2PasswordConfig.
    // If migrating to signUp.email(), remove this manual hash.
    const password_hash = await hashPassword(data.password);

    // Create user with explicit username and displayUsername
    const [user] = await tx
      .insert(users)
      .values({
        name: data.fullName,
        email: normalizedEmail,
        username: normalizedUsername,
        displayUsername: data.username.trim(),
        is_active: true,
        emailVerified: isAlreadyVerified,
      })
      .returning({
        id: users.id,
        entity_id: users.entity_id,
        username: users.username,
        email: users.email,
        is_active: users.is_active,
        last_login: users.last_login,
        emailVerified: users.emailVerified,
      });

    // Create Better-Auth credential account
    await tx.insert(account).values({
      accountId: user.id,
      providerId: 'credential',
      userId: user.id,
      password: password_hash,
    });

    // Provision tenant (company, org, entities, RBAC seeds)
    const provision = await provisionTenant(tx, data, {
      userId: user.id,
      fullName: data.fullName,
      email: normalizedEmail,
    });

    // Update user with denormalized company_id and entity_id
    await tx.update(users).set({
      company_id: provision.company.id,
      entity_id: provision.user.entityId,
    }).where(eq(users.id, user.id));

    return {
      ...provision,
      user: {
        ...provision.user,
        username: user.username || data.username,
        isActive: user.is_active,
        lastLogin: user.last_login,
        emailVerifiedAt: user.emailVerified ? new Date() : null,
      },
    };
  });

  // If email hasn't been verified globally, trigger verification email
  if (!isAlreadyVerified) {
    await redis.del(`email_cooldown:${result.user.email.toLowerCase()}`).catch(() => {});

    try {
      await auth.api.sendVerificationEmail({
        body: {
          email: result.user.email,
          callbackURL: '/verify-email',
        },
        headers: new Headers({
          origin: env.BETTER_AUTH_URL,
        }),
      });
    } catch (err) {
      console.error('[Register] Error sending verification email:', err);
    }
  }

  return result;
}

// ============================================================================
// PUBLIC API: Onboard (existing OAuth user → new tenant)
// ============================================================================

/**
 * Onboard existing authenticated user (e.g. from Google / Microsoft OAuth):
 * Creates Company, Better Auth Organization, Owner Entity, seeds RBAC, Menus, UOMs, Locations, Warehouse,
 * and sets the user as Organization owner.
 */
export async function onboardTenant(
  userId: string,
  data: CompanyData & { turnstileToken?: string },
  ipAddress?: string
) {
  await verifyTurnstileToken(data.turnstileToken, ipAddress);

  const existingUser = await adminDb.query.authUsers.findFirst({
    where: eq(users.id, userId),
  });
  if (!existingUser) {
    throw new DomainError('Usuario no encontrado', 404);
  }

  const result = await db.transaction(async (tx) => {
    // Provision tenant (company, org, entities, RBAC seeds)
    const provision = await provisionTenant(tx, data, {
      userId: existingUser.id,
      fullName: existingUser.name,
      email: existingUser.email,
      entityId: existingUser.entity_id,
      companyId: existingUser.company_id,
    });

    // Update user with company_id and entity_id (if not set yet)
    await tx.update(users).set({
      company_id: existingUser.company_id || provision.company.id,
      entity_id: existingUser.entity_id || provision.user.entityId,
      updatedAt: new Date(),
    }).where(eq(users.id, userId));

    return {
      ...provision,
      user: {
        ...provision.user,
        username: existingUser.username,
        isActive: existingUser.is_active,
        lastLogin: existingUser.last_login,
        emailVerifiedAt: existingUser.emailVerified ? new Date() : null,
      },
    };
  });

  return result;
}