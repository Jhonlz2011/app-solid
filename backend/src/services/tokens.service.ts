// src/services/tokens.service.ts
import { randomBytes } from 'crypto';
import { SignJWT } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET!;

export type RefreshTokenPair = {
  selector: string;    // Para búsqueda en BD 
  token: string;       // Valor secreto a hashear
  combined: string;    // Para la cookie (selector.token)
};

export type AccessPayload = {
  userId: number;
  sessionId: string; // Selector del refresh token
  // agrega claims que necesites (roles, perms)
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

export async function hashToken(token: string) {
  return await Bun.password.hash(token);
}

export async function verifyTokenHash(token: string, hash: string) {
  return await Bun.password.verify(token, hash);
}
