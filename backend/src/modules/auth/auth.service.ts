import { db, adminDb, withTenantContext } from '../../core/db';
import { authUsers as users, sessions, companies, sriEstablishments, entities, authUserRoles, authRoles, authVerificationTokens } from '@app/schema/tables';
import { eq, and, inArray, or, sql } from '@app/schema';
import type { TaxRegimeType } from '@app/schema/enums';
import { getUserRoles, getUserPermissions } from '../users/rbac.service';
import { broadcast } from '../../core/sse';
import { SESSION_EXPIRE_DAYS, getVerificationLink } from '../../config/auth';
import { cacheService } from '../../core/cache';
import { RealtimeEvents } from '@app/schema/realtime-events';
import { DomainError } from '../../core/errors';
import {
  seedCompanyRBAC,
  seedCompanyMenus,
  seedCompanyUOMs,
  seedCompanyVirtualLocations,
  seedCompanyWarehouse,
} from './provisioning.service';
import { emailService } from '../../core/email';
import { verifyTurnstileToken } from '../../core/security';
import { AuthError, generateSessionToken, hashToken } from './session.service';
import { mapEntity } from './profile.service';

// Re-export sub-services for backward-compatible facade
export * from './session.service';
export * from './verification.service';
export * from './profile.service';

const MAX_SESSIONS = 5;

// ============================================================================
// CORE AUTHENTICATION & PROVISIONING
// ============================================================================

/**
 * Register new tenant, owner entity, user, verification tokens, and seed initial system data
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
  userAgent?: string,
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

    const password_hash = await Bun.password.hash(data.password);
    const [user] = await tx
      .insert(users)
      .values({
        company_id: company.id,
        entity_id: ownerEntity.id,
        email: data.email,
        username: data.email.split('@')[0],
        password_hash,
        is_owner: true,
      })
      .returning({
        id: users.id,
        entity_id: users.entity_id,
        username: users.username,
        email: users.email,
        is_active: users.is_active,
        last_login: users.last_login,
        email_verified_at: users.email_verified_at,
      });

    await seedCompanyRBAC(tx, company.id, user.id);
    await seedCompanyMenus(tx);
    await seedCompanyUOMs(tx, company.id);
    await seedCompanyVirtualLocations(tx, company.id);
    await seedCompanyWarehouse(tx, company.id, company.main_address, ownerEntity.id);

    const rawToken = generateSessionToken();
    const tokenHash = hashToken(rawToken);
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    await tx.insert(authVerificationTokens).values({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: tokenExpiry,
    });

    const verificationLink = getVerificationLink(company.slug, rawToken);
    emailService.sendVerificationEmail(user.email, verificationLink, data.fullName).catch(err => {
      console.error('Failed to send verification email during registration:', err);
    });

    const sessionId = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_EXPIRE_DAYS * 24 * 60 * 60 * 1000);
    await tx.insert(sessions).values({
      id: sessionId,
      user_id: user.id,
      company_id: company.id,
      expires_at: expiresAt,
      user_agent: userAgent,
      ip_address: ipAddress,
    });

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
      sessionId,
      user: {
        id: user.id,
        companyId: company.id,
        username: user.username,
        email: user.email,
        isActive: user.is_active,
        lastLogin: user.last_login,
        entityId: user.entity_id,
        emailVerifiedAt: user.email_verified_at,
        roles,
        permissions,
        entity: mapEntity(ownerEntity),
      },
    };
  });
}

/**
 * Login with email/username, timing attack protection, and multi-tenant discovery
 */
