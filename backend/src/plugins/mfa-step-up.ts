import { Elysia } from 'elysia';
import { eq } from '@app/schema';
import { user } from '@app/schema/tables';
import { adminDb } from '../core/db';
import { redis } from '../core/cache/redis';
import { DomainError, ForbiddenError, UnauthorizedError } from '../core/errors';

const MFA_STEP_UP_TTL_SECONDS = 15 * 60;

function stepUpKey(sessionId: string): string {
  return `auth:mfa-step-up:${sessionId}`;
}

/**
 * Marks the Better Auth session as MFA-verified for a short period.
 * The marker is only created after Better Auth has completed its 2FA flow.
 */
export async function markMfaStepUp(sessionId: string): Promise<void> {
  await redis.set(stepUpKey(sessionId), '1', 'EX', MFA_STEP_UP_TTL_SECONDS);
}

/**
 * Sensitive tenant mutations must call this guard. Users without MFA keep
 * the normal session flow; users with MFA enabled need a recent 2FA proof.
 * Redis failures are fail-closed for the protected operation.
 */
export async function requireMfaStepUp(userId: string, sessionId: string): Promise<void> {
  const [securityUser] = await adminDb
    .select({ twoFactorEnabled: user.twoFactorEnabled })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!securityUser?.twoFactorEnabled) return;

  let verified: string | null;
  try {
    verified = await redis.get(stepUpKey(sessionId));
  } catch {
    throw new DomainError('No se pudo comprobar el step-up de MFA', 503, { code: 'INTERNAL_ERROR' });
  }

  if (verified !== '1') {
    throw new ForbiddenError('Se requiere una verificación MFA reciente para esta operación');
  }
}

/**
 * Elysia plugin for sensitive mutation routes. Read-only GETs are not blocked;
 * role, membership, billing and administrative writes are.
 */
export const mfaStepUp = (app: Elysia) => app.onBeforeHandle(
  async ({ request, currentUserId, currentSessionId }: {
    request: Request;
    currentUserId?: string | number;
    currentSessionId?: string;
  }) => {
    if (new URL(request.url).pathname.endsWith('/profile/security/mfa/verify')) return;
    if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') return;
    if (!currentUserId || !currentSessionId) {
      throw new UnauthorizedError('Sesión requerida');
    }
    await requireMfaStepUp(String(currentUserId), currentSessionId);
  },
);
