import { Elysia, t } from 'elysia';
import { getMe, updateProfile } from '../auth/profile.service';
import { getActiveSessions, revokeSession } from '../auth/session.service';
import {
  AuthUpdateProfileDto,
  UserSessionItemSchema,
} from '@app/schema/backend';
import { authGuard } from '../../plugins/auth-guard';

export const profileRoutes = new Elysia({ prefix: '/profile' })
  .use(authGuard)
  .get('/me', async ({ currentUserId, currentCompanyId, currentSessionId }) => {
    const user = await getMe(currentUserId, currentCompanyId);
    return { ...user, sessionId: currentSessionId };
  }, {
    // Flat schema — avoids nested Type.Composite + Type.Date() serialization issues in Elysia
    response: t.Object({
      id: t.Union([t.String(), t.Number()]),
      companyId: t.Number(),
      companySlug: t.Union([t.String(), t.Null()]),
      email: t.String(),
      username: t.Optional(t.Union([t.String(), t.Null()])),
      entityId: t.Optional(t.Union([t.Number(), t.Null()])),
      isActive: t.Optional(t.Union([t.Boolean(), t.Null()])),
      lastLogin: t.Optional(t.Union([t.String(), t.Null()])),
      emailVerified: t.Optional(t.Boolean()),
      emailVerifiedAt: t.Optional(t.Union([t.String(), t.Null()])),
      roles: t.Array(t.String()),
      permissions: t.Array(t.String()),
      entity: t.Optional(t.Object({
        id: t.Number(),
        businessName: t.String(),
        isClient: t.Boolean(),
        isSupplier: t.Boolean(),
        isEmployee: t.Boolean(),
      })),
      sessionId: t.String(),
    }),
  })
  .put(
    '/',
    async ({ body, currentUserId }) => {
      const result = await updateProfile(currentUserId, body);
      return result;
    },
    {
      body: AuthUpdateProfileDto,
      response: t.Object({
        success: t.Literal(true),
        message: t.Optional(t.String()),
        user: t.Optional(t.Object({
          id: t.Union([t.Number(), t.String()]),
          email: t.String(),
          username: t.String(),
        })),
      }),
    }
  )
  .get('/sessions', async ({ currentUserId, currentSessionId }) => {
    return getActiveSessions(currentUserId, currentSessionId);
  }, {
    response: t.Array(UserSessionItemSchema),
  })
  .delete('/sessions/:id', async ({ currentUserId, params }) => {
    const result = await revokeSession(params.id, currentUserId);
    return result;
  }, {
    response: t.Object({ success: t.Literal(true) }),
  });
