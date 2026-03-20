import { Component, splitProps } from 'solid-js';
import { cn } from '../lib/utils';

interface AvatarProps {
    /** Full name or username — first 2 chars become initials */
    name: string;
    size?: 'sm' | 'md' | 'lg';
    class?: string;
}

const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
};

/** 8 gradient pairs — deterministic by name hash */
const gradients = [
    'from-blue-500/20 to-purple-600/40',
    'from-emerald-500/20 to-teal-600/40',
    'from-amber-500/20 to-orange-600/40',
    'from-rose-500/20 to-pink-600/40',
    'from-cyan-500/20 to-sky-600/40',
    'from-violet-500/20 to-indigo-600/40',
    'from-lime-500/20 to-green-600/40',
    'from-fuchsia-500/20 to-purple-600/40',
];

/** Stable hash → pick gradient index */
function hashName(name: string): number {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
}

/**
 * Deterministic avatar with initials and gradient.
 * Color is derived from the name so same name always = same color.
 */
export const Avatar: Component<AvatarProps> = (props) => {
    const [local, rest] = splitProps(props, ['name', 'size', 'class']);
    const initials = () => local.name.slice(0, 2).toUpperCase();
    const gradient = () => gradients[hashName(local.name) % gradients.length];
    const size = () => sizeClasses[local.size ?? 'md'];

    return (
        <div
            class={cn(
                'rounded-full bg-gradient-to-br flex items-center justify-center ring-1 ring-white/10 font-semibold select-none',
                gradient(),
                size(),
                local.class,
            )}
            style={{ color: 'var(--color-primary)' }}
            {...rest}
        >
            {initials()}
        </div>
    );
};

export default Avatar;
