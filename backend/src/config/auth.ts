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

/**
 * Genera la URL base para el inquilino (tenant) de forma dinámica,
 * basándose en el FRONTEND_URL configurado en las variables de entorno.
 */
export function getTenantBaseUrl(slug: string): string {
    try {
        const url = new URL(FRONTEND_URL);
        const hostname = url.hostname;
        const protocol = url.protocol; // 'http:' o 'https:'
        const port = url.port ? `:${url.port}` : '';

        // Si es una dirección IP (ej: 192.168.x.x o 127.0.0.1)
        const ipRegex = /^[0-9.]+$/;
        if (ipRegex.test(hostname)) {
            return `${protocol}//${hostname}${port}`;
        }

        // Si es localhost
        if (hostname === 'localhost') {
            return `${protocol}//${slug}.localhost${port}`;
        }

        // Si es un dominio estándar (ej: zelys.app o in.zelys.app)
        const parts = hostname.split('.');
        let baseDomain = hostname;
        if (parts.length >= 2) {
            // Extraer el dominio base (ej: zelys.app)
            baseDomain = parts.slice(-2).join('.');
        }

        return `${protocol}//${slug}.${baseDomain}${port}`;
    } catch (e) {
        // Fallback seguro en caso de error de parseo
        return env.NODE_ENV === 'production'
            ? `https://${slug}.zelys.app`
            : `http://${slug}.localhost:5173`;
    }
}

/**
 * Genera el enlace de verificación de correo electrónico.
 * Si es una IP, pasa el slug en los query params para que el frontend lo reconozca.
 */
export function getVerificationLink(slug: string, token: string): string {
    const baseUrl = getTenantBaseUrl(slug);
    try {
        const url = new URL(baseUrl);
        const ipRegex = /^[0-9.]+$/;
        const isIp = ipRegex.test(url.hostname);

        if (isIp) {
            return `${baseUrl}/verify-email?token=${token}&slug=${slug}`;
        }
    } catch {}

    return `${baseUrl}/verify-email?token=${token}`;
}
