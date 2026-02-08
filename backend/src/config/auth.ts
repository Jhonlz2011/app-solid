const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

const COOKIE_DOMAIN = (() => {
    try {
        return new URL(FRONTEND_URL).hostname;
    } catch {
        return undefined;
    }
})();

export const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? ('strict' as const) : ('lax' as const),
    path: '/api/auth',
    domain: COOKIE_DOMAIN === 'localhost' ? undefined : COOKIE_DOMAIN,
    maxAge: 60 * 60 * 24 * Number(process.env.REFRESH_TOKEN_EXP_DAYS ?? 14),
};