export async function login(email: string, password: string, userAgent?: string, ipAddress?: string, companyId?: number, turnstileToken?: string) {
  await verifyTurnstileToken(turnstileToken, ipAddress);

  const matchedUsers = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_username', ${email}, true)`);
    const conditions = [or(eq(users.email, email), eq(users.username, email))];
    if (companyId !== undefined) {
      conditions.push(eq(users.company_id, companyId));
    }
    return await tx.query.authUsers.findMany({
      where: and(...conditions),
      with: { entity: true },
      limit: 5,
    });
  });

  if (matchedUsers.length === 0) {
    const DUMMY_HASH = '$argon2id$v=19$m=65536,t=2,p=1$njOSfwJnFaGrpYbhNmtmmyTeQ3Zr/vK+n+vYhtMpGxw$xEeAHQScZ8hNn2xngO0I8o0jgQX7wfinz+WEIsxiuoE';
    await Bun.password.verify(password, DUMMY_HASH);
    throw new AuthError('Credenciales inválidas');
  }

  const verificationPromises = matchedUsers.map(async (u) => {
    const valid = await Bun.password.verify(password, u.password_hash);
    return { user: u, valid };
  });

  const results = await Promise.all(verificationPromises);
  const verifiedUsers = results.filter(r => r.valid).map(r => r.user);

  if (verifiedUsers.length === 0) {
    throw new AuthError('Credenciales inválidas');
  }

  const activeVerifiedUsers = verifiedUsers.filter(u => u.is_active);
  if (activeVerifiedUsers.length === 0) {
    throw new AuthError('Usuario desactivado', 403);
  }

  if (activeVerifiedUsers.length > 1 && companyId === undefined) {
    const companyIds = activeVerifiedUsers.map(u => u.company_id);
    const verifiedCompanies = await adminDb
      .select({
        id: companies.id,
        slug: companies.slug,
        businessName: companies.business_name,
        tradeName: companies.trade_name,
        logoUrl: companies.logo_url,
      })
      .from(companies)
      .where(inArray(companies.id, companyIds));

    return {
      requiresTenantSelection: true as const,
      tenants: verifiedCompanies,
    };
  }

  const user = activeVerifiedUsers[0];

  const [roles, permissions, [company]] = await Promise.all([
    getUserRoles(user.id),
    getUserPermissions(user.id),
    adminDb
      .select({ slug: companies.slug })
      .from(companies)
      .where(eq(companies.id, user.company_id))
      .limit(1),
  ]);

  const companySlug = company?.slug;
  const sessionId = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_EXPIRE_DAYS * 24 * 60 * 60 * 1000);

  await withTenantContext({ companyId: user.company_id }, async () => {
    const activeSessions = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.user_id, user.id))
      .orderBy(sessions.created_at);

    const MAX = MAX_SESSIONS;
    if (activeSessions.length >= MAX) {
      const toDelete = activeSessions.slice(0, activeSessions.length - MAX + 1);
      await db.delete(sessions).where(inArray(sessions.id, toDelete.map(s => s.id)));
    }

    await Promise.all([
      db.insert(sessions).values({
        id: sessionId,
        user_id: user.id,
        company_id: user.company_id,
        expires_at: expiresAt,
        user_agent: userAgent,
        ip_address: ipAddress,
      }),
      db.update(users).set({ last_login: new Date() }).where(eq(users.id, user.id)),
    ]);
  });

  broadcast(RealtimeEvents.USER.SESSION_CREATED, { id: user.id, sessionId }, `user:${user.id}`);

  return {
    sessionId,
    user: {
      id: user.id,
      companyId: user.company_id,
      companySlug,
      email: user.email,
      username: user.username,
      isActive: user.is_active,
      lastLogin: user.last_login,
      entityId: user.entity_id,
      emailVerifiedAt: user.email_verified_at,
      roles,
      permissions,
      entity: mapEntity(user.entity),
    },
  };
}

/**
 * Logout and revoke session
 */
export async function logout(sessionId: string) {
  const deleted = await adminDb
    .delete(sessions)
    .where(eq(sessions.id, sessionId))
    .returning({ user_id: sessions.user_id });

  if (deleted.length > 0) {
    const userId = deleted[0].user_id;
    broadcast(RealtimeEvents.USER.SESSION_REVOKED, { id: userId, sessionId }, `user:${userId}`);
    cacheService.invalidate(`session:${sessionId}`);
  }
}