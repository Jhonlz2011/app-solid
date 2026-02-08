import { db, type Tx } from '../db';
import { authUsers as users, refreshTokens, entities } from '@app/schema/tables';
import { eq, and, gt, sql, or, inArray } from '@app/schema';
import type { AuthUserSelectType, PublicUserType } from '@app/schema/backend';
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



export async function register(email: string, password: string, username?: string): Promise<PublicUserType> {
  // Validations are handled by TypeBox schema in routes
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
    // Return without password_hash
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
  // 1. OPTIMIZACIÓN: Traemos usuario Y entidad en UN SOLO viaje a la DB
  const user = await db.query.authUsers.findFirst({
    where: or(eq(users.email, email), eq(users.username, email)),
    with: {
      entity: true // <--- ¡MAGIA DE DRIZZLE! (Requiere definir relaciones)
    }
  });
  // 2. SEGURIDAD: Protección contra Timing Attacks
  // Si el usuario no existe, verificamos contra un hash falso precalculado.
  // Esto hace que la petición SIEMPRE tarde lo mismo (ej. 100ms).
  const DUMMY_HASH = '$argon2id$v=19$m=65536,t=2,p=1$njOSfwJnFaGrpYbhNmtmmyTeQ3Zr/vK+n+vYhtMpGxw$xEeAHQScZ8hNn2xngO0I8o0jgQX7wfinz+WEIsxiuoE';
  const targetHash = user?.password_hash ?? DUMMY_HASH;

  // Ejecutamos la verificación SIEMPRE, exista o no el usuario
  const validPassword = await Bun.password.verify(password, targetHash);

  // Ahora sí, lanzamos el error genérico si falló algo
  if (!user || !validPassword) {
    throw new AuthError('Credenciales inválidas');
  }

  if (!user.is_active) throw new AuthError('Usuario desactivado', 403);

  // 3. Preparar datos de sesión en PARALELO
  // Ejecutamos IO DB (Roles/Permisos) y Crypto (Tokens) simultáneamente
  const [refreshPair, roles, permissions] = await Promise.all([
    genRefreshTokenPair(),
    getUserRoles(user.id),
    getUserPermissions(user.id)
  ]);

  const [accessToken, refreshHash] = await Promise.all([
    generateAccessToken({ userId: user.id, sessionId: refreshPair.selector }),
    hashToken(refreshPair.token)
  ]);

  const expiresAt = new Date(Date.now() + REFRESH_EXPIRE_DAYS * 24 * 60 * 60 * 1000);

  // 4. TRANSACCIÓN ATÓMICA
  // Metemos el update de 'last_login' aquí dentro para asegurar consistencia total
  await db.transaction(async (tx: Tx) => {
    // A. Actualizar último login
    await tx.update(users).set({ last_login: new Date() }).where(eq(users.id, user.id));

    // B. Limpieza de sesiones viejas
    const activeSessions = await tx
      .select({ id: refreshTokens.id })
      .from(refreshTokens)
      .where(and(
        eq(refreshTokens.user_id, user.id),
        eq(refreshTokens.revoked, false)
      ))
      .orderBy(refreshTokens.created_at);

    const MAX_SESSIONS = 5;
    if (activeSessions.length >= MAX_SESSIONS) {
      const sessionsToRevoke = activeSessions.slice(0, activeSessions.length - MAX_SESSIONS + 1);
      for (const session of sessionsToRevoke) {
        await tx.update(refreshTokens).set({ revoked: true }).where(eq(refreshTokens.id, session.id));
      }
    }

    // C. Insertar nueva sesión
    await tx.insert(refreshTokens).values({
      user_id: user.id,
      selector: refreshPair.selector,
      token_hash: refreshHash,
      session_chain_id: refreshPair.selector,
      expires_at: expiresAt,
      last_activity: new Date(),
      user_agent: userAgent,
      ip_address: ipAddress,
    });
  });

  // Broadcast update to user's room
  broadcastJSON('sessions:update', { type: 'login' }, `user:${user.id}`);

  // 5. MAPEO DE RESPUESTA (Mucho más limpio gracias al paso 1)
  let entityInfo;
  // Drizzle ya trajo 'user.entity', no necesitamos buscarlo
  if (user.entity) {
    entityInfo = {
      id: user.entity.id,
      businessName: user.entity.business_name,
      isClient: user.entity.is_client ?? false,
      isSupplier: user.entity.is_supplier ?? false,
      isEmployee: user.entity.is_employee ?? false,
    };
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      is_active: user.is_active,
      last_login: user.last_login,
      entity_id: user.entity_id,
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
  return await db.transaction(async (tx: Tx) => {
    // Lock the row with FOR UPDATE to prevent concurrent rotations
    // This serializes parallel refresh attempts on the same token
    const result = await tx.execute(sql`
      SELECT * FROM refresh_tokens 
      WHERE selector = ${selector} 
      FOR UPDATE
    `);
    const storedToken = (result as unknown as {
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
    }[])[0];

    if (!storedToken) throw new AuthError('Token inválido');

    // If already revoked, check if we can reuse the replacement (grace period for concurrent requests)
    if (storedToken.revoked) {
      if (storedToken.replaced_by) {
        const replacement = await tx
          .select()
          .from(refreshTokens)
          .where(eq(refreshTokens.id, storedToken.replaced_by))
          .then((r: any[]) => r[0]);
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

    await tx
      .update(refreshTokens)
      .set({ revoked: true })
      .where(eq(refreshTokens.id, storedToken.id));
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
    .then((r: any[]) => r[0]);

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

interface Session {
  id: number;
  user_agent: string | null;
  ip_address: string | null;
  session_chain_id: string;
  created_at: Date;
  last_activity: Date;
  selector: string;
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

  const mapped = sessions.map((s: Session) => {
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
  // 1. Collect entire chain of rotated tokens starting from sessionId
  const chainIds: number[] = [];
  const chainSelectors: string[] = [];

  let currentId: number | null = sessionId;
  while (currentId !== null) {
    const session: { id: number; selector: string; replaced_by: number | null; user_id: number } | undefined = await db
      .select({ id: refreshTokens.id, selector: refreshTokens.selector, replaced_by: refreshTokens.replaced_by, user_id: refreshTokens.user_id })
      .from(refreshTokens)
      .where(eq(refreshTokens.id, currentId))
      .then((r) => r[0]);

    if (!session) {
      if (chainIds.length === 0) throw new AuthError('Sesión no encontrada', 404);
      break;
    }

    // Security: verify user owns this session
    if (session.user_id !== userId) {
      throw new AuthError('Sesión no encontrada', 404);
    }

    chainIds.push(session.id);
    chainSelectors.push(session.selector);
    currentId = session.replaced_by;
  }

  // 2. Batch update: revoke all in one query
  await db
    .update(refreshTokens)
    .set({ revoked: true })
    .where(inArray(refreshTokens.id, chainIds));

  // 3. Batch blacklist in parallel
  await Promise.all(
    chainSelectors.map(sel =>
      redis.set(`blacklist:${sel}`, 'revoked', 'EX', ACCESS_TOKEN_EXP_SECONDS)
    )
  );

  // 4. Broadcast ALL selectors so client matches even after rotation
  broadcastJSON('sessions:update', {
    type: 'revoke',
    sessionId: chainSelectors
  }, `user:${userId}`);

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
    }
  });

  if (!user) throw new AuthError('Usuario no encontrado');

  // Parallelize ALL async operations
  const [roles, permissions, entityResult] = await Promise.all([
    getUserRoles(user.id),
    getUserPermissions(user.id),
    user.entity_id
      ? db.select().from(entities).where(eq(entities.id, user.entity_id))
      : Promise.resolve([])
  ]);

  const e = entityResult[0];
  const entity = e ? {
    id: e.id,
    businessName: e.business_name,
    isClient: e.is_client ?? false,
    isSupplier: e.is_supplier ?? false,
    isEmployee: e.is_employee ?? false,
  } : undefined;

  return {
    ...user,
    entityId: user.entity_id,
    isActive: user.is_active,
    lastLogin: user.last_login,
    roles,
    permissions,
    entity,
  };
}

export async function changePassword(userId: number, currentPassword: string, newPassword: string) {
  // Password length validation handled by TypeBox

  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .then((r: AuthUserSelectType[]) => r[0]);

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

export async function updateProfile(
  userId: number,
  data: { username?: string; email?: string }
) {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .then((r: AuthUserSelectType[]) => r[0]);

  if (!user) throw new AuthError('Usuario no encontrado');

  const updateData: { username?: string; email?: string } = {};

  // Validate and prepare username update
  if (data.username && data.username !== user.username) {
    // Username length validation handled by TypeBox
    // Check for duplicate
    const existingUser = await db.query.authUsers.findFirst({
      where: eq(users.username, data.username!),
    });

    if (existingUser && existingUser.id !== userId) {
      throw new AuthError('El nombre de usuario ya está en uso', 409);
    }
    updateData.username = data.username;
  }

  // Validate and prepare email update
  if (data.email && data.email !== user.email) {
    // Email validation handled by TypeBox
    // Check for duplicate
    const existingEmail = await db.query.authUsers.findFirst({
      where: eq(users.email, data.email!),
    });

    if (existingEmail && existingEmail.id !== userId) {
      throw new AuthError('El email ya está en uso', 409);
    }
    updateData.email = data.email;
  }

  // Only update if there are changes
  if (Object.keys(updateData).length === 0) {
    return { success: true, message: 'Sin cambios' };
  }

  await db.update(users).set(updateData).where(eq(users.id, userId));

  // Return updated user data
  const updatedUser = await db.query.authUsers.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      email: true,
      username: true,
    }
  });

  return { success: true, user: updatedUser };
}