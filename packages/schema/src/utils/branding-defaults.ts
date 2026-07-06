/**
 * Single source of truth for branding fallback values.
 *
 * Used by:
 *   - index.css (CSS custom properties fallback)
 *   - config.ts (DB column defaults)
 *   - spa-renderer.service.ts (SSR color fallback)
 *   - useCompanySettingsForm.ts (form default values)
 *   - generate-branding-fallback.ts (pre-JS script generation)
 */
export const BRANDING_DEFAULTS = {
    primaryColor: '#2563eb',
    themeColor: '#64748b',
} as const;
