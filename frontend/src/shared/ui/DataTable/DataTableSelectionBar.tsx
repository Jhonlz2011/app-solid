/**
 * DataTableSelectionBar - Floating bottom bar for bulk actions on selected rows
 *
 * Features:
 * - Fixed position at bottom center of viewport
 * - Smooth slide-up / fade-in animation
 * - Selection count with total context
 * - Slot-based children for flexible action buttons
 * - Glassmorphism styling matching the app's design system
 */
import { Component, Show, JSX, createSignal, createEffect, on } from 'solid-js';
import { XIcon } from './icons';

// =============================================================================
// Types
// =============================================================================

export interface DataTableSelectionBarProps {
    /** Number of currently selected rows */
    selectedCount: number;
    /** Total number of rows (for "X de Y" display) */
    totalRows: number;
    /** Callback to clear selection */
    onClearSelection: () => void;
    /** Action buttons to render (passed as children) */
    children: JSX.Element;
}

// =============================================================================
// Sub-components
// =============================================================================

/** Vertical separator between action groups */
export const SelectionBarSeparator: Component = () => (
    <div class="h-6 w-px bg-border-strong/40 mx-1" aria-hidden="true" />
);

/** Single action button within the bar */
export const SelectionBarAction: Component<{
    icon?: JSX.Element;
    label: string;
    onClick: () => void;
    variant?: 'default' | 'danger';
    loading?: boolean;
    loadingText?: string;
    disabled?: boolean;
}> = (props) => {
    const isDanger = () => props.variant === 'danger';

    return (
        <button
            onClick={props.onClick}
            disabled={props.disabled || props.loading}
            class={`
                inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium
                transition-all duration-150 cursor-pointer
                disabled:opacity-50 disabled:cursor-not-allowed
                ${isDanger()
                    ? 'text-danger hover:bg-danger/10 hover:text-danger'
                    : 'text-text hover:bg-card-alt'
                }
            `}
        >
            <Show when={props.loading} fallback={
                <>
                    <Show when={props.icon}>
                        <span class="size-4 shrink-0">{props.icon}</span>
                    </Show>
                    <span>{props.label}</span>
                </>
            }>
                <svg class="animate-spin size-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>{props.loadingText ?? props.label}</span>
            </Show>
        </button>
    );
};

// =============================================================================
// Main Component
// =============================================================================

export const DataTableSelectionBar: Component<DataTableSelectionBarProps> = (props) => {
    const [visible, setVisible] = createSignal(false);
    const [shouldRender, setShouldRender] = createSignal(false);

    // Animate in/out based on selection
    createEffect(on(
        () => props.selectedCount > 0,
        (hasSelection) => {
            if (hasSelection) {
                setShouldRender(true);
                // RAF to ensure DOM is ready before triggering animation
                requestAnimationFrame(() => setVisible(true));
            } else {
                setVisible(false);
                // Wait for exit animation to complete before unmounting
                const timer = setTimeout(() => setShouldRender(false), 200);
                return () => clearTimeout(timer);
            }
        }
    ));

    return (
        <Show when={shouldRender()}>
            <div
                class={`
                    fixed bottom-6 left-1/2 z-50
                    flex items-center gap-1 px-4 py-2
                    bg-surface/95 backdrop-blur-xl
                    border border-border-strong rounded-xl
                    transition-all duration-200 ease-out
                    ${visible()
                        ? 'opacity-100 -translate-x-1/2 translate-y-0'
                        : 'opacity-0 -translate-x-1/2 translate-y-3'
                    }
                `}
                style={{
                    'box-shadow': '0 20px 60px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
                }}
            >
                {/* Selection count */}
                <div class="flex items-center gap-2 pr-2">
                    <span class="flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-md bg-primary/15 text-primary text-xs font-bold tabular-nums">
                        {props.selectedCount}
                    </span>
                    <span class="text-sm text-muted whitespace-nowrap">
                        de {props.totalRows} seleccionados
                    </span>
                </div>

                <SelectionBarSeparator />

                {/* Action buttons (slot) */}
                <div class="flex items-center gap-0.5">
                    {props.children}
                </div>

                <SelectionBarSeparator />

                {/* Dismiss / clear selection */}
                <button
                    onClick={props.onClearSelection}
                    class="p-1.5 rounded-lg text-muted hover:text-text hover:bg-card-alt transition-colors duration-150 cursor-pointer"
                    title="Deseleccionar todo"
                >
                    <XIcon class="size-4" />
                </button>
            </div>
        </Show>
    );
};

export default DataTableSelectionBar;
