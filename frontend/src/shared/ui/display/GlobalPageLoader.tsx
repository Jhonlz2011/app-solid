import { Component, For } from 'solid-js';
import { Skeleton } from './Skeleton';

// =============================================================================
// PageHeaderSkeleton: Mimics PageHeader (size-8/sm:size-10 icon + horizontal title + count badge + 2 buttons)
// =============================================================================
export const PageHeaderSkeleton: Component = () => (
    <div class="@container flex flex-row items-center justify-between gap-3 sm:gap-4">
        <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 @md:gap-3 truncate">
                {/* Icon container (matches size-8 sm:size-10 rounded-xl shrink-0) */}
                <Skeleton class="size-8 sm:size-10 rounded-xl shrink-0" />
                {/* Title (matches text-xl @md:text-3xl font-bold) */}
                <Skeleton class="h-7 @md:h-9 w-32 @md:w-44 rounded-lg shrink-0" />
                {/* Count pill badge (matches px-2.5 py-0.5 text-sm rounded-full) */}
                <Skeleton class="h-6 w-8 rounded-full shrink-0" />
            </div>
        </div>
        {/* Action buttons (matches h-9.5 px-4 rounded-lg buttons) */}
        <div class="flex items-center gap-2">
            <div class="flex items-center gap-2">
                {/* Import button (icon on mobile, icon+text on @sm:) */}
                <Skeleton class="h-9.5 w-9.5 @sm:w-28 rounded-lg shrink-0" />
                {/* New button (icon on mobile, icon+text on @sm:) */}
                <Skeleton class="h-9.5 w-9.5 @sm:w-24 rounded-lg shrink-0" />
            </div>
        </div>
    </div>
);

// =============================================================================
// ToolbarSkeleton: Mimics SearchInput + secondary actions (Exportar & Columnas/Filtros)
// =============================================================================
export const ToolbarSkeleton: Component = () => (
    <div class="flex flex-wrap items-center gap-2 sm:gap-3">
        {/* Search input (matches: group relative flex-1 w-full min-w-37.5 max-w-md h-9.5) */}
        <Skeleton class="h-9.5 flex-1 w-full min-w-37.5 max-w-md rounded-xl" />
        {/* Secondary buttons */}
        <div class="flex items-center gap-2">
            {/* Export button (icon on mobile, icon+text on sm:) */}
            <Skeleton class="h-9.5 w-9.5 sm:w-24 rounded-lg shrink-0" />
            {/* Columns button (icon on mobile, icon+text on @lg:) */}
            <Skeleton class="h-9.5 w-9.5 @lg:w-28 rounded-xl shrink-0" />
        </div>
    </div>
);

// =============================================================================
// PaginationSkeleton: Mimics DataTable pagination footer
// =============================================================================
export const PaginationSkeleton: Component = () => (
    <div class="flex-shrink-0 p-3 border-t border-border bg-card">
        <div class="flex flex-col sm:flex-row items-center justify-end gap-4">
            <div class="flex items-center gap-4 lg:gap-8 order-1 sm:order-2">
                {/* Rows per page selector */}
                <div class="flex items-center gap-2">
                    <Skeleton class="h-4 w-24 rounded hidden sm:inline-block" />
                    <Skeleton class="h-8 w-[70px] rounded-xl shrink-0" />
                </div>
                {/* Navigation arrow buttons (4 buttons, 2 hidden on < lg) */}
                <div class="flex items-center gap-1.5">
                    <Skeleton class="size-9 rounded-lg hidden lg:block shrink-0" />
                    <Skeleton class="size-9 rounded-lg shrink-0" />
                    <Skeleton class="size-9 rounded-lg shrink-0" />
                    <Skeleton class="size-9 rounded-lg hidden lg:block shrink-0" />
                </div>
            </div>
        </div>
    </div>
);

