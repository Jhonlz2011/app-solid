import { db, adminDb, withTenantContext } from '../../core/db';
import { authUsers as users, sessions, authVerificationTokens, companies } from '@app/schema/tables';
import { eq, and } from '@app/schema';
import { cacheService, redis } from '../../core/cache';
import { broadcast } from '../../core/sse';
import { RealtimeEvents } from '@app/schema/realtime-events';
import { getVerificationLink } from '../../config/auth';
import { emailService } from '../../core/email';
import { env } from '../../config/env';
import { DomainError } from '../../core/errors';
import { AuthError, generateSessionToken, hashToken } from './session.service';

const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Verify user email from token
 */
export async function verifyEmail(token: string) {
  const tokenHash = hashToken(token);

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

  const [user] = await adminDb
    .select({ id: users.id, companyId: users.company_id })
    .from(users)
    .where(eq(users.id, tokenRecord.user_id))
    .limit(1);

  if (!user) {
    throw new AuthError('Usuario no encontrado', 404);
  }

  await withTenantContext({ companyId: user.companyId }, async () => {
    await db
      .update(users)
      .set({ email_verified_at: new Date() })
      .where(eq(users.id, user.id));

    await db
      .delete(authVerificationTokens)
      .where(eq(authVerificationTokens.id, tokenRecord.id));
  });

  const activeSessions = await adminDb
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.user_id, user.id));

  await Promise.all(activeSessions.map(s => cacheService.invalidate(`session:${s.id}`)));
  broadcast(RealtimeEvents.USER.EMAIL_VERIFIED, { userId: user.id }, `user:${user.id}`);

  return { success: true };
}

/**
 * Resend email verification token
 */
export async function resendVerification(userId: number, companyId: number) {
  const cooldownKey = `resend_cooldown:${userId}`;
  const ttl = await redis.ttl(cooldownKey);
  if (ttl > 0) {
    return { success: false, retryAfter: ttl };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), eq(users.company_id, companyId)))
    .limit(1);

  if (!user) throw new AuthError('Usuario no encontrado');
  if (user.email_verified_at) throw new AuthError('El correo ya ha sido verificado', 400);

  await db.delete(authVerificationTokens).where(eq(authVerificationTokens.user_id, userId));

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

  await redis.set(cooldownKey, '1', 'EX', RESEND_COOLDOWN_SECONDS);

  return { success: true, retryAfter: RESEND_COOLDOWN_SECONDS };
}
