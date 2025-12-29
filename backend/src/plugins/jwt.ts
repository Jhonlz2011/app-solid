import { jwt } from '@elysiajs/jwt';
import { Elysia } from 'elysia';

export const jwtPlugin = (app: Elysia) => app
    .use(
        jwt({
            name: 'jwt',
            secret: process.env.JWT_SECRET!,
            exp: '15m'
        })
    );