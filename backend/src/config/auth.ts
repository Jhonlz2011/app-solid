import { env } from './env';

const FRONTEND_URL = env.FRONTEND_URL;

const COOKIE_DOMAIN = (() => {
    if (env.COOKIE_DOMAIN) {
        return env.COOKIE_DOMAIN;
    }
    try {
        const hostname = new URL(FRONTEND_URL).hostname;
        if (hostname === 'localhost' || /^[0-9.]+$/.test(hostname)) {
            return undefined;
        }
        const parts = hostname.split('.');
        if (parts.length >= 2) {
            return `.${parts.slice(-2).join('.')}`;
        }
        return hostname;
    } catch {
        return undefined;
    }
})();

export const SESSION_EXPIRE_DAYS = 30;

export const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    domain: COOKIE_DOMAIN,
    maxAge: 60 * 60 * 24 * SESSION_EXPIRE_DAYS,
};
