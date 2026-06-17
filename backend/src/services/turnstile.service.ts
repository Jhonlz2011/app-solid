/**
 * turnstile.service.ts — Cloudflare Turnstile server-side verification
 *
 * Validates the token issued by the browser widget against Cloudflare's API.
 * In development mode (NODE_ENV !== 'production') the verification is bypassed
 * so local development doesn't require solving a challenge.
 *
 * Strategy:
 *  - Fail-open on network/timeout errors (don't block legit users if CF is down)
 *  - Strict fail on explicit CF rejection (success: false)
 */
import { env } from '../config/env';
import { DomainError } from './errors';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TIMEOUT_MS = 5_000;

interface TurnstileVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
}

/**
 * Verifies a Cloudflare Turnstile token.
 * @param token - The cf-turnstile-response token from the browser widget.
 * @param ip    - Optional: client IP for additional fraud signal.
 * @throws {DomainError} 400 if Cloudflare explicitly rejects the token.
 */
export async function verifyTurnstileToken(
  token: string | undefined | null,
  ip?: string,
): Promise<void> {
  // ── Dev bypass ──
  if (env.NODE_ENV !== 'production') {
    return;
  }

  // ── No token in prod → reject ──
  if (!token) {
    throw new DomainError('Verificación de seguridad requerida', 400);
  }

  const body = new URLSearchParams({
    secret: env.TURNSTILE_SECRET_KEY,
    response: token,
  });
  if (ip) body.append('remoteip', ip);

  let result: TurnstileVerifyResponse;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      body,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    result = (await response.json()) as TurnstileVerifyResponse;
  } catch (err) {
    // Network failure or timeout → fail-open (don't block legitimate users)
    console.error('[Turnstile] Verification request failed — failing open:', err);
    return;
  }

  if (!result.success) {
    const codes = result['error-codes']?.join(', ') ?? 'unknown';
    console.warn(`[Turnstile] Token rejected — error-codes: ${codes}`);
    throw new DomainError('Verificación de seguridad fallida. Por favor, inténtalo de nuevo.', 400);
  }
}
