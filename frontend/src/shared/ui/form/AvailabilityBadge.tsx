import { Component, Switch, Match, untrack, createMemo, useContext, type Accessor } from 'solid-js';
import { cn } from '@shared/lib/utils';
import { SparklesIcon } from '@icons/SparklesIcon';
import { AlertTriangleIcon } from '@icons/AlertTriangleIcon';
import { TextFieldContext } from './TextField';
import type { FieldLike } from './form.types';

export type AvailabilityBadgeStatus = 'idle' | 'checking' | 'current' | 'available' | 'taken' | 'invalid';

export interface AvailabilityBadgeProps {
    /** Optional field object or accessor; if omitted, resolves automatically from TextFieldContext */
    field?: FieldLike<any> | Accessor<FieldLike<any> | undefined>;
    /** Optional current value (e.g. current user's username/email) to display 'currentLabel' */
    currentValue?: string | Accessor<string | undefined | null>;
    /** Minimum length required to mark as 'available'. Default: 3 */
    minLength?: number;
    /** Direct status accessor for backward compatibility */
    status?: Accessor<AvailabilityBadgeStatus> | AvailabilityBadgeStatus;
    availableLabel?: string;
    takenLabel?: string;
    currentLabel?: string;
    checkingLabel?: string;
    class?: string;
}

/**
 * Visual badge for real-time field availability checks.
 * Uses SparklesIcon and AlertTriangleIcon matching visual design.
 * Integrates natively with TanStack Form field state (isValidating, errors, value).
 * Text size is 10px. Includes min-h to prevent layout shifts (CLS).
 */
export const AvailabilityBadge: Component<AvailabilityBadgeProps> = (props) => {
    return untrack(() => {
        const context = useContext(TextFieldContext);

        const getField = (): FieldLike<any> | undefined => {
            if (props.field) {
                return typeof props.field === 'function' ? props.field() : props.field;
            }
            return context?.field();
        };

        const resolveCurrentValue = (): string | undefined => {
            if (!props.currentValue) return undefined;
            const v = typeof props.currentValue === 'function' ? props.currentValue() : props.currentValue;
            return v ? String(v).trim().toLowerCase() : undefined;
        };

        const currentStatus = createMemo<AvailabilityBadgeStatus>(() => {
            // 1. Direct explicit status takes priority if passed
            if (props.status !== undefined) {
                return typeof props.status === 'function'
                    ? (props.status as Accessor<AvailabilityBadgeStatus>)()
                    : props.status;
            }

            // 2. Native TanStack Form field state resolution
            const f = getField();
            if (!f) return 'idle';

            const val = String(f.state.value ?? '').trim();
            if (!val) return 'idle';

            const current = resolveCurrentValue();
            if (current && val.toLowerCase() === current) {
                return 'current';
            }

            if (f.state.meta.isValidating) {
                return 'checking';
            }

            const minLen = props.minLength ?? 3;
            if (val.length < minLen) {
                return 'idle';
            }

            if (f.state.meta.errors.length > 0) {
                return 'taken';
            }

            return 'available';
        });

        const isVisible = createMemo(() => {
            const s = currentStatus();
            return s !== 'idle' && s !== 'invalid' && s !== 'checking';
        });

        return (
            <div
                class={cn(
                    "inline-flex items-center min-h-[20px] transition-opacity duration-200",
                    props.class
                )}
                classList={{
                    "opacity-100": isVisible(),
                    "opacity-0 pointer-events-none select-none": !isVisible(),
                }}
            >
                <Switch>
                    {/* Current value exemption */}
                    <Match when={currentStatus() === 'current'}>
                        <span class="inline-flex items-center gap-1 text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 animate-in fade-in">
                            <SparklesIcon class="size-3 shrink-0" />
                            <span>{props.currentLabel || 'Actual'}</span>
                        </span>
                    </Match>

                    {/* Available */}
                    <Match when={currentStatus() === 'available'}>
                        <span class="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 animate-in fade-in">
                            <SparklesIcon class="size-3 shrink-0" />
                            <span>{props.availableLabel || 'Disponible'}</span>
                        </span>
                    </Match>

                    {/* Already taken */}
                    <Match when={currentStatus() === 'taken'}>
                        <span class="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 animate-in fade-in">
                            <AlertTriangleIcon class="size-3 shrink-0" />
                            <span>{props.takenLabel || 'Ya está en uso'}</span>
                        </span>
                    </Match>
                </Switch>
            </div>
        );
    });
};

export default AvailabilityBadge;
