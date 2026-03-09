/**
 * DataTableSelectionBar - Floating bottom bar for bulk actions on selected rows
 *
 * Features:
 * - Fixed position at bottom center of viewport
 * - Smooth slide-up / fade-in animation
 * - Responsive: wraps on very narrow screens with bottom safe-area
 * - Selection count with total context
 * - Slot-based children for flexible action buttons
 * - Glassmorphism styling matching the app design system
 */
import { Component, Show, JSX, createSignal, createEffect, on } from 'solid-js';
import { XIcon } from '../icons';
import { cn } from '@shared/lib/utils';

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
    <div class="h-5 w-px bg-border-strong/40 mx-0.5" aria-hidden="true" />
);

/** Single action button within the bar */
export const SelectionBarAction: Component<{
    icon?: JSX.Element;
    label: string;
    onClick: () => void;
    variant?: 'default' | 'danger' | 'warning' | 'success';
    loading?: boolean;
    loadingText?: string;
    disabled?: boolean;
    /** Hide label text (icon-only) on mobile */
    iconOnMobile?: boolean;
}> = (props) => {
    const variantClass = () => {
        if (props.variant === 'danger')   return 'text-danger hover:bg-danger/10';
        if (props.variant === 'warning')  return 'text-amber-400 hover:bg-amber-500/10';
        if (props.variant === 'success')  return 'text-emerald-500 hover:bg-emerald-500/10';
        return 'text-text hover:bg-card-alt';
    };

    return (
        <button
            onClick={props.onClick}
            disabled={props.disabled || props.loading}
            class={cn(
                'inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium',
                'transition-all duration-150 cursor-pointer whitespace-nowrap',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                variantClass(),
            )}
        >
            <Show
                when={props.loading}
                fallback={
                    <>
                        <Show when={props.icon}>
                            <span class="size-4 shrink-0">{props.icon}</span>
                        </Show>
                        <span class={props.iconOnMobile ? 'hidden sm:inline-block' : undefined}>
                            {props.label}
                        </span>
                    </>
                }
            >
                <svg class="animate-spin size-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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

    createEffect(on(
        () => props.selectedCount > 0,
        (hasSelection) => {
            if (hasSelection) {
                setShouldRender(true);
                requestAnimationFrame(() => setVisible(true));
            } else {
                setVisible(false);
                const timer = setTimeout(() => setShouldRender(false), 200);
                return () => clearTimeout(timer);
            }
        }
    ));

    return (
        <Show when={shouldRender()}>
            <div
                class={cn(
                    // Positioning — stays above mobile nav/safe-area
                    'fixed bottom-[calc(env(safe-area-inset-bottom,0px)+16px)] left-1/2 z-50',
                    'w-[max-content] max-w-[calc(100vw-2rem)]', // Adjust max width to wrap content smoothly
                    // Layout — wrap on very narrow screens
                    'flex flex-wrap items-center justify-between gap-1  px-3 py-2', // Reduced gaps
                    // Glass surface
                    'bg-surface/95 backdrop-blur-xl',
                    'border border-border-strong rounded-full sm:rounded-2xl', // More pill-like on mobile
                    // Animation
                    'transition-all duration-200 ease-out',
                    visible()
                        ? 'opacity-100 -translate-x-1/2 translate-y-0'
                        : 'opacity-0 -translate-x-1/2 translate-y-4',
                )}
                style={{
                    'box-shadow': '0 20px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05) inset',
                }}
            >
                {/* Left: count */}
                <div class="flex items-center gap-2 shrink-0">
                    <span class="flex items-center justify-center min-w-[1.75rem] h-6 px-2 rounded-full bg-primary/15 text-primary text-xs font-bold tabular-nums">
                        {props.selectedCount}
                    </span>
                    <span class="text-sm text-muted whitespace-nowrap hidden sm:inline-block"> {/* Hidden on smallest mobile screens */}
                        de {props.totalRows} selecc.
                    </span>
                    <span class="text-sm text-muted whitespace-nowrap sm:hidden">
                        /{props.totalRows}
                    </span>
                    <SelectionBarSeparator />
                </div>

                {/* Center: action buttons */}
                <div class="flex flex-[1_0_auto] items-center justify-center sm:justify-start gap-0.5 sm:gap-1">
                    {props.children}
                </div>

                {/* Right: clear */}
                <div class="flex items-center gap-1 shrink-0">
                    <SelectionBarSeparator />
                    <button
                        onClick={props.onClearSelection}
                        class="p-1.5 rounded-lg text-muted hover:text-text hover:bg-card-alt transition-colors duration-150 cursor-pointer"
                        title="Deseleccionar todo"
                    >
                        <XIcon class="size-4" />
                    </button>
                </div>
            </div>
        </Show>
    );
};

export default DataTableSelectionBar;
