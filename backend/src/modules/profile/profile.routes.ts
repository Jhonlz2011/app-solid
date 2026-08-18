import { Elysia, t } from 'elysia';
import { getMe, updateProfile } from '../auth/profile.service';
import { getActiveSessions, revokeSession } from '../auth/session.service';
import {
  AuthUpdateProfileDto,
  AuthUserResponse,
  UserSessionItemSchema,
} from '@app/schema/backend';
import { authGuard } from '../../plugins/auth-guard';

export const profileRoutes = new Elysia({ prefix: '/profile' })
  .use(authGuard)
  .get('/me', async ({ currentUserId, currentCompanyId, currentSessionId }) => {
    const user = await getMe(currentUserId, currentCompanyId);
    return { ...user, sessionId: currentSessionId };
  }, {
    response: t.Composite([AuthUserResponse, t.Object({ sessionId: t.String() })]),
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
