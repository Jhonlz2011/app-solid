import { db, adminDb } from '../../core/db';
import { authUsers as users, companies, sriEstablishments, entities, authUserRoles, authRoles, account, organization, member, verification } from '@app/schema/tables';
import { eq, sql } from '@app/schema';
import type { TaxRegimeType } from '@app/schema/enums';
import { DomainError } from '../../core/errors';
import {
  seedCompanyRBAC,
  seedCompanyMenus,
  seedCompanyUOMs,
  seedCompanyVirtualLocations,
  seedCompanyWarehouse,
} from './provisioning.service';
import { verifyTurnstileToken } from '../../core/security';
import { mapEntity } from './profile.service';
import { emailService } from '../../core/email';
import { env } from '../../config/env';

// ============================================================================
// CORE SAAS TENANT PROVISIONING (ONBOARDING)
// ============================================================================

/**
 * Register new tenant, owner entity, user, credential account, organization, and seed initial system data
 */
export async function register(
  data: {
    fullName: string; email: string; password: string;
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

  return await db.transaction(async (tx) => {
    const [existingSlug] = await tx.select({ id: companies.id }).from(companies).where(eq(companies.slug, data.slug)).limit(1);
    if (existingSlug) throw new DomainError('Este identificador (slug) ya está en uso', 409);

    const [existingRuc] = await tx.select({ id: companies.id }).from(companies).where(eq(companies.ruc, data.ruc)).limit(1);
    if (existingRuc) throw new DomainError('Este RUC ya está registrado', 409);

    const [company] = await tx
      .insert(companies)
      .values({
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
      price_list_id: 1,
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

    const password_hash = await Bun.password.hash(data.password, {
      algorithm: 'argon2id',
      memoryCost: 65536,
      timeCost: 2,
    });
    
    const rawUsername = data.email.split('@')[0];
    const normalizedUsername = rawUsername.toLowerCase();

    // Inserción atómica con UUIDv7 nativo de PostgreSQL 18
    const [user] = await tx
      .insert(users)
      .values({
        name: data.fullName,
        company_id: company.id,
        entity_id: ownerEntity.id,
        email: data.email.toLowerCase(),
        username: normalizedUsername,
        displayUsername: rawUsername,
        is_owner: true,
        is_active: true,
        emailVerified: false,
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

    // Create Better-Auth organization & member
    await tx.insert(organization).values({
      id: String(company.id),
      name: company.business_name,
      slug: company.slug,
    });

    await tx.insert(member).values({
      organizationId: String(company.id),
      userId: user.id,
      role: 'owner',
    });

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

    // Generate verification token and send email with tenant subdomain
    const verificationToken = crypto.randomUUID();
    await tx.insert(verification).values({
      id: crypto.randomUUID(),
      identifier: user.email,
      value: verificationToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    const tenantBaseUrl = env.NODE_ENV === 'production'
      ? `https://${company.slug}.zelys.app`
      : env.FRONTEND_URL;

    const verificationUrl = `${tenantBaseUrl}/verify-email?token=${verificationToken}`;

    // Disparar envío asíncrono sin bloquear la respuesta
    emailService.sendVerificationEmail(user.email, verificationUrl, user.name)
      .catch((err) => console.error('[AuthService] Error sending initial verification email:', err));

    return {
      company: {
        id: company.id,
        slug: company.slug,
        businessName: company.business_name,
      },
      user: {
        id: user.id,
        companyId: company.id,
        companySlug: company.slug,
        username: user.username || data.fullName,
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
}