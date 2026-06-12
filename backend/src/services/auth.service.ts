import { db, adminDb, withTenantContext } from '../db';
import { authUsers as users, sessions, companies, sriEstablishments, entities, authUserRoles, authRoles, authVerificationTokens } from '@app/schema/tables';
import { eq, and, gt, inArray, or, sql } from '@app/schema';
import type { Entity } from '@app/schema/types';
import { getUserRoles, getUserPermissions } from './rbac.service';
import { broadcast } from '../plugins/sse';
import { SESSION_EXPIRE_DAYS, getVerificationLink } from '../config/auth';
import { cacheService } from './cache.service';
import { RealtimeEvents } from '@app/schema/realtime-events';
import geoip from 'geoip-lite';
import { DomainError } from './errors';
import {
  seedCompanyRBAC,
  seedCompanyMenus,
  seedCompanyUOMs,
  seedCompanyVirtualLocations,
} from './tenant-provisioning.service';
import { emailService } from './email.service';
import { env } from '../config/env';
import { redis } from '../config/redis';


// --- CONSTANTS ---
const SESSION_REFRESH_THRESHOLD_DAYS = Math.floor(SESSION_EXPIRE_DAYS / 2);
const MAX_SESSIONS = 5;
const RESEND_COOLDOWN_SECONDS = 60;

// --- HELPERS ---

function mapEntity(entity: Pick<Entity, 'id' | 'business_name' | 'is_client' | 'is_supplier' | 'is_employee'> | null | undefined) {
    if (!entity) return undefined;
    return {
        id: entity.id,
        businessName: entity.business_name,
        isClient: entity.is_client ?? false,
        isSupplier: entity.is_supplier ?? false,
        isEmployee: entity.is_employee ?? false,
    };
}

export class AuthError extends DomainError {
  constructor(message: string, status: number = 401) {
    super(message, status, { code: 'UNAUTHORIZED' });
    this.name = 'AuthError';
  }
}

// --- SESSION HELPERS ---

export function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64url');
}

function hashToken(token: string): string {
  const bytes = new TextEncoder().encode(token);
  const hasher = new Bun.SHA256();
  hasher.update(bytes);
  return hasher.digest('hex');
}

/**
 * Validate session by ID. Returns session + user data, or null if invalid/expired.
 * Implements rolling sessions: extends expiry when past the refresh threshold.
 */
export async function validateSession(sessionId: string) {
  const cacheKey = `session:${sessionId}`;

  // Check cache first
  let cachedData = await cacheService.getOrSet(cacheKey, async () => {
    // Direct select via adminDb, bypassing RLS and avoiding transaction / set_config overhead
    const [s] = await adminDb
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId));
    if (!s) return null;
    
    // Fetch roles, permissions, and email verification status in parallel (OPT-01)
    const [txRoles, txPermissions, [user]] = await Promise.all([
      adminDb
        .select({ roleName: authRoles.name })
        .from(authUserRoles)
        .innerJoin(authRoles, eq(authUserRoles.role_id, authRoles.id))
        .where(eq(authUserRoles.user_id, s.user_id)),
      adminDb.execute(sql`
        SELECT DISTINCT ap.slug
        FROM auth_user_roles ur
        JOIN auth_role_permissions rp ON ur.role_id = rp.role_id
        JOIN auth_permissions ap ON rp.permission_id = ap.id
        WHERE ur.user_id = ${s.user_id}
      `),
      adminDb
        .select({ emailVerifiedAt: users.email_verified_at })
        .from(users)
        .where(eq(users.id, s.user_id))
        .limit(1),
    ]);

    const roles = txRoles.map(r => r.roleName);
    const permissions = (txPermissions as unknown as { slug: string }[]).map(r => r.slug);
      
    return { session: s, roles, permissions, emailVerified: !!user?.emailVerifiedAt };
  }, SESSION_EXPIRE_DAYS * 24 * 60 * 60); // Max TTL 

  if (!cachedData) return null;
  
  let { session, roles, permissions, emailVerified } = cachedData;

  // Re-hydrate dates
  if (typeof session.expires_at === 'string') session.expires_at = new Date(session.expires_at);
  if (typeof session.created_at === 'string') session.created_at = new Date(session.created_at);

  // Expired — cleanup and reject
  if (session.expires_at < new Date()) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    cacheService.invalidate(cacheKey);
    return null;
  }

  // Rolling session: extend if past the refresh threshold
  const remainingMs = session.expires_at.getTime() - Date.now();
  const thresholdMs = SESSION_REFRESH_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
  let shouldRefreshCookie = false;

  if (remainingMs < thresholdMs) {
    const newExpiry = new Date(Date.now() + SESSION_EXPIRE_DAYS * 24 * 60 * 60 * 1000);
    await db.update(sessions)
      .set({ expires_at: newExpiry })
      .where(eq(sessions.id, sessionId));
    session.expires_at = newExpiry;
    shouldRefreshCookie = true;
    cacheService.invalidate(cacheKey); // force cache refresh on next request
  }

  return { session, roles, permissions, shouldRefreshCookie, emailVerified };
}

