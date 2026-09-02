import { db } from '../../core/db';
import { sessions } from '@app/schema/tables';
import { eq, and, gt } from '@app/schema';
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
 * Get active sessions for a user with geoip location info
 */
export async function getActiveSessions(userId: string | number, currentSessionId?: string) {
  const userIdStr = String(userId);
  const activeSessions = await db
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
        gt(sessions.expiresAt, new Date()),
      )
    )
    .orderBy(sessions.createdAt);

  const mapped = activeSessions.map((s) => {
    const geo = s.ipAddress ? geoip.lookup(s.ipAddress) : null;
    const location = geo ? `${geo.city}, ${geo.country}` : null;

    return {
      id: s.id,
      user_agent: s.userAgent,
      ip_address: s.ipAddress,
      location,
      created_at: s.createdAt,
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
export async function revokeSession(sessionId: string, userId: string | number) {
  const userIdStr = String(userId);
  const deleted = await db
    .delete(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userIdStr)))
    .returning({ id: sessions.id });

  if (deleted.length === 0) throw new AuthError('Sesión no encontrada', 404);

  broadcastToUser(userIdStr, RealtimeEvents.USER.SESSION_REVOKED, { id: userId, sessionId });
  cacheService.invalidate(`session:${sessionId}`);

  return { success: true } as const;
}
