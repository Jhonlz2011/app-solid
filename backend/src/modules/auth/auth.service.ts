import { db, adminDb } from '../../core/db';
import { authUsers as users, companies, sriEstablishments, entities, authUserRoles, authRoles, account, organization, member } from '@app/schema/tables';
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
// CORE SAAS TENANT PROVISIONING (ONBOARDING)
// ============================================================================

/**
 * Register new tenant, owner entity, user, credential account, organization, and seed initial system data.
 * 
 * Flow:
 * 1. Create company (ERP domain)
 * 2. Create organization (Better Auth) & link via companies.organization_id
 * 3. Create user with username/displayUsername
 * 4. Create credential account
 * 5. Create member with role 'owner' + entity_id
 * 6. Seed RBAC, menus, UOMs, locations, warehouse
 */
export async function register(
  data: {
    fullName: string; username: string; email: string; password: string;
    phone?: string; cedula?: string;
    slug: string; ruc: string; businessName: string; tradeName?: string;
    businessType?: string; mainAddress?: string;
    obligadoContabilidad?: boolean; contribuyenteEspecial?: string; taxRegime?: string;
    turnstileToken?: string;
  },
  _userAgent?: string,
  ipAddress?: string
) {
  await verifyTurnstileToken(data.turnstileToken, ipAddress);

  const normalizedUsername = data.username.trim().toLowerCase();
  const normalizedEmail = data.email.trim().toLowerCase();

  // 1. Validar unicidad global del username
  const existingUsername = await adminDb.query.authUsers.findFirst({
    where: eq(users.username, normalizedUsername),
  });
  if (existingUsername) {
    throw new DomainError('Este nombre de usuario ya está registrado en el sistema', 409);
  }

  // 2. Comprobar si el email ya fue verificado globalmente en cualquier cuenta previa
  const globallyVerifiedUser = await adminDb.query.authUsers.findFirst({
    where: and(
      eq(users.email, normalizedEmail),
      eq(users.emailVerified, true)
    ),
  });
  const isAlreadyVerified = Boolean(globallyVerifiedUser);

  const result = await db.transaction(async (tx) => {
    const [existingSlug] = await tx.select({ id: companies.id }).from(companies).where(eq(companies.slug, data.slug)).limit(1);
    if (existingSlug) throw new DomainError('Este identificador (slug) ya está en uso', 409);

    const [existingRuc] = await tx.select({ id: companies.id }).from(companies).where(eq(companies.ruc, data.ruc)).limit(1);
    if (existingRuc) throw new DomainError('Este RUC ya está registrado', 409);

    // 1. Create Better Auth Organization first (UUIDv7)
    const orgId = uuidv7();
    await tx.insert(organization).values({
      id: orgId,
      name: data.businessName,
      slug: data.slug,
    });

    // 2. Create company with organization_id link
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

    await tx.execute(sql`SELECT set_config('app.current_company_id', ${company.id.toString()}, true)`);

    await tx.insert(sriEstablishments).values({
      company_id: company.id,
      code: '001',
      name: 'Matriz',
      address: company.main_address,
      emission_points: ['001'],
    });

    await tx.insert(entities).values({
      company_id: company.id,
      tax_id: '9999999999999',
      tax_id_type: 'CONSUMIDOR_FINAL',
      person_type: 'NATURAL',
      business_name: 'CONSUMIDOR FINAL',
      is_client: true,
      is_system: true,
    });

    const [ownerEntity] = await tx.insert(entities).values({
      company_id: company.id,
      tax_id: data.cedula || data.ruc,
      tax_id_type: data.cedula ? 'CEDULA' : 'RUC',
      person_type: 'NATURAL',
      business_name: data.fullName,
      phone: data.phone || null,
      email_billing: data.email,
      is_employee: true,
      tax_regime_type: (data.taxRegime || 'GENERAL') as TaxRegimeType,
    }).returning();

    const password_hash = await hashPassword(data.password);

    // 3. Create user with explicit username and displayUsername
    const [user] = await tx
      .insert(users)
      .values({
        name: data.fullName,
        company_id: company.id,          // Denormalized cache
        entity_id: ownerEntity.id,       // Denormalized cache
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

    // 4. Create Better-Auth credential account
    await tx.insert(account).values({
      accountId: user.id,
      providerId: 'credential',
      userId: user.id,
      password: password_hash,
    });

    // 5. Create Better-Auth member (owner role) with entity_id link
    await tx.insert(member).values({
      organizationId: orgId,
      userId: user.id,
      role: 'owner',
      entityId: ownerEntity.id,
    });

    // 6. Seed initial system data
    await seedCompanyRBAC(tx, company.id, user.id);
    await seedCompanyMenus(tx);
    await seedCompanyUOMs(tx, company.id);
    await seedCompanyVirtualLocations(tx, company.id);
    await seedCompanyWarehouse(tx, company.id, company.main_address, ownerEntity.id);

    // Roles and permissions for initial response
    const txRoles = await tx
      .select({ roleName: authRoles.name })
      .from(authUserRoles)
      .innerJoin(authRoles, eq(authUserRoles.role_id, authRoles.id))
      .where(eq(authUserRoles.user_id, user.id));

    const txPermissions = await tx.execute(sql`
      SELECT DISTINCT ap.slug
      FROM auth_user_roles ur
      JOIN auth_role_permissions rp ON ur.role_id = rp.role_id
      JOIN auth_permissions ap ON rp.permission_id = ap.id
      WHERE ur.user_id = ${user.id}
    `);

    const roles = txRoles.map(r => r.roleName);
    const permissions = (txPermissions as unknown as { slug: string }[]).map(r => r.slug);

    return {
      company: {
        id: company.id,
        slug: company.slug,
        businessName: company.business_name,
        organizationId: orgId,
      },
      user: {
        id: user.id,
        companyId: company.id,
        companySlug: company.slug,
        username: user.username || data.username,
        email: user.email,
        isActive: user.is_active,
        lastLogin: user.last_login,
        entityId: user.entity_id,
        emailVerifiedAt: user.emailVerified ? new Date() : null,
        roles,
        permissions,
        entity: mapEntity(ownerEntity),
      },
    };
  });

  // Si el email no ha sido verificado globalmente, disparar el envío de verificación
  if (!isAlreadyVerified) {
    // 1. Limpiar cualquier cooldown previo en Redis para asegurar el envío en un nuevo registro
    await redis.del(`email_cooldown:${result.user.email.toLowerCase()}`).catch(() => {});

    // 2. Disparar envío automático de email de verificación vía Better Auth
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