// --- AUTH FUNCTIONS ---

export async function register(
  data: {
    fullName: string; email: string; password: string;
    phone?: string; cedula?: string;
    slug: string; ruc: string; businessName: string; tradeName?: string;
    businessType?: string; mainAddress?: string;
    obligadoContabilidad?: boolean; contribuyenteEspecial?: string; taxRegime?: string;
  },
  userAgent?: string,
  ipAddress?: string
) {
  return await db.transaction(async (tx) => {
    // 0. Verify slug + ruc uniqueness (descriptive errors vs opaque PG constraint violations)
    const [existingSlug] = await tx.select({ id: companies.id }).from(companies).where(eq(companies.slug, data.slug)).limit(1);
    if (existingSlug) throw new DomainError('Este identificador (slug) ya está en uso', 409);

    const [existingRuc] = await tx.select({ id: companies.id }).from(companies).where(eq(companies.ruc, data.ruc)).limit(1);
    if (existingRuc) throw new DomainError('Este RUC ya está registrado', 409);

    // 1. Create company
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
      })
      .returning();

    // Inject company_id context into the local transaction for PostgreSQL RLS policies
    await tx.execute(sql`SELECT set_config('app.current_company_id', ${company.id.toString()}, true)`);

    // 2. Default SRI establishment
    await tx.insert(sriEstablishments).values({
      company_id: company.id,
      code: '001',
      name: 'Matriz',
      address: company.main_address,
      emission_points: ['001'],
    });

    // 3. CONSUMIDOR FINAL entity
    await tx.insert(entities).values({
      company_id: company.id,
      tax_id: '9999999999999',
      tax_id_type: 'CONSUMIDOR_FINAL',
      person_type: 'NATURAL',
      business_name: 'CONSUMIDOR FINAL',
      is_client: true,
    });

    // 4. Owner entity (personal data from Step 1)
    const [ownerEntity] = await tx.insert(entities).values({
      company_id: company.id,
      tax_id: data.cedula || data.ruc,
      tax_id_type: data.cedula ? 'CEDULA' : 'RUC',
      person_type: 'NATURAL',
      business_name: data.fullName,
      phone: data.phone || null,
      email_billing: data.email,
      is_employee: true,
    }).returning();

    // 5. Create owner user linked to entity
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

    // 6. Seed RBAC (roles + permissions + assign superadmin)
    await seedCompanyRBAC(tx, company.id, user.id);

    // 7. Seed menus
    await seedCompanyMenus(tx);

    // 7.5 Seed UOMs (derived)
    await seedCompanyUOMs(tx, company.id);

    // 7.6 Seed Virtual Locations (SUPPLIER, CUSTOMER, ADJUSTMENT, PRODUCTION)
    await seedCompanyVirtualLocations(tx, company.id);

    // 7.7 Generar Token de Verificación (Seguridad Extrema)
    const rawToken = generateSessionToken();
    const tokenHash = hashToken(rawToken);
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 Horas
    
    await tx.insert(authVerificationTokens).values({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: tokenExpiry,
    });

    // 7.8 Enviar Correo de Verificación vía Resend (Asincrónico controlado)
    const verificationLink = getVerificationLink(company.slug, rawToken);
    
    emailService.sendVerificationEmail(user.email, verificationLink, data.fullName).catch(err => {
      console.error('Failed to send verification email during registration:', err);
    });

    // 8. Create session (auto-login)
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

    // 9. Fetch roles/permissions within tx (global `db` can't see uncommitted inserts)
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

export async function login(email: string, password: string, userAgent?: string, ipAddress?: string, companyId?: number) {
  // 1. Fetch user records matching email/username (limit to at most 5 matched companies for security)
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

  // 2. Timing attack protection if email doesn't exist
  if (matchedUsers.length === 0) {
    const DUMMY_HASH = '$argon2id$v=19$m=65536,t=2,p=1$njOSfwJnFaGrpYbhNmtmmyTeQ3Zr/vK+n+vYhtMpGxw$xEeAHQScZ8hNn2xngO0I8o0jgQX7wfinz+WEIsxiuoE';
    await Bun.password.verify(password, DUMMY_HASH);
    throw new AuthError('Credenciales inválidas');
  }

  // Verify passwords for all matched users in parallel (Bun thread pool)
  const verificationPromises = matchedUsers.map(async (u) => {
    const valid = await Bun.password.verify(password, u.password_hash);
    return { user: u, valid };
  });

  const results = await Promise.all(verificationPromises);
  const verifiedUsers = results.filter(r => r.valid).map(r => r.user);

  if (verifiedUsers.length === 0) {
    throw new AuthError('Credenciales inválidas');
  }

  // Filter out deactivated users
  const activeVerifiedUsers = verifiedUsers.filter(u => u.is_active);
  if (activeVerifiedUsers.length === 0) {
    throw new AuthError('Usuario desactivado', 403);
  }

  // If there are multiple active verified users (and no companyId was specified), return selection info
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

  // Choose the single active verified user
  const user = activeVerifiedUsers[0];

  // 3. Fetch roles/permissions and company slug in parallel
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

  // 4. Create session
  const sessionId = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_EXPIRE_DAYS * 24 * 60 * 60 * 1000);

  // Limit active sessions
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

  // Insert session + update last_login in parallel
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

  // Broadcast session update
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

export async function logout(sessionId: string) {
  // Delete session from DB and retrieve user_id in one go
  const deleted = await db
    .delete(sessions)
    .where(eq(sessions.id, sessionId))
    .returning({ user_id: sessions.user_id });

  if (deleted.length > 0) {
    const userId = deleted[0].user_id;
    broadcast(RealtimeEvents.USER.SESSION_REVOKED, { id: userId, sessionId }, `user:${userId}`);
    cacheService.invalidate(`session:${sessionId}`);
  }
}

export async function getActiveSessions(userId: number, currentSessionId?: string) {
  const activeSessions = await db
    .select({
      id: sessions.id,
      user_agent: sessions.user_agent,
      ip_address: sessions.ip_address,
      created_at: sessions.created_at,
      expires_at: sessions.expires_at,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.user_id, userId),
        gt(sessions.expires_at, new Date()),
      )
    )
    .orderBy(sessions.created_at);

  const mapped = activeSessions.map((s) => {
    const geo = s.ip_address ? geoip.lookup(s.ip_address) : null;
    const location = geo ? `${geo.city}, ${geo.country}` : null;

    return {
      id: s.id,
      user_agent: s.user_agent,
      ip_address: s.ip_address,
      location,
      created_at: s.created_at,
      is_current: s.id === currentSessionId,
    };
  });

  // Sort: current session first, then by created_at descending
  return mapped.sort((a, b) => {
    if (a.is_current) return -1;
    if (b.is_current) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export async function revokeSession(sessionId: string, userId: number) {
  // Verify the session belongs to this user and delete it (1 query instead of 2)
  const deleted = await db
    .delete(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.user_id, userId)))
    .returning({ id: sessions.id });

  if (deleted.length === 0) throw new AuthError('Sesión no encontrada', 404);

  // Broadcast revocation via SSE
  broadcast(RealtimeEvents.USER.SESSION_REVOKED, { id: userId, sessionId }, `user:${userId}`);
  cacheService.invalidate(`session:${sessionId}`);

  return { success: true } as const;
}

export async function getMe(userId: number) {
  const user = await db.query.authUsers.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      company_id: true,
      email: true,
      username: true,
      entity_id: true,
      is_active: true,
      last_login: true,
      email_verified_at: true,
    },
    with: { entity: true },
  });

  if (!user) throw new AuthError('Usuario no encontrado');

  const [roles, permissions, [company]] = await Promise.all([
    getUserRoles(user.id),
    getUserPermissions(user.id),
    adminDb
      .select({ slug: companies.slug })
      .from(companies)
      .where(eq(companies.id, user.company_id))
      .limit(1),
  ]);

  return {
    id: user.id,
    companyId: user.company_id,
    companySlug: company?.slug ?? null,
    email: user.email,
    username: user.username,
    entityId: user.entity_id,
    isActive: user.is_active,
    lastLogin: user.last_login,
    emailVerifiedAt: user.email_verified_at,
    roles,
    permissions,
    entity: mapEntity(user.entity),
  };
}

