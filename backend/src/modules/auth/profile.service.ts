import { db, adminDb } from '../../core/db';
import { authUsers as users, sessions, companies } from '@app/schema/tables';
import { eq } from '@app/schema';
import type { AuthUserEntityDto } from '@app/schema/shared-dto';
import { getUserRoles, getUserPermissions } from '../users/rbac.service';
import { cacheService } from '../../core/cache';
import { broadcast } from '../../core/sse';
import { RealtimeEvents } from '@app/schema/realtime-events';
import { AuthError } from './session.service';

export function mapEntity(entity: { id: number; business_name: string; is_client: boolean | null; is_supplier: boolean | null; is_employee: boolean | null } | null | undefined): AuthUserEntityDto | undefined {
  if (!entity) return undefined;
  return {
    id: entity.id,
    businessName: entity.business_name,
    isClient: entity.is_client ?? false,
    isSupplier: entity.is_supplier ?? false,
    isEmployee: entity.is_employee ?? false,
  };
}

/**
 * Get current user profile with roles and permissions
 */
export async function getMe(userId: number) {
  const user = await db.query.authUsers.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      company_id: true,
      email: true,
      username: true,
      entity_id: true,
      is_active: true,
      last_login: true,
      email_verified_at: true,
    },
    with: { entity: true },
  });

  if (!user) throw new AuthError('Usuario no encontrado');

  const [roles, permissions, [company]] = await Promise.all([
    getUserRoles(user.id),
    getUserPermissions(user.id),
    adminDb
      .select({ slug: companies.slug })
      .from(companies)
      .where(eq(companies.id, user.company_id))
      .limit(1),
  ]);

  return {
    id: user.id,
    companyId: user.company_id,
    companySlug: company?.slug ?? null,
    email: user.email,
    username: user.username,
    entityId: user.entity_id,
    isActive: user.is_active,
    lastLogin: user.last_login,
    emailVerifiedAt: user.email_verified_at,
    roles,
    permissions,
    entity: mapEntity(user.entity),
  };
}

/**
 * User personal password change
 */
export async function changePassword(userId: number, currentPassword: string, newPassword: string) {
  const user = await db.query.authUsers.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) throw new AuthError('Usuario no encontrado');

  const validPassword = await Bun.password.verify(currentPassword, user.password_hash);
  if (!validPassword) throw new AuthError('Contraseña actual incorrecta');

  const newHash = await Bun.password.hash(newPassword);
  await db.update(users).set({ password_hash: newHash }).where(eq(users.id, userId));

  const deletedSessions = await db.delete(sessions).where(eq(sessions.user_id, userId)).returning({ id: sessions.id });

  for (const s of deletedSessions) {
    cacheService.invalidate(`session:${s.id}`);
    broadcast(RealtimeEvents.USER.SESSION_REVOKED, { id: userId, sessionId: s.id }, `user:${userId}`);
  }

  return { success: true } as const;
}

/**
 * User personal profile update
 */
export async function updateProfile(
  userId: number,
  data: { username?: string; email?: string }
) {
  const updateData: { username?: string; email?: string } = {};

  if (data.username) updateData.username = data.username;
  if (data.email) updateData.email = data.email;

  if (Object.keys(updateData).length === 0) {
    return { success: true, message: 'Sin cambios' } as const;
  }

  const [updated] = await db.update(users).set(updateData).where(eq(users.id, userId)).returning({
    id: users.id,
    email: users.email,
    username: users.username,
  });

  if (!updated) throw new AuthError('Usuario no encontrado');

  broadcast(RealtimeEvents.USER.PROFILE_UPDATED, { id: userId, ...updateData }, `user:${userId}`);

  return { success: true, user: updated } as const;
}
