/**
 * session.utils.ts — Shared session utilities
 *
 * Extracted from profile/SessionItem and users/UserShowPanel to eliminate duplication.
 * Used by both the profile session list and the admin user sessions panel.
 */
import { UAParser } from 'ua-parser-js';

/**
 * Parse a User-Agent string into human-readable browser/OS info and a device icon SVG path.
 */
export const parseUserAgent = (ua: string | null): { browser: string; os: string; icon: string } => {
    if (!ua) return { browser: 'Desconocido', os: 'Desconocido', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' };

    const parser = new UAParser(ua);
    const result = parser.getResult();

    let browserName = result.browser.name || 'Navegador Web';
    let osName = result.os.name || 'Desconocido';
    let deviceType = result.device.type;
    let vendor = result.device.vendor;
    let model = result.device.model;

    let displayName = osName;

    if (vendor && model) {
        displayName = `${vendor} ${model}`;
    } else if (model) {
        displayName = model;
    }

    if (model && model.length <= 2) {
        displayName = osName;
    } else if (displayName === 'Desconocido') {
        displayName = osName;
    }

    let icon = 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z';

    if (deviceType === 'mobile' || deviceType === 'tablet' || osName === 'Android' || osName === 'iOS') {
        icon = 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z';
    }

    return { browser: browserName, os: displayName, icon };
};

/**
 * Format a date string for session display.
 * Uses es-EC locale with abbreviated month.
 */
export const formatSessionDate = (dateStr: string): string => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-EC', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC'
    });
};