export async function changePassword(userId: number, currentPassword: string, newPassword: string) {
  const user = await db.query.authUsers.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) throw new AuthError('Usuario no encontrado');

  const validPassword = await Bun.password.verify(currentPassword, user.password_hash);
  if (!validPassword) throw new AuthError('Contraseña actual incorrecta');

  const newHash = await Bun.password.hash(newPassword);
  await db.update(users).set({ password_hash: newHash }).where(eq(users.id, userId));

  // Delete ALL sessions (force re-login everywhere)
  const deletedSessions = await db.delete(sessions).where(eq(sessions.user_id, userId)).returning({ id: sessions.id });

  // Clear cache and broadcast logouts
  for (const s of deletedSessions) {
    cacheService.invalidate(`session:${s.id}`);
    broadcast(RealtimeEvents.USER.SESSION_REVOKED, { id: userId, sessionId: s.id }, `user:${userId}`);
  }

  return { success: true } as const;
}

export async function updateProfile(
  userId: number,
  data: { username?: string; email?: string }
) {
  const updateData: { username?: string; email?: string } = {};

  if (data.username) updateData.username = data.username;
  if (data.email) updateData.email = data.email;

  if (Object.keys(updateData).length === 0) {
    return { success: true, message: 'Sin cambios' } as const;
  }

  const [updated] = await db.update(users).set(updateData).where(eq(users.id, userId)).returning({
    id: users.id,
      email: users.email,
      username: users.username,
    });

    if (!updated) throw new AuthError('Usuario no encontrado');

    broadcast(RealtimeEvents.USER.PROFILE_UPDATED, { id: userId, ...updateData }, `user:${userId}`);

  return { success: true, user: updated } as const;
}

