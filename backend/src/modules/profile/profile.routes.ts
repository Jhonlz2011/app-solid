import { Elysia, t } from 'elysia';
import { getMe, updateProfile } from './profile.service';
import { getActiveSessions, revokeSession } from '../auth/session.service';
import {
  UpdateProfileBodySchema,
  UserSessionResponseSchema,
  ProfileResponseSchema,
  UpdateProfileResponseSchema,
  SuccessResponseSchema,
} from '@app/schema/backend';
import { authGuard } from '../../plugins/auth-guard';

export const profileRoutes = new Elysia({ prefix: '/profile' })
  .use(authGuard)
  .get('/me', async ({ currentUserId, currentCompanyId, currentSessionId }) => {
    const user = await getMe(currentUserId, currentCompanyId);
    return { ...user, sessionId: currentSessionId };
  }, {
    response: ProfileResponseSchema,
  })
  .put(
    '/',
    async ({ body, currentUserId }) => {
      const result = await updateProfile(currentUserId, body);
      return result;
    },
    {
      body: UpdateProfileBodySchema,
      response: UpdateProfileResponseSchema,
    }
  )
  .get('/sessions', async ({ currentUserId, currentSessionId }) => {
    return getActiveSessions(currentUserId, currentSessionId);
  }, {
    response: t.Array(UserSessionResponseSchema),
  })
  .delete('/sessions/:id', async ({ currentUserId, params }) => {
    const result = await revokeSession(params.id, currentUserId);
    return result;
  }, {
    response: SuccessResponseSchema,
  });
