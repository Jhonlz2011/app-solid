import { db, adminDb } from '../../core/db';
import { sessions, authUsers as users, authRoles, authUserRoles } from '@app/schema/tables';
import { eq, and, gt, inArray, sql } from '@app/schema';
import { cacheService } from '../../core/cache';
import { broadcast } from '../../core/sse';
import { RealtimeEvents } from '@app/schema/realtime-events';
import { SESSION_EXPIRE_DAYS } from '../../config/auth';
import { DomainError } from '../../core/errors';
import geoip from 'geoip-lite';

export class AuthError extends DomainError {
  constructor(message: string, status: number = 401) {
    super(message, status, { code: 'UNAUTHORIZED' });
    this.name = 'AuthError';
  }
}

const SESSION_REFRESH_THRESHOLD_DAYS = Math.floor(SESSION_EXPIRE_DAYS / 2);

// --- SESSION HELPERS ---

export function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64url');
}

export function hashToken(token: string): string {
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

  let cachedData = await cacheService.getOrSet(cacheKey, async () => {
    const [s] = await adminDb
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId));
    if (!s) return null;
    
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
  }, SESSION_EXPIRE_DAYS * 24 * 60 * 60);

  if (!cachedData) return null;
  
  let { session, roles, permissions, emailVerified } = cachedData;

  if (typeof session.expires_at === 'string') session.expires_at = new Date(session.expires_at);
  if (typeof session.created_at === 'string') session.created_at = new Date(session.created_at);

  if (session.expires_at < new Date()) {
    await adminDb.delete(sessions).where(eq(sessions.id, sessionId));
    cacheService.invalidate(cacheKey);
    return null;
  }

  const remainingMs = session.expires_at.getTime() - Date.now();
  const thresholdMs = SESSION_REFRESH_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
  let shouldRefreshCookie = false;

  if (remainingMs < thresholdMs) {
    const newExpiry = new Date(Date.now() + SESSION_EXPIRE_DAYS * 24 * 60 * 60 * 1000);
    await adminDb.update(sessions)
      .set({ expires_at: newExpiry })
      .where(eq(sessions.id, sessionId));
    session.expires_at = newExpiry;
    shouldRefreshCookie = true;
    cacheService.invalidate(cacheKey);
  }

  return { session, roles, permissions, shouldRefreshCookie, emailVerified };
}

/**
 * Get active sessions for a user with geoip location info
 */
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

  return mapped.sort((a, b) => {
    if (a.is_current) return -1;
    if (b.is_current) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

/**
 * Revoke single user session
 */
export async function revokeSession(sessionId: string, userId: number) {
  const deleted = await db
    .delete(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.user_id, userId)))
    .returning({ id: sessions.id });

  if (deleted.length === 0) throw new AuthError('Sesión no encontrada', 404);

  broadcast(RealtimeEvents.USER.SESSION_REVOKED, { id: userId, sessionId }, `user:${userId}`);
  cacheService.invalidate(`session:${sessionId}`);

  return { success: true } as const;
}
