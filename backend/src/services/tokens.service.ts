// src/services/tokens.service.ts
import { randomBytes, createHash } from 'crypto';
import { SignJWT } from 'jose';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const JWT_SECRET = process.env.JWT_SECRET;

export type RefreshTokenPair = {
  selector: string;    // Para búsqueda en BD 
  token: string;       // Valor secreto a hashear
  combined: string;    // Para la cookie (selector.token)
};

export type AccessPayload = {
  userId: number;
  sessionId: string;
  roles: string[];
  permissions: string[];
};

export async function genRefreshTokenPair(): Promise<RefreshTokenPair> {
  // Genera selector (12 bytes) y token (32 bytes) separados
  const selector = randomBytes(12).toString('base64url');
  const token = randomBytes(32).toString('base64url');
  return {
    selector,
    token,
    combined: `${selector}.${token}`
  };
}

export async function generateAccessToken(payload: AccessPayload) {
  // Usamos 'jose' SignJWT con HS256. Retorna un JWT compacto.
  const encoder = new TextEncoder();
  const secret = encoder.encode(JWT_SECRET);
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('15m')
    .sign(secret);
}

export function hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

export function verifyTokenHash(token: string, hash: string): boolean {
    return createHash('sha256').update(token).digest('hex') === hash;
}
