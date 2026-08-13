/**
 * EntityCardList.tsx — Generic Mobile Infinite-scroll list for entities.
 */
import { Component, createMemo, onMount, onCleanup, For, Show } from 'solid-js';
import type { RowSelectionState } from '@tanstack/solid-table';
import { Skeleton } from '@shared/ui/Skeleton';
import { EmptyState } from '@shared/ui/EmptyState';
import { UsersIcon } from '@shared/ui/icons';

export interface EntityCardListProps {
    items: any[];
    isLoading: boolean;
    rowSelection: () => RowSelectionState;
    onRowSelectionChange: (sel: RowSelectionState) => void;
    onDelete: (entity: any) => void;
    onRestore: (entity: any) => void;
    emptyMessage?: string;
    CustomCard?: Component<any>; // Allow overriding the card layout if needed
    hasNextPage?: boolean;
    onLoadNext?: () => void;
    isFetchingNext?: boolean;
}

export const EntityCardList: Component<EntityCardListProps> = (props) => {
    const hasItems = () => (props.items || []).length > 0;
    const hasNextPage = () => !!props.hasNextPage;
    const isFetchingNextPage = () => !!props.isFetchingNext;
    const totalLoaded = () => (props.items || []).length;

    let sentinelRef: HTMLDivElement | undefined;

    onMount(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasNextPage() && !isFetchingNextPage()) {
                    props.onLoadNext?.();
                }
            },
            { threshold: 0.1 }
        );
        if (sentinelRef) observer.observe(sentinelRef);
        onCleanup(() => observer.disconnect());
    });

    return (
        <div class="flex flex-col h-full overflow-y-auto">
            <Show when={props.isLoading}>
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

            <Show when={!props.isLoading && !hasItems()}>
                <div class="flex-1 flex items-center justify-center p-8">
                    <EmptyState
                        icon={<UsersIcon />}
                        message={props.emptyMessage || "No hay registros"}
                        description="Crea uno nuevo para comenzar"
                    />
                </div>
            </Show>

            <Show when={!props.isLoading && hasItems()}>
                <For each={props.items || []}>
                    {(entity) => {
                        const id = String(entity.id);
                        return (
                            <Show when={props.CustomCard}>
                                {props.CustomCard && <props.CustomCard
                                    entity={entity}
                                    isSelected={!!props.rowSelection()[id]}
                                    onSelect={(checked: boolean) => {
                                        const next = { ...props.rowSelection() };
                                        if (checked) next[id] = true;
                                        else delete next[id];
                                        props.onRowSelectionChange(next);
                                    }}
                                    onDelete={props.onDelete}
                                    onRestore={props.onRestore}
                                />}
                            </Show>
                        );
                    }}
                </For>

                <div ref={sentinelRef} class="h-2" />

                <Show when={isFetchingNextPage()}>
                    <div class="flex justify-center py-4">
                        <div class="size-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    </div>
                </Show>

                <Show when={!hasNextPage()}>
                    <p class="text-center text-xs text-muted py-4">
                        {totalLoaded()} registros en total
                    </p>
                </Show>
            </Show>
        </div>
    );
};
