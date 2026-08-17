/**
 * InfoRow — Reusable label/value display for detail panels.
 *
 * Features:
 * - null/undefined → '—'
 * - boolean → 'Sí' / 'No'
 * - Fade-in animation
 */
import type { Component, JSX } from 'solid-js';

export interface InfoRowProps {
    label: string;
    value?: string | number | boolean | null;
    /** Optional custom renderer — overrides the default value display */
    children?: JSX.Element;
}

export const InfoRow: Component<InfoRowProps> = (props) => {
    const displayValue = () => {
        if (props.value === null || props.value === undefined || props.value === '') return '—';
        if (typeof props.value === 'boolean') return props.value ? 'Sí' : 'No';
        return String(props.value);
    };

    return (
        <div class="flex flex-col gap-1 animate-in fade-in">
            <span class="text-xs font-medium text-muted uppercase tracking-wider">{props.label}</span>
            {props.children ?? <span class="text-sm text-text font-medium">{displayValue()}</span>}
        </div>
    );
};
