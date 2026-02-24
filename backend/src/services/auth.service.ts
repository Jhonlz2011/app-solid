import { db } from '../db';
import { authUsers as users, sessions } from '@app/schema/tables';
import { eq, and, gt, inArray, or } from '@app/schema';
import type { PublicUserType } from '@app/schema/backend';
import { getUserRoles, getUserPermissions } from './rbac.service';
import { broadcastJSON } from '../plugins/ws';
import { SESSION_EXPIRE_DAYS } from '../config/auth';
import { randomBytes } from 'crypto';
import geoip from 'geoip-lite';

// --- CONSTANTS ---
const SESSION_REFRESH_THRESHOLD_DAYS = Math.floor(SESSION_EXPIRE_DAYS / 2);
const MAX_SESSIONS = 5;

// --- HELPERS ---

function mapEntity(entity: any) {
    if (!entity) return undefined;
    return {
        id: entity.id,
        businessName: entity.business_name,
        isClient: entity.is_client ?? false,
        isSupplier: entity.is_supplier ?? false,
        isEmployee: entity.is_employee ?? false,
    };
}

export class AuthError extends Error {
  constructor(message: string, public code: number = 401) {
    super(message);
    this.name = 'AuthError';
  }
}

// --- SESSION HELPERS ---

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Validate session by ID. Returns session + user data, or null if invalid/expired.
 * Implements rolling sessions: extends expiry when past the refresh threshold.
 */
export async function validateSession(sessionId: string) {
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId));

  if (!session) return null;

  // Expired — cleanup and reject
  if (session.expires_at < new Date()) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }

  // Rolling session: extend if past the refresh threshold
  const remainingMs = session.expires_at.getTime() - Date.now();
  const thresholdMs = SESSION_REFRESH_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
  let shouldRefreshCookie = false;

  if (remainingMs < thresholdMs) {
    const newExpiry = new Date(Date.now() + SESSION_EXPIRE_DAYS * 24 * 60 * 60 * 1000);
    await db.update(sessions)
      .set({ expires_at: newExpiry })
      .where(eq(sessions.id, sessionId));
    session.expires_at = newExpiry;
    shouldRefreshCookie = true;
  }

  return { session, shouldRefreshCookie };
}

// --- AUTH FUNCTIONS ---

export async function register(email: string, password: string, username?: string): Promise<PublicUserType> {
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
    const { password_hash: _, ...publicUser } = result[0];
    return publicUser;
  } catch (error: any) {
    if (error.code === '23505') {
      throw new AuthError('El email o usuario ya está registrado', 409);
    }
    throw error;
  }
}

export async function login(email: string, password: string, userAgent?: string, ipAddress?: string) {
  // 1. Fetch user + entity in one query
  const user = await db.query.authUsers.findFirst({
    where: or(eq(users.email, email), eq(users.username, email)),
    with: { entity: true },
  });

  // 2. Timing attack protection
  const DUMMY_HASH = '$argon2id$v=19$m=65536,t=2,p=1$njOSfwJnFaGrpYbhNmtmmyTeQ3Zr/vK+n+vYhtMpGxw$xEeAHQScZ8hNn2xngO0I8o0jgQX7wfinz+WEIsxiuoE';
  const targetHash = user?.password_hash ?? DUMMY_HASH;
  const validPassword = await Bun.password.verify(password, targetHash);

  if (!user || !validPassword) {
    throw new AuthError('Credenciales inválidas');
  }

  if (!user.is_active) throw new AuthError('Usuario desactivado', 403);

  // 3. Fetch roles/permissions in parallel
  const [roles, permissions] = await Promise.all([
    getUserRoles(user.id),
    getUserPermissions(user.id),
  ]);

  // 4. Create session
  const sessionId = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_EXPIRE_DAYS * 24 * 60 * 60 * 1000);

  // Limit active sessions
  const activeSessions = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.user_id, user.id))
    .orderBy(sessions.created_at);

  const MAX = MAX_SESSIONS;
  if (activeSessions.length >= MAX) {
    const toDelete = activeSessions.slice(0, activeSessions.length - MAX + 1);
    await db.delete(sessions).where(inArray(sessions.id, toDelete.map(s => s.id)));
  }

  // Insert session + update last_login in parallel
  await Promise.all([
    db.insert(sessions).values({
      id: sessionId,
      user_id: user.id,
      expires_at: expiresAt,
      user_agent: userAgent,
      ip_address: ipAddress,
    }),
    db.update(users).set({ last_login: new Date() }).where(eq(users.id, user.id)),
  ]);

  // Broadcast session update
  broadcastJSON('sessions:update', { type: 'login' }, `user:${user.id}`);

  return {
    sessionId,
    expiresAt,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      is_active: user.is_active,
      last_login: user.last_login,
      entity_id: user.entity_id,
      roles,
      permissions,
      entity: mapEntity(user.entity),
    },
  };
}

