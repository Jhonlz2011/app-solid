/**
 * Theme presets — shared between frontend (branding.store) and backend (spa-renderer).
 * Maps secondary color hex to background/surface/card/border CSS variable values.
 */

export interface ThemePreset {
    bgLight: string;
    bgDark: string;
    surfaceLight: string;
    surfaceDark: string;
    cardLight: string;
    cardDark: string;
    cardAltLight: string;
    cardAltDark: string;
    borderLight: string;
    borderDark: string;
}

export const THEME_PRESETS: Record<string, ThemePreset> = {
    '#3b82f6': {
        bgLight: '#f4f7fb',
        bgDark: '#020617',
        surfaceLight: '#ffffff',
        surfaceDark: '#0f172a',
        cardLight: '#ffffff',
        cardDark: '#111827',
        cardAltLight: '#eef2ff',
        cardAltDark: '#1e293b',
        borderLight: '#e7eff8',
        borderDark: '#1f2533',
    },
    '#10b981': {
        bgLight: '#f0f7f4',
        bgDark: '#051c14',
        surfaceLight: '#ffffff',
        surfaceDark: '#0c2c20',
        cardLight: '#ffffff',
        cardDark: '#111827',
        cardAltLight: '#e2efe9',
        cardAltDark: '#112d24',
        borderLight: '#e2efe9',
        borderDark: '#183f31',
    },
    '#f59e0b': {
        bgLight: '#faf8f5',
        bgDark: '#1c1917',
        surfaceLight: '#ffffff',
        surfaceDark: '#292524',
        cardLight: '#ffffff',
        cardDark: '#111827',
        cardAltLight: '#f1ebe1',
        cardAltDark: '#383330',
        borderLight: '#f1ebe1',
        borderDark: '#44403c',
    },
    '#64748b': {
        bgLight: '#f4f7fb',
        bgDark: '#020617',
        surfaceLight: '#fff',
        surfaceDark: '#0f172a',
        cardLight: '#fff',
        cardDark: '#111827',
        cardAltLight: '#eef2ff',
        cardAltDark: '#1f2937',
        borderLight: '#e7eff8',
        borderDark: '#1f2533',
    },
} as const;

export const DEFAULT_THEME_KEY = '#64748b';

export type ThemePresetKey = keyof typeof THEME_PRESETS;