export async function verifyEmail(token: string) {
  const tokenHash = hashToken(token);

  // 1. Usar adminDb para saltarse RLS y buscar el token de manera pública global
  const [tokenRecord] = await adminDb
    .select()
    .from(authVerificationTokens)
    .where(eq(authVerificationTokens.token_hash, tokenHash))
    .limit(1);

  if (!tokenRecord) {
    throw new AuthError('Enlace de verificación inválido o expirado', 400);
  }

  if (new Date(tokenRecord.expires_at) < new Date()) {
    await adminDb.delete(authVerificationTokens).where(eq(authVerificationTokens.id, tokenRecord.id));
    throw new AuthError('El enlace de verificación ha expirado', 400);
  }

  // 2. Obtener el usuario relacionado para saber su empresa
  const [user] = await adminDb
    .select({ id: users.id, companyId: users.company_id })
    .from(users)
    .where(eq(users.id, tokenRecord.user_id))
    .limit(1);

  if (!user) {
    throw new AuthError('Usuario no encontrado', 404);
  }

  // 3. Ejecutar la actualización RLS-Safe
  await withTenantContext({ companyId: user.companyId }, async () => {
    await db
      .update(users)
      .set({ email_verified_at: new Date() })
      .where(eq(users.id, user.id));

    // Eliminar el token consumido
    await db
      .delete(authVerificationTokens)
      .where(eq(authVerificationTokens.id, tokenRecord.id));
  });

  // 4. Invalidar todas las sesiones en Redis para forzar lectura de sesión verificada
  const activeSessions = await adminDb
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.user_id, user.id));

  await Promise.all(activeSessions.map(s => cacheService.invalidate(`session:${s.id}`)));

  // 5. Notificar a las pestañas abiertas vía SSE
  broadcast(RealtimeEvents.USER.EMAIL_VERIFIED, { userId: user.id }, `user:${user.id}`);

  return { success: true };
}

export async function resendVerification(userId: number, companyId: number) {
  // 1. Cooldown enforcement vía Redis TTL (anti-spam)
  const cooldownKey = `resend_cooldown:${userId}`;
  const ttl = await redis.ttl(cooldownKey);
  if (ttl > 0) {
    return { success: false, retryAfter: ttl };
  }

  // 2. Validar usuario
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), eq(users.company_id, companyId)))
    .limit(1);

  if (!user) throw new AuthError('Usuario no encontrado');
  if (user.email_verified_at) throw new AuthError('El correo ya ha sido verificado', 400);

  // 3. Limpiar tokens anteriores del usuario
  await db.delete(authVerificationTokens).where(eq(authVerificationTokens.user_id, userId));

  // 4. Generar nuevo token
  const rawToken = generateSessionToken();
  const tokenHash = hashToken(rawToken);
  const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  await db.insert(authVerificationTokens).values({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: tokenExpiry,
  });

  const [company] = await db
    .select({ slug: companies.slug, businessName: companies.business_name })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  const verificationLink = getVerificationLink(company.slug, rawToken);

  try {
    await emailService.sendVerificationEmail(user.email, verificationLink, user.username);
  } catch (err) {
    console.error('Failed to send verification email during resend:', err);
    if (env.NODE_ENV !== 'development') {
      throw new DomainError('Error enviando el correo de verificación. Inténtalo más tarde.', 500);
    }
  }

  // 5. Activar cooldown en Redis
  await redis.set(cooldownKey, '1', 'EX', RESEND_COOLDOWN_SECONDS);

  return { success: true, retryAfter: RESEND_COOLDOWN_SECONDS };
}