import { db } from '../db';
import { authUsers as users, refreshTokens, entities } from '../schema';
import { eq, and, gt, sql } from 'drizzle-orm';
import {
  genRefreshTokenPair,
  hashToken,
  generateAccessToken,
  verifyTokenHash,
} from './tokens.service';
import { getUserRoles, getUserPermissions } from './rbac.service';
import { broadcastJSON } from '../plugins/ws';
import { redis } from '../config/redis';
import geoip from 'geoip-lite';

const REFRESH_EXPIRE_DAYS = Number(process.env.REFRESH_TOKEN_EXP_DAYS ?? 14);
const ACCESS_TOKEN_EXP_SECONDS = 15 * 60; // 15 minutes

export class AuthError extends Error {
  constructor(message: string, public code: number = 401) {
    super(message);
    this.name = 'AuthError';
  }
}

export async function validateEmail(email: string): Promise<boolean> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export async function register(email: string, password: string, username?: string) {
  if (!(await validateEmail(email))) {
    throw new AuthError('Email inválido', 400);
  }
  if (password.length < 8) {
    throw new AuthError('La contraseña debe tener al menos 8 caracteres', 400);
  }

  try {
    const password_hash = await Bun.password.hash(password);
    const result = await db
      .insert(users)
      .values({
        email,
        password_hash,
        username: username || email.split('@')[0],
      })
      .returning();
    return result[0];
  } catch (error: any) {
    if (error.code === '23505') {
      throw new AuthError('El email o usuario ya está registrado', 409);
    }
    throw error;
  }
}

export async function login(email: string, password: string, userAgent?: string, ipAddress?: string) {
  let user = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .then(r => r[0]);

  if (!user) {
    user = await db
      .select()
      .from(users)
      .where(eq(users.username, email))
      .then(r => r[0]);
  }

  if (!user) throw new AuthError('Credenciales inválidas');
  if (!user.is_active) throw new AuthError('Usuario desactivado', 403);

  const validPassword = await Bun.password.verify(password, user.password_hash);
  if (!validPassword) throw new AuthError('Credenciales inválidas');

  await db.update(users).set({ last_login: new Date() }).where(eq(users.id, user.id));

  const refreshPair = await genRefreshTokenPair();
  const accessToken = await generateAccessToken({ userId: user.id, sessionId: refreshPair.selector });
  const refreshHash = await hashToken(refreshPair.token);

  const roles = await getUserRoles(user.id);
  const permissions = await getUserPermissions(user.id);

  const expiresAt = new Date(Date.now() + REFRESH_EXPIRE_DAYS * 24 * 60 * 60 * 1000);

  const MAX_SESSIONS = 5;

  await db.transaction(async (tx) => {
    // 1. Get active sessions count
    const activeSessions = await tx
      .select({ id: refreshTokens.id, created_at: refreshTokens.created_at })
      .from(refreshTokens)
      .where(and(
        eq(refreshTokens.user_id, user.id),
        eq(refreshTokens.revoked, false)
      ))
      .orderBy(refreshTokens.created_at); // Oldest first

    // 2. If limit reached, revoke oldest sessions
    // Note: We don't revoke by User-Agent to avoid Normal/Incognito conflicts
    // Stale sessions (>3h inactive) are filtered out in getActiveSessions()
    if (activeSessions.length >= MAX_SESSIONS) {
      const sessionsToRevoke = activeSessions.slice(0, activeSessions.length - MAX_SESSIONS + 1);
      for (const session of sessionsToRevoke) {
        await tx
          .update(refreshTokens)
          .set({ revoked: true })
          .where(eq(refreshTokens.id, session.id));
      }
    }

    // 4. Insert new session with new chain ID
    await tx
      .insert(refreshTokens)
      .values({
        user_id: user.id,
        selector: refreshPair.selector,
        token_hash: refreshHash,
        session_chain_id: refreshPair.selector, // New chain starts with selector as ID
        expires_at: expiresAt,
        last_activity: new Date(),
        user_agent: userAgent,
        ip_address: ipAddress,
      });
  });

  // Broadcast update to user's room
  broadcastJSON('sessions:update', { type: 'login' }, `user:${user.id}`);

  let entityInfo = null;
  if (user.entity_id) {
    const [entity] = await db.select().from(entities).where(eq(entities.id, user.entity_id));
    if (entity) {
      entityInfo = {
        id: entity.id,
        businessName: entity.business_name,
        isClient: entity.is_client,
        isSupplier: entity.is_supplier,
        isEmployee: entity.is_employee,
      };
    }
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      roles,
      permissions,
      entity: entityInfo,
    },
    accessToken,
    refreshToken: refreshPair.combined,
    expiresAt,
  };
}

