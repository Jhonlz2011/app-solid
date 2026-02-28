import { Component, For } from 'solid-js';
import { Skeleton } from './Skeleton';
import { TableRowSkeleton } from './SkeletonLoader';

// =============================================================================
// PageHeaderSkeleton: Mimics the PageHeader component (icon + title + button)
// =============================================================================
const PageHeaderSkeleton = () => (
    <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
            {/* Icon block */}
            <Skeleton class="size-12 rounded-xl" />
            {/* Title + subtitle */}
            <div class="space-y-2">
                <Skeleton class="h-6 w-40" />
                <Skeleton class="h-3.5 w-56" />
            </div>
        </div>
        {/* Action button */}
        <Skeleton class="h-10 w-36 rounded-xl" />
    </div>
);

// =============================================================================
// ToolbarSkeleton: Mimics SearchInput + filter buttons
// =============================================================================
const ToolbarSkeleton = () => (
    <div class="flex flex-wrap items-center gap-3">
        <Skeleton class="h-10 flex-1 min-w-[200px] max-w-md rounded-xl" />
        <Skeleton class="h-10 w-28 rounded-xl" />
    </div>
);

// =============================================================================
// TableSkeleton: Full table with header + rows
// =============================================================================
const TableSkeleton: Component<{ rows?: number }> = (props) => (
    <div class="bg-card border border-border rounded-2xl shadow-card-soft overflow-hidden h-full">
        {/* Table header */}
        <div class="flex items-center gap-4 px-4 py-3 border-b border-border bg-card/80">
            <Skeleton class="size-4 rounded" />
            <Skeleton class="h-3 w-24" />
            <Skeleton class="h-3 w-20" />
            <Skeleton class="h-3 w-32" />
            <Skeleton class="h-3 w-16" />
            <Skeleton class="h-3 w-20" />
        </div>
        {/* Table rows */}
        <For each={Array.from({ length: props.rows ?? 8 }, (_, i) => i)}>
            {() => <TableRowSkeleton />}
        </For>
    </div>
);

// =============================================================================
// GlobalPageLoader: The primary Suspense fallback for route transitions.
// Mimics a generic ERP module page (PageHeader + Toolbar + DataTable).
// Used by <Suspense> in MainLayout and pendingComponent in router.
// =============================================================================
const GlobalPageLoader: Component = () => (
    <div class="w-full h-full flex flex-col bg-background animate-in fade-in duration-300">
        {/* Header area */}
        <div class="flex-shrink-0 p-6 space-y-5">
            <PageHeaderSkeleton />
            <ToolbarSkeleton />
        </div>
        {/* Table area */}
        <div class="flex-1 min-h-0 px-6 pb-6 w-full">
            <TableSkeleton />
        </div>
    </div>
);

export default GlobalPageLoader;

// =============================================================================
// Named exports for per-module use
// =============================================================================
export {
    PageHeaderSkeleton,
    ToolbarSkeleton,
    TableSkeleton,
};