// =============================================================================
// TableSkeleton: Full desktop table with sticky header, fixed column widths & rows
// =============================================================================
export const TableSkeleton: Component<{ rows?: number }> = (props) => {
    const rowCount = props.rows ?? 8;
    // Organic variations in text/badge widths to avoid rigid repeating patterns
    const rowVariations = [
        { name: 'w-32', id: 'w-24', type: 'w-14', fiscal: 'w-24', contact: 'w-28', status: 'w-16' },
        { name: 'w-40', id: 'w-20', type: 'w-16', fiscal: 'w-20', contact: 'w-36', status: 'w-14' },
        { name: 'w-28', id: 'w-28', type: 'w-12', fiscal: 'w-28', contact: 'w-24', status: 'w-14' },
        { name: 'w-36', id: 'w-22', type: 'w-16', fiscal: 'w-16', contact: 'w-32', status: 'w-16' },
        { name: 'w-44', id: 'w-24', type: 'w-14', fiscal: 'w-24', contact: 'w-20', status: 'w-14' },
        { name: 'w-32', id: 'w-20', type: 'w-12', fiscal: 'w-22', contact: 'w-28', status: 'w-16' },
        { name: 'w-36', id: 'w-26', type: 'w-16', fiscal: 'w-20', contact: 'w-36', status: 'w-14' },
        { name: 'w-40', id: 'w-22', type: 'w-14', fiscal: 'w-26', contact: 'w-24', status: 'w-14' },
    ];

    return (
        <div class="flex flex-col h-full">
            {/* Scrollable table container */}
            <div class="flex-1 overflow-x-auto overflow-y-auto relative">
                <table class="w-full table-fixed caption-bottom text-sm border-separate border-spacing-0">
                    <thead class="border-b border-border sticky top-0 z-[20] bg-card">
                        <tr class="group border-b border-border">
                            {/* Checkbox pinned left */}
                            <th class="h-12 px-2 text-left align-middle sticky z-[30] bg-card left-0 w-[36px]">
                                <Skeleton class="size-4 rounded-md mx-auto" />
                            </th>
                            {/* Razón Social */}
                            <th class="h-12 px-2 text-left align-middle w-[210px]">
                                <Skeleton class="h-4 w-28 rounded" />
                            </th>
                            {/* Identificación */}
                            <th class="h-12 px-2 text-left align-middle w-[170px]">
                                <Skeleton class="h-4 w-24 rounded" />
                            </th>
                            {/* Tipo */}
                            <th class="h-12 px-2 text-left align-middle w-[120px]">
                                <Skeleton class="h-4 w-14 rounded" />
                            </th>
                            {/* Fiscal */}
                            <th class="h-12 px-2 text-left align-middle w-[160px]">
                                <Skeleton class="h-4 w-16 rounded" />
                            </th>
                            {/* Contacto */}
                            <th class="h-12 px-2 text-left align-middle w-[200px]">
                                <Skeleton class="h-4 w-20 rounded" />
                            </th>
                            {/* Estado */}
                            <th class="h-12 px-2 text-left align-middle w-[110px]">
                                <Skeleton class="h-4 w-16 rounded" />
                            </th>
                            {/* Actions pinned right */}
                            <th class="h-12 px-2 text-left align-middle sticky z-[30] bg-card right-0 w-[50px]">
                                <span class="sr-only">Acciones</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody class="[&_tr:last-child]:border-0">
                        <For each={Array.from({ length: rowCount }, (_, i) => i)}>
                            {(index) => {
                                const v = rowVariations[index % rowVariations.length];
                                return (
                                    <tr class="border-b border-border h-14 hover:bg-transparent">
                                        {/* Checkbox */}
                                        <td class="p-2 align-middle sticky z-[10] bg-card left-0 w-[36px]">
                                            <Skeleton class="size-4 rounded-md mx-auto" />
                                        </td>
                                        {/* Razón Social (Avatar + text) */}
                                        <td class="p-2 align-middle w-[210px]">
                                            <div class="flex items-center gap-2.5">
                                                <Skeleton class="size-8 rounded-lg shrink-0" />
                                                <div class="space-y-1.5 flex-1 min-w-0">
                                                    <Skeleton class={`h-3.5 ${v.name} rounded`} />
                                                    <Skeleton class="h-2.5 w-16 rounded opacity-70" />
                                                </div>
                                            </div>
                                        </td>
                                        {/* Identificación */}
                                        <td class="p-2 align-middle w-[170px]">
                                            <Skeleton class={`h-3.5 ${v.id} rounded`} />
                                        </td>
                                        {/* Tipo (Pill badge) */}
                                        <td class="p-2 align-middle w-[120px]">
                                            <Skeleton class={`h-5 ${v.type} rounded-full`} />
                                        </td>
                                        {/* Fiscal */}
                                        <td class="p-2 align-middle w-[160px]">
                                            <Skeleton class={`h-3.5 ${v.fiscal} rounded`} />
                                        </td>
                                        {/* Contacto */}
                                        <td class="p-2 align-middle w-[200px]">
                                            <Skeleton class={`h-3.5 ${v.contact} rounded`} />
                                        </td>
                                        {/* Estado (Status badge) */}
                                        <td class="p-2 align-middle w-[110px]">
                                            <Skeleton class={`h-5 ${v.status} rounded-full`} />
                                        </td>
                                        {/* Acciones */}
                                        <td class="p-2 align-middle sticky z-[10] bg-card right-0 w-[50px]">
                                            <Skeleton class="size-7 rounded-lg mx-auto" />
                                        </td>
                                    </tr>
                                );
                            }}
                        </For>
                    </tbody>
                </table>
            </div>

            {/* Pagination footer */}
            <PaginationSkeleton />
        </div>
    );
};