export async function rotateRefreshToken(oldCombined: string) {
  const [selector, token] = oldCombined.split('.');
  if (!selector || !token) {
    throw new AuthError('Token inválido');
  }

  // Wrap everything in a transaction with row-level locking
  return await db.transaction(async (tx) => {
    // Lock the row with FOR UPDATE to prevent concurrent rotations
    // This serializes parallel refresh attempts on the same token
    const [storedToken] = await tx.execute<{
      id: number;
      user_id: number;
      selector: string;
      token_hash: string;
      session_chain_id: string;
      expires_at: Date;
      revoked: boolean;
      replaced_by: number | null;
      user_agent: string | null;
      ip_address: string | null;
    }>(sql`
      SELECT * FROM refresh_tokens 
      WHERE selector = ${selector} 
      FOR UPDATE
    `);

    if (!storedToken) throw new AuthError('Token inválido');

    // If already revoked, check if we can reuse the replacement (grace period for concurrent requests)
    if (storedToken.revoked) {
      if (storedToken.replaced_by) {
        const replacement = await tx
          .select()
          .from(refreshTokens)
          .where(eq(refreshTokens.id, storedToken.replaced_by))
          .then(r => r[0]);
        if (replacement) {
          const timeSinceReplacement = Date.now() - new Date(replacement.created_at).getTime();
          // Grace period: within 30 seconds, reuse the same replacement token
          if (timeSinceReplacement < 30 * 1000) {
            const accessToken = await generateAccessToken({ userId: storedToken.user_id, sessionId: replacement.selector });
            return {
              accessToken,
              refreshToken: '', // Don't issue new refresh token, use existing from other request
              expiresAt: new Date(Date.now() + 15 * 60 * 1000)
            };
          }
        }
      }
      throw new AuthError('Token revocado');
    }

    if (new Date(storedToken.expires_at) < new Date()) throw new AuthError('Token expirado');

    const valid = await verifyTokenHash(token, storedToken.token_hash);
    if (!valid) throw new AuthError('Token inválido');

    const { user_id } = storedToken;
    if (!user_id) throw new AuthError('Token inválido');

    const newPair = await genRefreshTokenPair();
    const newHash = await hashToken(newPair.token);
    const expiresAt = new Date(Date.now() + REFRESH_EXPIRE_DAYS * 24 * 60 * 60 * 1000);

    // Revoke old token
    await tx
      .update(refreshTokens)
      .set({ revoked: true })
      .where(eq(refreshTokens.id, storedToken.id));

    // Insert new token
    const [newToken] = await tx
      .insert(refreshTokens)
      .values({
        user_id,
        selector: newPair.selector,
        token_hash: newHash,
        session_chain_id: storedToken.session_chain_id,
        expires_at: expiresAt,
        last_activity: new Date(),
        user_agent: storedToken.user_agent,
        ip_address: storedToken.ip_address,
      })
      .returning();

    // Link old token to new
    await tx
      .update(refreshTokens)
      .set({ replaced_by: newToken.id })
      .where(eq(refreshTokens.id, storedToken.id));

    const accessToken = await generateAccessToken({ userId: user_id, sessionId: newPair.selector });

    return {
      accessToken,
      refreshToken: newPair.combined,
      expiresAt,
    };
  });
}

export async function logout(selector: string) {
  const session = await db
    .select({ user_id: refreshTokens.user_id })
    .from(refreshTokens)
    .where(eq(refreshTokens.selector, selector))
    .then(r => r[0]);

  await db
    .update(refreshTokens)
    .set({ revoked: true })
    .where(eq(refreshTokens.selector, selector));

  if (session) {
    // Add to blacklist
    await redis.set(`blacklist:${selector}`, 'revoked', 'EX', ACCESS_TOKEN_EXP_SECONDS);
    // Use 'revoke' type so only this specific session logs out, not all sessions
    broadcastJSON('sessions:update', { type: 'revoke', sessionId: selector }, `user:${session.user_id}`);
  }
}

