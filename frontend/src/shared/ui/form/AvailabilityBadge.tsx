import { Component, Switch, Match, untrack, createMemo, useContext, type Accessor } from 'solid-js';
import { cn } from '@shared/lib/utils';
import { SparklesIcon } from '@icons/SparklesIcon';
import { AlertTriangleIcon } from '@icons/AlertTriangleIcon';
import { Badge } from '@display/Badge';
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

            const errorMap = f.state.meta.errorMap as Record<string, unknown> | undefined;

            // Synchronous format errors (from onChange / onBlur) belong to TextField.ErrorMessage
            // The availability badge must stay idle and NOT report 'taken' for format syntax errors.
            if (errorMap?.onChange || errorMap?.onBlur) {
                return 'idle';
            }

            // Asynchronous check failure (from onChangeAsync) indicates value is already taken
            if (errorMap?.onChangeAsync || errorMap?.onSubmitAsync) {
                return 'taken';
            }

            // Fallback for flat error lists without errorMap partitioning
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
                    "inline-flex items-center min-h-5 transition-opacity duration-200",
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
                        <Badge size="sm" variant="primary" class="animate-in fade-in">
                            <SparklesIcon class="size-3 shrink-0" />
                            <span>{props.currentLabel || 'Actual'}</span>
                        </Badge>
                    </Match>

                    {/* Available */}
                    <Match when={currentStatus() === 'available'}>
                        <Badge size="sm" variant="success" class="animate-in fade-in">
                            <SparklesIcon class="size-3 shrink-0" />
                            <span>{props.availableLabel || 'Disponible'}</span>
                        </Badge>
                    </Match>

                    {/* Already taken */}
                    <Match when={currentStatus() === 'taken'}>
                        <Badge size="sm" variant="warning" class="animate-in fade-in">
                            <AlertTriangleIcon class="size-3 shrink-0" />
                            <span>{props.takenLabel || 'Ya está en uso'}</span>
                        </Badge>
                    </Match>
                </Switch>
            </div>
        );
    });
};

export default AvailabilityBadge;
