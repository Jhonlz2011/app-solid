import { Elysia } from 'elysia';
import { UnauthorizedError } from '../services/errors';
import { jwtPlugin } from './jwt';

export const authGuard = (app: Elysia) => app
  .use(jwtPlugin)
  .derive(
    async ({ request, jwt, set }) => {
      const authorization = request.headers.get('authorization');

      if (!authorization?.startsWith('Bearer ')) {
        set.status = 401;
        throw new UnauthorizedError('Token de acceso requerido');
      }

      const token = authorization.replace('Bearer ', '').trim();

      try {
        const payload = await jwt.verify(token);
        if (!payload || typeof payload !== 'object' || !('userId' in payload)) {
          set.status = 401;
          throw new UnauthorizedError('Token inválido');
        }

        return {
          currentUserId: Number(payload.userId),
        };
      } catch (error) {
        set.status = 401;
        if (error instanceof UnauthorizedError) {
          throw error;
        }
        throw new UnauthorizedError('Token inválido o expirado');
      }
    }
  );

