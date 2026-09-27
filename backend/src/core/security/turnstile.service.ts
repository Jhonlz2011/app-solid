import { env } from '../../config/env';
import { DomainError } from '../errors';
import { redis } from '../cache/redis';
import { normalizeHost } from '@app/schema/utils';
import { createHash } from 'node:crypto';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TIMEOUT_MS = 5_000;

interface TurnstileVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
}

export interface TurnstileVerificationOptions {
  action?: string;
  expectedHostname?: string;
  ipAddress?: string;
  requestId?: string;
}

const MAX_TOKEN_AGE_MS = 2 * 60 * 1000;

/**
 * Verifies a Cloudflare Turnstile token.
 * @param token - The cf-turnstile-response token from the browser widget.
 * @param options - Server-side action, hostname, IP and request metadata.
 * @throws {DomainError} 400 if Cloudflare explicitly rejects the token.
 */
export async function verifyTurnstileToken(
  token: string | undefined | null,
  options: TurnstileVerificationOptions = {},
): Promise<void> {
  if (env.NODE_ENV === 'development') {
    return;
  }

  // Defense-in-depth: reject hardcoded dev bypass token in production
  if (token === 'dev_bypass_token') {
    throw new DomainError('Verificación de seguridad inválida', 403);
  }

  if (!token) {
    throw new DomainError('Verificación de seguridad requerida', 400);
  }

  const body = new URLSearchParams({
    secret: env.TURNSTILE_SECRET_KEY,
    response: token,
  });
  if (options.ipAddress) body.append('remoteip', options.ipAddress);

  let result: TurnstileVerifyResponse;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(VERIFY_URL, {
        method: 'POST',
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Turnstile returned HTTP ${response.status}`);
      }

      result = (await response.json()) as TurnstileVerifyResponse;
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    console.error(`[Turnstile] Verification request failed — failing closed${options.requestId ? ` (${options.requestId})` : ''}:`, err);
    throw new DomainError('El servicio de verificación no está disponible. Inténtalo de nuevo.', 503);
  }

  if (!result.success) {
    const codes = result['error-codes']?.join(', ') ?? 'unknown';
    console.warn(`[Turnstile] Token rejected — error-codes: ${codes}`);
    throw new DomainError('Verificación de seguridad fallida. Por favor, inténtalo de nuevo.', 400);
  }

  if (options.action && result.action !== options.action) {
    throw new DomainError('La acción de seguridad no coincide con la operación solicitada.', 403);
  }

  if (!result.hostname) {
    throw new DomainError('La respuesta de seguridad no contiene un hostname válido.', 403);
  }

  const verifiedHostname = normalizeHost(result.hostname);
  if (env.NODE_ENV === 'production' && verifiedHostname !== 'zelys.app' && !verifiedHostname.endsWith('.zelys.app')) {
    throw new DomainError('El hostname de seguridad no pertenece a este entorno.', 403);
  }

  if (options.expectedHostname && verifiedHostname !== normalizeHost(options.expectedHostname)) {
    throw new DomainError('El origen de seguridad no coincide con este entorno.', 403);
  }

  if (!result.challenge_ts) {
    throw new DomainError('La respuesta de seguridad no contiene una fecha válida.', 403);
  }
  const challengeTime = Date.parse(result.challenge_ts);
  const now = Date.now();
  if (!Number.isFinite(challengeTime) || challengeTime > now + 30_000 || now - challengeTime > MAX_TOKEN_AGE_MS) {
    throw new DomainError('La verificación de seguridad expiró. Inténtalo de nuevo.', 403);
  }

  // Cloudflare tokens are one-use by contract. Redis makes that invariant
  // explicit across API replicas and closes replay races after verification.
  const tokenKey = `turnstile:used:${createHash('sha256').update(token).digest('hex')}`;
  try {
    const claimed = await redis.set(tokenKey, options.requestId || 'verified', 'EX', 180, 'NX');
    if (claimed !== 'OK') {
      throw new DomainError('La verificación de seguridad ya fue utilizada.', 403);
    }
  } catch (error) {
    if (error instanceof DomainError) throw error;
    console.error(`[Turnstile] Replay store unavailable${options.requestId ? ` (${options.requestId})` : ''}:`, error);
    throw new DomainError('El servicio de verificación no está disponible. Inténtalo de nuevo.', 503);
  }
}
