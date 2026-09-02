import { db, adminDb } from '../../core/db';
import { authUsers as users, companies, member, entities } from '@app/schema/tables';
import { eq, and } from '@app/schema';
import type { ProfileEntityType } from '@app/schema/dto';
import { getUserRoles, getUserPermissions } from '../rbac/rbac.permission.service';
import { getMenuForUser } from '../settings/menu.service';
import { broadcastToUser } from '../../core/sse';
import { RealtimeEvents } from '@app/schema/realtime-events';
import { AuthError } from '../auth/session.service';

export function mapEntity(entity: { id: string; business_name: string; is_client: boolean | null; is_supplier: boolean | null; is_employee: boolean | null } | null | undefined): ProfileEntityType | undefined {
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
 * Get current user profile with roles, permissions, and tenant metadata.
 * 
 * Company resolution: activeCompanyId (from auth-guard via activeOrganizationId) is the source of truth.
 * Entity resolution: member.entityId (per-org) is the source of truth, NOT user.entity_id (denormalized).
 */
export async function getMe(userId: string | number, activeCompanyId?: number | null) {
  const userIdStr = String(userId);
  const user = await adminDb.query.authUsers.findFirst({
    where: eq(users.id, userIdStr),
    columns: {
      id: true,
      company_id: true,
      email: true,
      username: true,
      name: true,
      is_active: true,
      last_login: true,
      emailVerified: true,
    },
  });

  if (!user) throw new AuthError('Usuario no encontrado');

  // Respect the auth-guard decision: if activeCompanyId is null/0,
  // the user has multiple orgs and needs to pick one.
  const resolvedCompanyId = activeCompanyId || null;

  // Resolve entity from member table (per-org entity mapping).
  let resolvedEntityId: string | null = null;
  let resolvedEntity: Parameters<typeof mapEntity>[0] = null;

  if (resolvedCompanyId) {
    const [memberRow] = await adminDb
      .select({
        entityId: member.entityId,
        entityBusinessName: entities.business_name,
        entityIsClient: entities.is_client,
        entityIsSupplier: entities.is_supplier,
        entityIsEmployee: entities.is_employee,
      })
      .from(member)
      .innerJoin(companies, eq(companies.organization_id, member.organizationId))
      .leftJoin(entities, eq(entities.id, member.entityId))
      .where(
        and(
          eq(member.userId, userIdStr),
          eq(companies.id, resolvedCompanyId),
        )
      )
      .limit(1);

    if (memberRow?.entityId) {
      resolvedEntityId = memberRow.entityId;
      resolvedEntity = {
        id: memberRow.entityId,
        business_name: memberRow.entityBusinessName || '',
        is_client: memberRow.entityIsClient,
        is_supplier: memberRow.entityIsSupplier,
        is_employee: memberRow.entityIsEmployee,
      };
    }
  }

  const [roles, permissions, [company], modules] = await Promise.all([
    getUserRoles(user.id, resolvedCompanyId),
    getUserPermissions(user.id, resolvedCompanyId),
    resolvedCompanyId
      ? adminDb
          .select({ slug: companies.slug })
          .from(companies)
          .where(eq(companies.id, resolvedCompanyId))
          .limit(1)
      : Promise.resolve([]),
    resolvedCompanyId
      ? getMenuForUser(user.id, resolvedCompanyId)
      : Promise.resolve([]),
  ]);

  return {
    id: user.id,
    companyId: resolvedCompanyId ?? 0,
    companySlug: company?.slug ?? null,
    email: user.email,
    name: user.name,
    username: user.username || user.name,
    entityId: resolvedEntityId,
    isActive: user.is_active,
    lastLogin: user.last_login,
    emailVerified: Boolean(user.emailVerified),
    roles,
    permissions,
    entity: mapEntity(resolvedEntity),
    modules,
  };
}

/**
 * User personal profile update
 */
export async function updateProfile(
  userId: string,
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

  broadcastToUser(userIdStr, RealtimeEvents.USER.PROFILE_UPDATED, { id: userIdStr, ...updateData });

  return { success: true, user: updated } as const;
}