export async function getActiveSessions(userId: number, currentSelector?: string) {
  // Sessions inactive for more than 3 hours are considered stale
  const STALE_THRESHOLD_MS = 3 * 60 * 60 * 1000; // 3 hours
  const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS);

  // Get all non-revoked, non-expired, non-stale tokens
  // Since rotated tokens are marked as revoked, only the "leaf" (current) token of each chain will be returned
  const sessions = await db
    .select({
      id: refreshTokens.id,
      user_agent: refreshTokens.user_agent,
      ip_address: refreshTokens.ip_address,
      session_chain_id: refreshTokens.session_chain_id,
      created_at: refreshTokens.created_at,
      last_activity: refreshTokens.last_activity,
      selector: refreshTokens.selector,
    })
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.user_id, userId),
        eq(refreshTokens.revoked, false),
        gt(refreshTokens.expires_at, new Date()),
        gt(refreshTokens.last_activity, staleThreshold)
      )
    )
    .orderBy(refreshTokens.created_at);

  const mapped = sessions.map((s) => {
    const geo = s.ip_address ? geoip.lookup(s.ip_address) : null;
    const location = geo ? `${geo.city}, ${geo.country}` : null;

    return {
      id: s.id,
      user_agent: s.user_agent,
      ip_address: s.ip_address,
      location,
      created_at: s.created_at,
      is_current: s.selector === currentSelector,
    };
  });

  // Sort: current session first, then by created_at descending (newest first)
  return mapped.sort((a, b) => {
    if (a.is_current) return -1;
    if (b.is_current) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export async function revokeSession(sessionId: number, userId: number) {
  let currentSession = await db
    .select()
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.id, sessionId),
        eq(refreshTokens.user_id, userId)
      )
    )
    .then((r) => r[0]);

  if (!currentSession) {
    throw new AuthError('Sesión no encontrada', 404);
  }

  // Collect ALL selectors in the chain (handles token rotation)
  const revokedSelectors: string[] = [];

  // Revoke the target session and any session that replaced it (recursively)
  // This handles the race condition where a session rotates just before being revoked
  while (currentSession) {
    revokedSelectors.push(currentSession.selector);

    await db
      .update(refreshTokens)
      .set({ revoked: true })
      .where(eq(refreshTokens.id, currentSession.id));

    // Add to blacklist
    await redis.set(`blacklist:${currentSession.selector}`, 'revoked', 'EX', ACCESS_TOKEN_EXP_SECONDS);

    if (currentSession.replaced_by) {
      currentSession = await db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.id, currentSession.replaced_by))
        .then((r) => r[0]);
    } else {
      break;
    }
  }

  // Broadcast ALL selectors so client matches even after rotation
  broadcastJSON('sessions:update', {
    type: 'revoke',
    sessionId: revokedSelectors // Array of all selectors in chain
  }, `user:${userId}`);

  return { success: true };
}

export async function getMe(userId: number) {
  const user = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      entityId: users.entity_id,
      isActive: users.is_active,
      lastLogin: users.last_login,
    })
    .from(users)
    .where(eq(users.id, userId))
    .then(r => r[0]);

  if (!user) throw new AuthError('Usuario no encontrado');

  const roles = await getUserRoles(user.id);
  const permissions = await getUserPermissions(user.id);

  let entity = null;
  if (user.entityId) {
    const [e] = await db.select().from(entities).where(eq(entities.id, user.entityId));
    if (e) {
      entity = {
        id: e.id,
        businessName: e.business_name,
        isClient: e.is_client,
        isSupplier: e.is_supplier,
        isEmployee: e.is_employee,
      };
    }
  }

  return {
    ...user,
    roles,
    permissions,
    entity,
  };
}

export async function changePassword(userId: number, currentPassword: string, newPassword: string) {
  if (newPassword.length < 8) {
    throw new AuthError('La nueva contraseña debe tener al menos 8 caracteres', 400);
  }

  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .then(r => r[0]);

  if (!user) throw new AuthError('Usuario no encontrado');

  const validPassword = await Bun.password.verify(currentPassword, user.password_hash);
  if (!validPassword) throw new AuthError('Contraseña actual incorrecta');

  const newHash = await Bun.password.hash(newPassword);
  await db.update(users).set({ password_hash: newHash }).where(eq(users.id, userId));

  // Revoke all sessions
  await db.update(refreshTokens).set({ revoked: true }).where(eq(refreshTokens.user_id, userId));

  // Broadcast logout to all connected clients for this user
  broadcastJSON('sessions:update', { type: 'logout' }, `user:${userId}`);

  return { success: true };
}