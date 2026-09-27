import { Elysia, t } from 'elysia';
import { getMe, updateProfile } from './profile.service';
import { getActiveSessions, revokeSession } from '../auth/session.service';
import { auth } from '../../config/better-auth';
import { markMfaStepUp, mfaStepUp } from '../../plugins/mfa-step-up';
import {
  UpdateProfileBodySchema,
  UserSessionResponseSchema,
  ProfileResponseSchema,
  UpdateProfileResponseSchema,
  SuccessResponseSchema,
  MfaVerifyBodySchema,
  MfaVerifyResponseSchema,
  ChangePasswordBodySchema,
} from '@app/schema/backend';
import { authGuard } from '../../plugins/auth-guard';

export const profileRoutes = new Elysia({ prefix: '/profile' })
  .use(authGuard)
  .use(mfaStepUp)
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
    return getActiveSessions(currentUserId, undefined, currentSessionId);
  }, {
    response: t.Array(UserSessionResponseSchema),
  })
  .delete('/sessions/:id', async ({ currentUserId, params }) => {
    const result = await revokeSession(params.id, currentUserId);
    return result;
  }, {
    response: SuccessResponseSchema,
  })
  .post('/security/mfa/verify', async ({ body, request, currentSessionId }) => {
    await auth.api.verifyTOTP({
      headers: request.headers,
      body: { code: body.code, trustDevice: false },
    });
    await markMfaStepUp(currentSessionId);
    return { success: true };
  }, {
    body: MfaVerifyBodySchema,
    response: MfaVerifyResponseSchema,
  })
  .post('/security/password', async ({ body, request }) => {
    await auth.api.changePassword({
      headers: request.headers,
      body: {
        currentPassword: body.currentPassword,
        newPassword: body.newPassword,
        revokeOtherSessions: true,
      },
    });
    return { success: true };
  }, {
    body: ChangePasswordBodySchema,
    response: SuccessResponseSchema,
  });
