import { Component, Switch, Match, type Accessor } from 'solid-js';
import { cn } from '@shared/lib/utils';
import { SparklesIcon } from '@icons/SparklesIcon';
import { AlertTriangleIcon } from '@icons/AlertTriangleIcon';
import type { AvailabilityStatus } from '@shared/hooks/useAvailabilityCheck';

export interface AvailabilityBadgeProps {
    status: Accessor<AvailabilityStatus> | AvailabilityStatus;
    availableLabel?: string;
    takenLabel?: string;
    currentLabel?: string;
    checkingLabel?: string;
    class?: string;
}

/**
 * Visual badge for real-time field availability checks.
 * Uses SparklesIcon and AlertTriangleIcon matching UserCreateForm visual design.
 * Loader is handled at the TextField input level. Text size is 10px.
 * Includes min-h to prevent layout shifts (CLS).
 */
export const AvailabilityBadge: Component<AvailabilityBadgeProps> = (props) => {
    const currentStatus = () => typeof props.status === 'function' ? props.status() : props.status;
    const isVisible = () => currentStatus() !== 'idle' && currentStatus() !== 'invalid' && currentStatus() !== 'checking';

    return (
        <div
            class={cn(
                "inline-flex items-center min-h-[20px] transition-opacity duration-200",
                isVisible() ? "opacity-100" : "opacity-0 pointer-events-none select-none",
                props.class
            )}
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
};

export default AvailabilityBadge;
