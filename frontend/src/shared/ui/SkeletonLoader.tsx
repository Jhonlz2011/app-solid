import { Component, For, Show } from 'solid-js';
import { Skeleton } from './Skeleton';

interface SkeletonLoaderProps {
    type: 'table-row' | 'card' | 'text' | 'avatar' | 'list-item';
    count?: number;
}

export const TableRowSkeleton = () => (
    <div class="flex items-center gap-4 px-4 py-3 border-b border-surface/50">
        <Skeleton class="w-10 h-10 rounded-full" />
        <div class="flex-1 space-y-2">
            <Skeleton class="w-32 h-4 rounded" />
            <Skeleton class="w-48 h-3 rounded" />
        </div>
        <Skeleton class="w-20 h-5 rounded-full" />
        <Skeleton class="w-16 h-5 rounded-full" />
    </div>
);

export const CardSkeleton = () => (
    <div class="bg-card border border-border shadow-card-soft rounded-xl p-5">
        <div class="flex items-start justify-between mb-3">
            <div class="space-y-2">
                <Skeleton class="h-6 w-24 rounded" />
                <Skeleton class="h-4 w-32 rounded" />
            </div>
            <Skeleton class="w-10 h-10 rounded-lg" />
        </div>
        <Skeleton class="h-4 w-20 rounded mb-4" />
        <Skeleton class="h-8 rounded" />
    </div>
);

export const TextSkeleton = () => (
    <div class="space-y-2">
        <Skeleton class="h-4 w-full rounded" />
        <Skeleton class="h-4 w-3/4 rounded" />
    </div>
);

export const AvatarSkeleton = () => (
    <Skeleton class="w-10 h-10 rounded-full" />
);

export const ListItemSkeleton = () => (
    <div class="flex items-center gap-3 p-3 rounded-lg bg-surface/30">
        <Skeleton class="w-10 h-10 rounded-full" />
        <div class="flex-1 space-y-2">
            <Skeleton class="w-24 h-4 rounded" />
            <Skeleton class="w-36 h-3 rounded" />
        </div>
        <Skeleton class="w-14 h-5 rounded-full" />
    </div>
);

// Backward compatibility wrapper
export const SkeletonLoader: Component<SkeletonLoaderProps> = (props) => {
    const count = props.count ?? 3;

    const LegacySkeleton = () => {
        switch (props.type) {
            case 'table-row': return <TableRowSkeleton />;
            case 'card': return <CardSkeleton />;
            case 'avatar': return <AvatarSkeleton />;
            case 'list-item': return <ListItemSkeleton />;
            default: return <TextSkeleton />;
        }
    };

    return (
        <Show when={props.type === 'card'} fallback={
            <div class="space-y-1">
                <For each={Array.from({ length: count }, (_, i) => i)}>{() => <LegacySkeleton />}</For>
            </div>
        }>
            <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <For each={Array.from({ length: count }, (_, i) => i)}>{() => <LegacySkeleton />}</For>
            </div>
        </Show>
    );
};

export default SkeletonLoader;
