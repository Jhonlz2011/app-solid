import { Component, splitProps, JSX } from 'solid-js';
import { cn } from '../lib/utils';

export interface SkeletonProps extends JSX.HTMLAttributes<HTMLDivElement> {
    /**
     * Whether to show the shimmer animation. Default is true.
     */
    animate?: boolean;
}

/**
 * Modern Shimmer Skeleton Primitive (2026 Standard)
 * Replaces the legacy `animate-pulse` opacity cycling.
 */
export const Skeleton: Component<SkeletonProps> = (props) => {
    const [local, others] = splitProps(props, ['class', 'animate']);
    
    // Default animate to true if strict equality to false isn't provided
    const shouldAnimate = local.animate !== false;

    return (
        <div
            class={cn(
                'bg-surface rounded-md',
                shouldAnimate && 'relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent',
                local.class
            )}
            {...others}
        />
    );
};

export default Skeleton;