export async function logout(sessionId: string) {
  // Get user_id before deleting for WS broadcast
  const [session] = await db
    .select({ user_id: sessions.user_id })
    .from(sessions)
    .where(eq(sessions.id, sessionId));

  // Delete session from DB
  await db.delete(sessions).where(eq(sessions.id, sessionId));

  if (session) {
    broadcastJSON('sessions:update', { type: 'revoke', sessionId }, `user:${session.user_id}`);
  }
}

export async function getActiveSessions(userId: number, currentSessionId?: string) {
  const activeSessions = await db
    .select({
      id: sessions.id,
      user_agent: sessions.user_agent,
      ip_address: sessions.ip_address,
      created_at: sessions.created_at,
      expires_at: sessions.expires_at,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.user_id, userId),
        gt(sessions.expires_at, new Date()),
      )
    )
    .orderBy(sessions.created_at);

  const mapped = activeSessions.map((s) => {
    const geo = s.ip_address ? geoip.lookup(s.ip_address) : null;
    const location = geo ? `${geo.city}, ${geo.country}` : null;

    return {
      id: s.id,
      user_agent: s.user_agent,
      ip_address: s.ip_address,
      location,
      created_at: s.created_at,
      is_current: s.id === currentSessionId,
    };
  });

  // Sort: current session first, then by created_at descending
  return mapped.sort((a, b) => {
    if (a.is_current) return -1;
    if (b.is_current) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export async function revokeSession(sessionId: string, userId: number) {
  // Verify the session belongs to this user
  const [session] = await db
    .select({ user_id: sessions.user_id })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.user_id, userId)));

  if (!session) throw new AuthError('Sesión no encontrada', 404);

  // Delete the session
  await db.delete(sessions).where(eq(sessions.id, sessionId));

  // Broadcast revocation via WS
  broadcastJSON('sessions:update', { type: 'revoke', sessionId }, `user:${userId}`);

  return { success: true };
}

export async function getMe(userId: number) {
  const user = await db.query.authUsers.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      email: true,
      username: true,
      entity_id: true,
      is_active: true,
      last_login: true,
    },
    with: { entity: true },
  });

  if (!user) throw new AuthError('Usuario no encontrado');

  const [roles, permissions] = await Promise.all([
    getUserRoles(user.id),
    getUserPermissions(user.id),
  ]);

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    entityId: user.entity_id,
    isActive: user.is_active,
    lastLogin: user.last_login,
    roles,
    permissions,
    entity: mapEntity(user.entity),
  };
}

export async function changePassword(userId: number, currentPassword: string, newPassword: string) {
  const user = await db.query.authUsers.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) throw new AuthError('Usuario no encontrado');

  const validPassword = await Bun.password.verify(currentPassword, user.password_hash);
  if (!validPassword) throw new AuthError('Contraseña actual incorrecta');

  const newHash = await Bun.password.hash(newPassword);
  await db.update(users).set({ password_hash: newHash }).where(eq(users.id, userId));

  // Delete ALL sessions (force re-login everywhere)
  await db.delete(sessions).where(eq(sessions.user_id, userId));

  // Broadcast logout to all connected clients
  broadcastJSON('sessions:update', { type: 'logout' }, `user:${userId}`);

  return { success: true };
}

export async function updateProfile(
  userId: number,
  data: { username?: string; email?: string }
) {
  const user = await db.query.authUsers.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) throw new AuthError('Usuario no encontrado');

  const updateData: { username?: string; email?: string } = {};

  if (data.username && data.username !== user.username) {
    const existingUser = await db.query.authUsers.findFirst({
      where: eq(users.username, data.username!),
    });
    if (existingUser && existingUser.id !== userId) {
      throw new AuthError('El nombre de usuario ya está en uso', 409);
    }
    updateData.username = data.username;
  }

  if (data.email && data.email !== user.email) {
    const existingEmail = await db.query.authUsers.findFirst({
      where: eq(users.email, data.email!),
    });
    if (existingEmail && existingEmail.id !== userId) {
      throw new AuthError('El email ya está en uso', 409);
    }
    updateData.email = data.email;
  }

  if (Object.keys(updateData).length === 0) {
    return { success: true, message: 'Sin cambios' };
  }

  const [updated] = await db.update(users).set(updateData).where(eq(users.id, userId)).returning({
    id: users.id,
    email: users.email,
    username: users.username,
  });

  return { success: true, user: updated };
}