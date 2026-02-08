import { Component, For, Show } from 'solid-js';

interface SkeletonLoaderProps {
    type: 'table-row' | 'card' | 'text' | 'avatar' | 'list-item';
    count?: number;
}

const TableRowSkeleton = () => (
    <div class="flex items-center gap-4 px-4 py-3 border-b border-surface/50 animate-pulse">
        <div class="w-10 h-10 rounded-full bg-surface" />
        <div class="flex-1 space-y-2">
            <div class="w-32 h-4 rounded bg-surface" />
            <div class="w-48 h-3 rounded bg-surface" />
        </div>
        <div class="w-20 h-5 rounded-full bg-surface" />
        <div class="w-16 h-5 rounded-full bg-surface" />
    </div>
);

const CardSkeleton = () => (
    <div class="bg-card border border-border shadow-card-soft rounded-xl p-5 animate-pulse">
        <div class="flex items-start justify-between mb-3">
            <div class="space-y-2">
                <div class="h-6 w-24 bg-surface rounded" />
                <div class="h-4 w-32 bg-surface rounded" />
            </div>
            <div class="w-10 h-10 rounded-lg bg-surface" />
        </div>
        <div class="h-4 w-20 bg-surface rounded mb-4" />
        <div class="h-8 bg-surface rounded" />
    </div>
);

const TextSkeleton = () => (
    <div class="animate-pulse space-y-2">
        <div class="h-4 w-full bg-surface rounded" />
        <div class="h-4 w-3/4 bg-surface rounded" />
    </div>
);

const AvatarSkeleton = () => (
    <div class="w-10 h-10 rounded-full bg-surface animate-pulse" />
);

const ListItemSkeleton = () => (
    <div class="flex items-center gap-3 p-3 rounded-lg bg-surface/30 animate-pulse">
        <div class="w-10 h-10 rounded-full bg-surface" />
        <div class="flex-1 space-y-2">
            <div class="w-24 h-4 rounded bg-surface" />
            <div class="w-36 h-3 rounded bg-surface" />
        </div>
        <div class="w-14 h-5 rounded-full bg-surface" />
    </div>
);

export const SkeletonLoader: Component<SkeletonLoaderProps> = (props) => {
    const count = props.count ?? 3;

    const Skeleton = () => {
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
                <For each={Array(count).fill(0)}>{() => <Skeleton />}</For>
            </div>
        }>
            <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <For each={Array(count).fill(0)}>{() => <Skeleton />}</For>
            </div>
        </Show>
    );
};

export default SkeletonLoader;