// =============================================================================
// CardListSkeleton: Mobile infinite scroll card list (< md viewport)
// Matches EntityCardList.tsx loading items structure 1:1
// =============================================================================
export const CardListSkeleton: Component<{ count?: number }> = (props) => (
    <div class="flex flex-col h-full overflow-y-auto">
        <For each={Array.from({ length: props.count ?? 8 }, (_, i) => i)}>
            {() => (
                <div class="flex items-start gap-3 px-4 py-3.5 border-b border-border">
                    <Skeleton class="size-4 rounded-sm mt-0.5 shrink-0" />
                    <Skeleton class="size-10 rounded-xl shrink-0" />
                    <div class="flex-1 flex flex-col gap-2">
                        <Skeleton class="h-4 w-3/5 rounded" />
                        <Skeleton class="h-3 w-2/5 rounded" />
                        <Skeleton class="h-3 w-1/3 rounded" />
                    </div>
                </div>
            )}
        </For>
    </div>
);

// =============================================================================
// GlobalPageLoader: Primary Suspense / Router fallback for Entity Pages
// Zero-CLS match for EntityPage.tsx
// =============================================================================
const GlobalPageLoader: Component = () => (
    <div class="h-full flex flex-col bg-linear-to-br from-background via-background to-surface/20 animate-in fade-in duration-200">
        {/* Header & Toolbar area */}
        <div class="shrink-0 p-3 sm:p-4 space-y-4 sm:space-y-5">
            <PageHeaderSkeleton />
            <ToolbarSkeleton />
        </div>

        {/* Content area: Responsive Dual Display (Desktop Table / Mobile CardList) */}
        <div class="flex-1 min-h-0 px-3 pb-3 sm:px-4 sm:pb-4 overflow-hidden">
            <div class="bg-card border border-border rounded-2xl shadow-card-soft h-full overflow-auto relative">
                {/* Desktop View (>= md) */}
                <div class="hidden md:flex flex-col h-full">
                    <TableSkeleton />
                </div>
                {/* Mobile View (< md) */}
                <div class="flex md:hidden flex-col h-full">
                    <CardListSkeleton />
                </div>
            </div>
        </div>
    </div>
);

export default GlobalPageLoader;


