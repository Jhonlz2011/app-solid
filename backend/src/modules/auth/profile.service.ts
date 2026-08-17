import { db, adminDb } from '../../core/db';
import { authUsers as users, companies } from '@app/schema/tables';
import { eq } from '@app/schema';
import type { AuthUserEntityDto } from '@app/schema/dto';
import { getUserRoles, getUserPermissions } from '../users/rbac.permission.service';
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
 * Get current user profile with roles, permissions, and tenant metadata
 */
export async function getMe(userId: string | number, activeCompanyId?: number | null) {
  const userIdStr = String(userId);
  const user = await db.query.authUsers.findFirst({
    where: eq(users.id, userIdStr),
    columns: {
      id: true,
      company_id: true,
      email: true,
      username: true,
      name: true,
      entity_id: true,
      is_active: true,
      last_login: true,
      emailVerified: true,
    },
    with: { entity: true },
  });

  if (!user) throw new AuthError('Usuario no encontrado');

  const resolvedCompanyId = activeCompanyId || user.company_id;

  const [roles, permissions, [company]] = await Promise.all([
    getUserRoles(user.id, resolvedCompanyId),
    getUserPermissions(user.id, resolvedCompanyId),
    resolvedCompanyId
      ? adminDb
          .select({ slug: companies.slug })
          .from(companies)
          .where(eq(companies.id, resolvedCompanyId))
          .limit(1)
      : Promise.resolve([]),
  ]);

  return {
    id: user.id,
    companyId: resolvedCompanyId ?? 0,
    companySlug: company?.slug ?? null,
    email: user.email,
    username: user.username || user.name,
    entityId: user.entity_id,
    isActive: user.is_active,
    lastLogin: user.last_login,
    emailVerifiedAt: user.emailVerified ? new Date() : null,
    roles,
    permissions,
    entity: mapEntity(user.entity),
  };
}

/**
 * User personal profile update
 */
export async function updateProfile(
  userId: string | number,
  data: { username?: string; email?: string }
) {
  const userIdStr = String(userId);
  const updateData: { username?: string; name?: string; email?: string } = {};

  if (data.username) {
    updateData.username = data.username;
    updateData.name = data.username;
  }
  if (data.email) updateData.email = data.email;

  if (Object.keys(updateData).length === 0) {
    return { success: true, message: 'Sin cambios' } as const;
  }

  const [updated] = await db.update(users).set(updateData).where(eq(users.id, userIdStr)).returning({
    id: users.id,
    email: users.email,
    username: users.username,
  });

  if (!updated) throw new AuthError('Usuario no encontrado');

  broadcast(RealtimeEvents.USER.PROFILE_UPDATED, { id: userIdStr, ...updateData }, `user:${userIdStr}`);

  return { success: true, user: updated } as const;
}
