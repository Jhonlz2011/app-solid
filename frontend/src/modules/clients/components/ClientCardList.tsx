/**
 * ClientCardList — Mobile infinite-scroll card list for clients.
 *
 * Uses:
 * - `createInfiniteQuery` (TanStack Query) to accumulate paginated data
 * - IntersectionObserver sentinel at the bottom to auto-fetch next pages
 * - Simple <For> loop — 20 items/page keeps DOM lean without needing virtualizer
 */
import { Component, createMemo, onMount, onCleanup, For, Show } from 'solid-js';
import type { RowSelectionState } from '@tanstack/solid-table';
import { useInfiniteClients } from '../data/clients.api';
import type { ClientListItem, ClientFilters } from '../data/clients.api';
import { ClientCard } from './ClientCard';
import { Skeleton } from '@shared/ui/Skeleton';
import { EmptyState } from '@shared/ui/EmptyState';
import { UsersIcon } from '@shared/ui/icons';

type MobileFilters = Omit<ClientFilters, 'cursor' | 'direction'>;

export interface ClientCardListProps {
    filters: () => MobileFilters;
    rowSelection: () => RowSelectionState;
    onRowSelectionChange: (sel: RowSelectionState) => void;
    onView: (client: ClientListItem) => void;
    onEdit: (client: ClientListItem) => void;
    onDelete: (client: ClientListItem) => void;
    onRestore: (client: ClientListItem) => void;
}

export const ClientCardList: Component<ClientCardListProps> = (props) => {
    const query = useInfiniteClients(props.filters);

    // Flatten all accumulated pages into a single reactive list
    const items = createMemo<ClientListItem[]>(() =>
        query.data?.pages.flatMap((p) => p.data) ?? []
    );

    const hasItems = () => items().length > 0;
    const hasNextPage = () => !!query.hasNextPage;
    const isFetchingNextPage = () => query.isFetchingNextPage;
    const totalLoaded = () => items().length;

    // Sentinel element: when it enters the viewport, load next page
    let sentinelRef: HTMLDivElement | undefined;

    onMount(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasNextPage() && !isFetchingNextPage()) {
                    query.fetchNextPage();
                }
            },
            { threshold: 0.1 }
        );
        if (sentinelRef) observer.observe(sentinelRef);
        onCleanup(() => observer.disconnect());
    });

    return (
        <div class="flex flex-col h-full overflow-y-auto">
            {/* First-page skeleton */}
            <Show when={query.isPending}>
                <For each={Array(8).fill(0)}>
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
            </Show>

            {/* Empty state */}
            <Show when={!query.isPending && !hasItems()}>
                <div class="flex-1 flex items-center justify-center p-8">
                    <EmptyState
                        icon={<UsersIcon />}
                        message="No hay clientes"
                        description="Crea uno nuevo para comenzar"
                    />
                </div>
            </Show>

            {/* Cards */}
            <Show when={!query.isPending && hasItems()}>
                <For each={items()}>
                    {(client) => {
                        const id = String(client.id);
                        return (
                            <ClientCard
                                client={client}
                                isSelected={!!props.rowSelection()[id]}
                                onSelect={(checked) => {
                                    const next = { ...props.rowSelection() };
                                    if (checked) next[id] = true;
                                    else delete next[id];
                                    props.onRowSelectionChange(next);
                                }}
                                onView={props.onView}
                                onEdit={props.onEdit}
                                onDelete={props.onDelete}
                                onRestore={props.onRestore}
                            />
                        );
                    }}
                </For>

                {/* Intersection observer sentinel — triggers next-page fetch */}
                <div ref={sentinelRef} class="h-2" />

                {/* Loading more spinner */}
                <Show when={isFetchingNextPage()}>
                    <div class="flex justify-center py-4">
                        <div class="size-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    </div>
                </Show>

                {/* End of list */}
                <Show when={!hasNextPage()}>
                    <p class="text-center text-xs text-muted py-4">
                        {totalLoaded()} clientes en total
                    </p>
                </Show>
            </Show>
        </div>
    );
};
