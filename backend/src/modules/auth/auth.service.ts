import { db, adminDb } from '../../core/db';
import { authUsers as users, companies, sriEstablishments, entities, authUserRoles, authRoles, authRolePermissions, organization, member, saasPlans, saasPlanFeatures } from '@app/schema/tables';
import { eq, and, sql } from '@app/schema';
import { SAAS_PLAN_IDS, type SaasPlanId, type TaxRegimeType } from '@app/schema/enums';
import { normalizeTenantSlug } from '@app/schema/utils';
import { DomainError } from '../../core/errors';
import {
  seedCompanyRBAC,
  seedCompanySubscription,
  seedCompanyUOMs,
  seedCompanyVirtualLocations,
  seedCompanyWarehouse,
} from './provisioning.service';
import { verifyTurnstileToken, hashPassword } from '../../core/security';
import { createCredentialIdentity } from './identity.service';
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
  taxRegimeType?: TaxRegimeType;
  cedula?: string;
  phone?: string;
  planId?: SaasPlanId;
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
  },
): Promise<ProvisionResult> {
  const slug = normalizeTenantSlug(data.slug);
  if (!slug) throw new DomainError('El slug de la empresa es inválido o está reservado', 400);

  const requestedPlanId: SaasPlanId = data.planId ?? 'free';
  if (!SAAS_PLAN_IDS.includes(requestedPlanId)) {
    throw new DomainError('El plan solicitado no es válido', 400);
  }

  const [plan] = await tx
    .select({ id: saasPlans.id, isActive: saasPlans.is_active })
    .from(saasPlans)
    .where(eq(saasPlans.id, requestedPlanId))
    .limit(1);
  if (!plan || !plan.isActive) {
    throw new DomainError('El plan solicitado no está disponible', 400);
  }

  // Serialize tenant creation per user so concurrent onboarding cannot
  // bypass max_companies.
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`tenant-quota:${ownerInfo.userId}`}))`);
  const [maxCompaniesRow] = await tx
    .select({ maxCompanies: saasPlanFeatures.value_numeric })
    .from(saasPlanFeatures)
    .where(and(
      eq(saasPlanFeatures.plan_id, requestedPlanId),
      eq(saasPlanFeatures.feature_code, 'max_companies'),
    ))
    .limit(1);
  const [ownedCompanies] = await tx
    .select({ count: sql<number>`count(distinct ${companies.id})::int` })
    .from(member)
    .innerJoin(companies, eq(companies.organization_id, member.organizationId))
    .where(and(eq(member.userId, ownerInfo.userId), eq(member.status, 'ACTIVE')));
  const maxCompanies = Number(maxCompaniesRow?.maxCompanies ?? 1);
  if (Number(ownedCompanies?.count ?? 0) >= maxCompanies) {
    throw new DomainError('Has alcanzado el límite de empresas permitido por el plan seleccionado', 403, { code: 'PLAN_LIMIT_EXCEEDED' });
  }

  // 1. Validate slug & RUC uniqueness
  const [existingSlug] = await tx.select({ id: companies.id }).from(companies).where(eq(companies.slug, slug)).limit(1);
  if (existingSlug) throw new DomainError('Este identificador (slug) ya está en uso', 409);

  const [existingRuc] = await tx.select({ id: companies.id }).from(companies).where(eq(companies.ruc, data.ruc)).limit(1);
  if (existingRuc) throw new DomainError('Este RUC ya está registrado', 409);

  // 2. Create Better Auth Organization (UUIDv7)
  const orgId = uuidv7();
  const orgDisplayName = (data.tradeName && data.tradeName.trim().length > 0)
    ? data.tradeName.trim()
    : data.businessName;

  await tx.insert(organization).values({
    id: orgId,
    name: orgDisplayName,
    slug,
  });

  // 3. Create company with organization_id link
  const companyPlan = requestedPlanId;
  const [company] = await tx
    .insert(companies)
    .values({
      organization_id: orgId,
      slug,
      ruc: data.ruc,
      business_name: data.businessName,
      trade_name: data.tradeName || null,
      main_address: data.mainAddress || data.businessName,
      business_type: data.businessType || null,
      obligado_contabilidad: data.obligadoContabilidad ?? false,
      contribuyente_especial: data.contribuyenteEspecial || null,
      rimpe_type: data.taxRegimeType || 'GENERAL',
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
    tax_regime_type: data.taxRegimeType || 'GENERAL',
  }).returning();

  // 8. Create Better-Auth member (owner role) with entity_id link
  await tx.insert(member).values({
    organizationId: orgId,
    userId: ownerInfo.userId,
    role: 'owner',
    status: 'ACTIVE',
    entityId: ownerEntity.id,
  });

  // 9. Seed initial system data (Plan-aware RBAC + Subscription)
  await seedCompanyRBAC(tx, company.id, ownerInfo.userId, companyPlan);
  await seedCompanySubscription(tx, company.id, companyPlan, companyPlan === 'free' ? 'ACTIVE' : 'PENDING_PAYMENT');
  await seedCompanyUOMs(tx, company.id);
  await seedCompanyVirtualLocations(tx, company.id);
  await seedCompanyWarehouse(tx, company.id, company.main_address, ownerEntity.id);

  // 10. Query roles and permissions for initial response (type-safe Drizzle)
  const txRoles = await tx
    .select({ roleName: authRoles.name })
    .from(authUserRoles)
    .innerJoin(authRoles, and(
      eq(authUserRoles.role_id, authRoles.id),
      eq(authUserRoles.company_id, authRoles.company_id),
    ))
    .where(and(
      eq(authUserRoles.user_id, ownerInfo.userId),
      eq(authUserRoles.company_id, company.id),
    ));

  const txPermissions = await tx
    .selectDistinct({ slug: authRolePermissions.permission_slug })
    .from(authUserRoles)
    .innerJoin(authRolePermissions, and(
      eq(authUserRoles.role_id, authRolePermissions.role_id),
      eq(authUserRoles.company_id, authRolePermissions.company_id),
    ))
    .where(and(
      eq(authUserRoles.user_id, ownerInfo.userId),
      eq(authUserRoles.company_id, company.id),
    ));

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
  ipAddress?: string,
  expectedHostname?: string,
  requestId?: string,
) {
  await verifyTurnstileToken(data.turnstileToken, { action: 'register', expectedHostname, ipAddress, requestId });

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
    // Credential writes are centralized in identity.service so registration,
    // invitations and tenant-admin creation share one Better Auth-compatible
    // password/account boundary.
    const password_hash = await hashPassword(data.password);

    const user = await createCredentialIdentity(tx, {
        name: data.fullName,
        email: normalizedEmail,
        username: normalizedUsername,
        displayUsername: data.username.trim(),
        passwordHash: password_hash,
        emailVerified: isAlreadyVerified,
    });

    // Provision tenant (company, org, entities, RBAC seeds)
    const provision = await provisionTenant(tx, data, {
      userId: user.id,
      fullName: data.fullName,
      email: normalizedEmail,
    });

    // Update user with denormalized company_id (cache of last active company)
    await tx.update(users).set({
      company_id: provision.company.id,
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
      throw new DomainError(
        'La cuenta fue creada, pero no se pudo enviar el correo de verificación. Solicita un reenvío antes de continuar.',
        503,
        { code: 'INTERNAL_ERROR' },
      );
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
  ipAddress?: string,
  expectedHostname?: string,
  requestId?: string,
) {
  await verifyTurnstileToken(data.turnstileToken, { action: 'tenant_onboarding', expectedHostname, ipAddress, requestId });

  const existingUser = await adminDb.query.authUsers.findFirst({
    where: eq(users.id, userId),
  });
  if (!existingUser) {
    throw new DomainError('Usuario no encontrado', 404);
  }
  if (!existingUser.is_active) {
    throw new DomainError('La cuenta está bloqueada', 403);
  }
  if (!existingUser.emailVerified) {
    throw new DomainError('Debes verificar tu correo antes de crear una empresa', 403);
  }

  const result = await db.transaction(async (tx) => {
    // Provision tenant (company, org, entities, RBAC seeds)
    const provision = await provisionTenant(tx, data, {
      userId: existingUser.id,
      fullName: existingUser.name,
      email: existingUser.email,
    });

    // Update user with company_id (if not set yet)
    await tx.update(users).set({
      company_id: existingUser.company_id || provision.company.id,
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
