/**
 * clipboard.ts — Cross-browser clipboard utility
 * Provides a safe clipboard write with legacy fallback.
 */

/**
 * Copy text to the system clipboard.
 * Uses the modern Clipboard API when available, falls back to
 * `document.execCommand('copy')` for legacy/non-HTTPS contexts.
 *
 * @returns `true` on success, `false` on failure
 */
export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }

        // Legacy fallback
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        return ok;
    } catch {
        return false;
    }
}
