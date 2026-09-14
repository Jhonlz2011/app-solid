import { adminDb } from '../../core/db';
import { sessions } from '@app/schema/tables';
import { eq, and, or, sql } from '@app/schema';
import { cacheService } from '../../core/cache';
import { broadcastToUser } from '../../core/sse';
import { RealtimeEvents } from '@app/schema/realtime-events';
import { DomainError } from '../../core/errors';
import geoip from 'geoip-lite';

export class AuthError extends DomainError {
  constructor(message: string, status: number = 401) {
    super(message, status, { code: 'UNAUTHORIZED' });
    this.name = 'AuthError';
  }
}

/**
 * Resolves a human-friendly location string from an IP address.
 */
function resolveLocation(ipAddress: string | null): string | null {
  if (!ipAddress) return null;
  if (
    ipAddress === '127.0.0.1' ||
    ipAddress === '::1' ||
    ipAddress.startsWith('192.168.') ||
    ipAddress.startsWith('10.') ||
    ipAddress.startsWith('172.') ||
    ipAddress === 'localhost'
  ) {
    return 'Red local / Dev';
  }
  const geo = geoip.lookup(ipAddress);
  return geo ? `${geo.city ? `${geo.city}, ` : ''}${geo.country}` : null;
}

export async function getActiveSessions(
  userId: string | number,
  currentSessionId?: string
) {
  const userIdStr = String(userId);

  const activeSessions = await adminDb
    .select({
      id: sessions.id,
      userAgent: sessions.userAgent,
      ipAddress: sessions.ipAddress,
      createdAt: sessions.createdAt,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userIdStr),
        or(
          sql`${sessions.expiresAt} > NOW()`,
          currentSessionId ? eq(sessions.id, currentSessionId) : sql`false`
        )
      )
    )
    .orderBy(sessions.createdAt);

  const mapped = activeSessions.map((s) => ({
    id: s.id,
    user_agent: s.userAgent ?? null,
    ip_address: s.ipAddress ?? null,
    location: resolveLocation(s.ipAddress),
    created_at: s.createdAt,
    is_current: Boolean(currentSessionId && s.id === currentSessionId),
  }));

  return mapped.sort((a, b) => {
    if (a.is_current) return -1;
    if (b.is_current) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

/**
 * Revoke single user session
 */
export async function revokeSession(sessionId: string, userId: string | number) {
  const userIdStr = String(userId);
  const deleted = await adminDb
    .delete(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userIdStr)))
    .returning({ id: sessions.id, token: sessions.token });

  if (deleted.length === 0) throw new AuthError('Sesión no encontrada', 404);

  const token = deleted[0]?.token;
  if (token) {
    try {
      const { redis } = await import('../../core/cache/redis');
      await Promise.all([
        redis.del(`session:${token}`),
        redis.del(`better-auth:session:${token}`),
        redis.del(token),
        redis.del(`session:${sessionId}`),
      ]);
    } catch { /* Redis delete best effort */ }
  }

  broadcastToUser(userIdStr, RealtimeEvents.USER.SESSION_REVOKED, { id: userId, sessionId });
  cacheService.invalidate(`session:${sessionId}`);

  return { success: true } as const;
}
