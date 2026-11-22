import { Elysia, t } from 'elysia';
import { getMe, updateProfile } from './profile.service';
import { getActiveSessions, revokeSession } from '../auth/session.service';
import { auth } from '../../config/better-auth';
import { markMfaStepUp, mfaStepUp } from '../../plugins/mfa-step-up';
import { adminDb } from '../../core/db';
import { sessions } from '@app/schema/tables';
import { eq } from '@app/schema';
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

function forwardSetCookies(headers: Headers | undefined, set: { headers: Record<string, string | number | string[]> }) {
  if (!headers) return;
  const setCookies = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : (headers.get('set-cookie') ? [headers.get('set-cookie')!] : []);
  if (setCookies.length > 0) {
    set.headers['set-cookie'] = setCookies.length === 1 ? setCookies[0] : setCookies;
  }
}

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
  .post('/security/mfa/verify', async ({ body, request, currentSessionId, set }) => {
    const result = await auth.api.verifyTOTP({
      headers: request.headers,
      body: { code: body.code, trustDevice: false },
      returnHeaders: true,
    });
    forwardSetCookies(result.headers, set);

    let stepUpSessionId = currentSessionId;
    const responseToken = (result.response as { token?: string } | undefined)?.token;
    if (responseToken) {
      const [rotatedSession] = await adminDb
        .select({ id: sessions.id })
        .from(sessions)
        .where(eq(sessions.token, responseToken))
        .limit(1);
      if (rotatedSession?.id) {
        stepUpSessionId = rotatedSession.id;
      }
    }
    await markMfaStepUp(stepUpSessionId);
    return { success: true };
  }, {
    body: MfaVerifyBodySchema,
    response: MfaVerifyResponseSchema,
  })
  .post('/security/password', async ({ body, request, set }) => {
    const result = await auth.api.changePassword({
      headers: request.headers,
      body: {
        currentPassword: body.currentPassword,
        newPassword: body.newPassword,
        revokeOtherSessions: true,
      },
      returnHeaders: true,
    });
    forwardSetCookies(result.headers, set);
    return { success: true };
  }, {
    body: ChangePasswordBodySchema,
    response: SuccessResponseSchema,
  });
