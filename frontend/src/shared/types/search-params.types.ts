/**
 * Shared SearchParams types for Sheet/Panel navigation.
 *
 * Every module that renders sheets (New, Edit, Show) via URL searchParams
 * should reuse these types and the `validatePanelSearch` function in its
 * route definition.
 */

export type PanelType = 'new' | 'edit' | 'show';

export interface PanelSearch {
    panel?: PanelType;
    id?: number;
    /** Tracks which panel the user came from (e.g. 'show') — enables conditional back button */
    from?: PanelType;
    modal?: string; // cross-module modals (e.g. ?modal=newUser)
    modalId?: number; // target ID for the active cross-module modal
    /** Tracks cross-module back navigation */
    fromModal?: string;
}

const VALID_PANELS: PanelType[] = ['new', 'edit', 'show'];

/**
 * TanStack Router `validateSearch` — sanitises raw query-string values
 * into a typed `PanelSearch` object.  Unknown keys are preserved so
 * modules can keep their own extra params (e.g. `tab`, `rolesSearch`).
 */
export const validatePanelSearch = (raw: Record<string, unknown>): PanelSearch => ({
    ...raw,
    panel: VALID_PANELS.includes(raw.panel as PanelType)
        ? (raw.panel as PanelType)
        : undefined,
    id: typeof raw.id === 'number'
        ? raw.id
        : typeof raw.id === 'string'
            ? Number(raw.id) || undefined
            : undefined,
    from: VALID_PANELS.includes(raw.from as PanelType)
        ? (raw.from as PanelType)
        : undefined,
    modal: typeof raw.modal === 'string' ? raw.modal : undefined,
    modalId: typeof raw.modalId === 'number'
        ? raw.modalId
        : typeof raw.modalId === 'string'
            ? Number(raw.modalId) || undefined
            : undefined,
    fromModal: typeof raw.fromModal === 'string' ? raw.fromModal : undefined,
});
