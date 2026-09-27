import { adminDb } from '../../core/db';
import { sessions, companies, member } from '@app/schema/tables';
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
  companyId?: number,
  currentSessionId?: string,
) {
  const userIdStr = String(userId);
  let organizationId: string | null = null;

  if (companyId !== undefined) {
    const [company] = await adminDb
      .select({ organizationId: companies.organization_id })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);
    if (!company?.organizationId) throw new AuthError('Empresa no encontrada', 404);
    const [membership] = await adminDb
      .select({ id: member.id })
      .from(member)
      .where(and(
        eq(member.userId, userIdStr),
        eq(member.organizationId, company.organizationId),
      ))
      .limit(1);
    if (!membership) throw new AuthError('El usuario no pertenece a esta empresa', 404);
    organizationId = company.organizationId;
  }

  const tenantCondition = organizationId
    ? eq(sessions.activeOrganizationId, organizationId)
    : undefined;

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
        ...(tenantCondition ? [tenantCondition] : []),
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
export async function revokeSession(sessionId: string, userId: string | number, companyId?: number) {
  const userIdStr = String(userId);
  let tenantCondition;
  if (companyId !== undefined) {
    const [company] = await adminDb
      .select({ organizationId: companies.organization_id })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);
    if (!company?.organizationId) throw new AuthError('Empresa no encontrada', 404);
    tenantCondition = eq(sessions.activeOrganizationId, company.organizationId);
  }
  const deleted = await adminDb
    .delete(sessions)
    .where(and(
      eq(sessions.id, sessionId),
      eq(sessions.userId, userIdStr),
      ...(tenantCondition ? [tenantCondition] : []),
    ))
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
