import { Component, createSignal, createMemo, createEffect, Show, splitProps } from 'solid-js';
import { cn } from '../../lib/utils';
import { getAvatarGradientStyle, getInitials } from '../../utils/avatar';

export interface AvatarProps {
    /** Full name or username — first 2 chars become initials */
    name: string;
    /** Image URL (e.g. from OAuth Google/Microsoft). If absent or fails to load, falls back to gradient initials */
    src?: string | null;
    /** Accessible alt text (defaults to name) */
    alt?: string;
    /** Size preset */
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
    /** Shape: 'circle' (rounded-full) or 'rounded' (rounded-xl / rounded-2xl) */
    shape?: 'circle' | 'rounded';
    class?: string;
}

const sizeClasses: Record<NonNullable<AvatarProps['size']>, string> = {
    sm: 'size-8 text-xs',
    md: 'size-10 text-sm',
    lg: 'size-12 text-base',
    xl: 'size-16 text-xl',
    '2xl': 'size-20 sm:size-24 text-2xl sm:text-3xl',
};

/**
 * Resilient Avatar component supporting OAuth images with deterministic gradient fallback.
 * 
 * - Renders OAuth avatar via <img> with lazy loading and referrerpolicy="no-referrer" (crucial for Google OAuth).
 * - Reactively switches to deterministic initials + gradient on network/CORS error (onError) or when src is absent.
 */
export const Avatar: Component<AvatarProps> = (props) => {
    const [local, rest] = splitProps(props, ['name', 'src', 'alt', 'size', 'shape', 'class']);

    const [imageError, setImageError] = createSignal(false);

    // Reset error state whenever the image source changes
    createEffect(() => {
        local.src;
        setImageError(false);
    });

    const showImage = createMemo(() => Boolean(local.src && !imageError()));
    const avatarStyle = createMemo(() => getAvatarGradientStyle(local.name || ''));
    const initials = createMemo(() => getInitials(local.name || ''));

    const shapeClass = () => {
        if (local.shape === 'circle') return 'rounded-full';
        return local.size === '2xl' ? 'rounded-2xl' : 'rounded-xl';
    };

    return (
        <div
            class={cn(
                'relative inline-flex items-center justify-center shrink-0 overflow-hidden select-none font-semibold shadow-xs',
                shapeClass(),
                sizeClasses[local.size ?? 'md'],
                local.class,
            )}
            style={!showImage() ? avatarStyle() : undefined}
            {...rest}
        >
            <Show
                when={showImage()}
                fallback={
                    <span class="text-white font-bold leading-none">
                        {initials()}
                    </span>
                }
            >
                <img
                    src={local.src!}
                    alt={local.alt || local.name}
                    class="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                    referrerpolicy="no-referrer"
                    onError={() => setImageError(true)}
                />
            </Show>
        </div>
    );
};

export default Avatar;
