import { db } from '../db';
import { authUsers as users, sessions } from '@app/schema/tables';
import { eq, and, gt, inArray, or } from '@app/schema';
import type { PublicUserType } from '@app/schema/backend';
import { getUserRoles, getUserPermissions } from './rbac.service';
import { broadcast } from '../plugins/sse';
import { SESSION_EXPIRE_DAYS } from '../config/auth';
import { cacheService } from './cache.service';
import { RealtimeEvents } from '@app/schema/realtime-events';
import geoip from 'geoip-lite';
import { DomainError } from './errors';

// --- CONSTANTS ---
const SESSION_REFRESH_THRESHOLD_DAYS = Math.floor(SESSION_EXPIRE_DAYS / 2);
const MAX_SESSIONS = 5;

// --- HELPERS ---

function mapEntity(entity: any) {
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

// export function generateSessionToken(): string {
//   return randomBytes(32).toString('base64url');
// }

export function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64url');
}

/**
 * Validate session by ID. Returns session + user data, or null if invalid/expired.
 * Implements rolling sessions: extends expiry when past the refresh threshold.
 */
export async function validateSession(sessionId: string) {
  const cacheKey = `session:${sessionId}`;

  // Check cache first
  let cachedData = await cacheService.getOrSet(cacheKey, async () => {
    const [s] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId));
    if (!s) return null;
    
    // Also fetch roles and permissions here to cache them together
    const [roles, permissions] = await Promise.all([
      getUserRoles(s.user_id),
      getUserPermissions(s.user_id)
    ]);
    
    return { session: s, roles, permissions };
  }, SESSION_EXPIRE_DAYS * 24 * 60 * 60); // Max TTL 

  if (!cachedData) return null;
  
  let { session, roles, permissions } = cachedData;

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

  return { session, roles, permissions, shouldRefreshCookie };
}

// --- AUTH FUNCTIONS ---

export async function register(email: string, password: string, username?: string): Promise<PublicUserType> {
  const password_hash = await Bun.password.hash(password);
  const result = await db
      .insert(users)
      .values({
        email,
        password_hash,
        username: username || email.split('@')[0],
      })
      .returning({
        id: users.id,
        entity_id: users.entity_id,
        username: users.username,
        email: users.email,
        is_active: users.is_active,
        last_login: users.last_login,
        created_at: users.created_at,
      });
  return result[0];
}

export async function login(email: string, password: string, userAgent?: string, ipAddress?: string) {
  // 1. Fetch user + entity in one query
  const user = await db.query.authUsers.findFirst({
    where: or(eq(users.email, email), eq(users.username, email)),
    with: { entity: true },
  });

  // 2. Timing attack protection
  const DUMMY_HASH = '$argon2id$v=19$m=65536,t=2,p=1$njOSfwJnFaGrpYbhNmtmmyTeQ3Zr/vK+n+vYhtMpGxw$xEeAHQScZ8hNn2xngO0I8o0jgQX7wfinz+WEIsxiuoE';
  const targetHash = user?.password_hash ?? DUMMY_HASH;
  const validPassword = await Bun.password.verify(password, targetHash);

  if (!user || !validPassword) {
    throw new AuthError('Credenciales inválidas');
  }

  if (!user.is_active) throw new AuthError('Usuario desactivado', 403);

  // 3. Fetch roles/permissions in parallel
  const [roles, permissions] = await Promise.all([
    getUserRoles(user.id),
    getUserPermissions(user.id),
  ]);

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
      expires_at: expiresAt,
      user_agent: userAgent,
      ip_address: ipAddress,
    }),
    db.update(users).set({ last_login: new Date() }).where(eq(users.id, user.id)),
  ]);

  // Broadcast session update
  broadcast(RealtimeEvents.USER.SESSION_CREATED, { userId: user.id, sessionId }, `user:${user.id}`);

  return {
    sessionId,
    expiresAt,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      is_active: user.is_active,
      last_login: user.last_login,
      entity_id: user.entity_id,
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
    broadcast(RealtimeEvents.USER.SESSION_REVOKED, { userId, sessionId }, `user:${userId}`);
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
  broadcast(RealtimeEvents.USER.SESSION_REVOKED, { userId, sessionId }, `user:${userId}`);
  cacheService.invalidate(`session:${sessionId}`);

  return { success: true };
}

export async function getMe(userId: number) {
  const user = await db.query.authUsers.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      email: true,
      username: true,
      entity_id: true,
      is_active: true,
      last_login: true,
    },
    with: { entity: true },
  });

  if (!user) throw new AuthError('Usuario no encontrado');

  const [roles, permissions] = await Promise.all([
    getUserRoles(user.id),
    getUserPermissions(user.id),
  ]);

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    entityId: user.entity_id,
    isActive: user.is_active,
    lastLogin: user.last_login,
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
    broadcast(RealtimeEvents.USER.SESSION_REVOKED, { userId, sessionId: s.id }, `user:${userId}`);
  }

  return { success: true };
}

export async function updateProfile(
  userId: number,
  data: { username?: string; email?: string }
) {
  const updateData: { username?: string; email?: string } = {};

  if (data.username) updateData.username = data.username;
  if (data.email) updateData.email = data.email;

  if (Object.keys(updateData).length === 0) {
    return { success: true, message: 'Sin cambios' };
  }

  const [updated] = await db.update(users).set(updateData).where(eq(users.id, userId)).returning({
    id: users.id,
      email: users.email,
      username: users.username,
    });

    if (!updated) throw new AuthError('Usuario no encontrado');

    broadcast(RealtimeEvents.USER.PROFILE_UPDATED, { userId, ...updateData }, `user:${userId}`);

  return { success: true, user: updated };
}