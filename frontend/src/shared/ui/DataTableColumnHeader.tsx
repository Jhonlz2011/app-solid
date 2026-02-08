import { Show, JSX } from 'solid-js';
import type { Column } from '@tanstack/solid-table';
import { DropdownMenu } from './DropdownMenu';
import { ArrowUpIcon, ArrowDownIcon, EyeOffIcon, PinIcon, PinOffIcon, ChevronsUpDownIcon } from './icons';
import { cn } from '../lib/utils';

// ============================================================================
// DataTableColumnHeader - Advanced column header for TanStack Table
// Features: Sorting (ASC/DESC), Hide column, Pin left/right
// ============================================================================

interface DataTableColumnHeaderProps<TData, TValue> {
    column: Column<TData, TValue>;
    title: string;
    class?: string;
}

export function DataTableColumnHeader<TData, TValue>(
    props: DataTableColumnHeaderProps<TData, TValue>
): JSX.Element {
    const canSort = () => props.column.getCanSort();
    const canHide = () => props.column.getCanHide();
    const canPin = () => props.column.getCanPin();
    const isSorted = () => props.column.getIsSorted();
    const isPinned = () => props.column.getIsPinned();

    // If column has no interactive features, just render title
    if (!canSort() && !canHide() && !canPin()) {
        return <span class={props.class}>{props.title}</span>;
    }

    return (
        <div class="flex items-center gap-1">
            <DropdownMenu placement="bottom-start" gutter={4}>
                <DropdownMenu.Trigger
                    class={cn(
                        'flex items-center gap-1 -ml-2 px-2 py-1 rounded-lg',
                        'hover:bg-dropdown-hover data-[expanded]:bg-dropdown-hover',
                        'transition-colors duration-150 cursor-pointer',
                        props.class
                    )}
                >
                    <span>{props.title}</span>
                    <Show when={isSorted() === 'asc'}>
                        <ArrowUpIcon class="size-3.5 text-primary" />
                    </Show>
                    <Show when={isSorted() === 'desc'}>
                        <ArrowDownIcon class="size-3.5 text-primary" />
                    </Show>
                    <Show when={!isSorted() && canSort()}>
                        <ChevronsUpDownIcon class="size-3.5 text-muted opacity-50" />
                    </Show>
                </DropdownMenu.Trigger>

                <DropdownMenu.Content class="min-w-[170px] space-y-1">
                    {/* Sorting options - toggleable */}
                    <Show when={canSort()}>
                        <DropdownMenu.Item
                            onSelect={() => {
                                if (isSorted() === 'asc') {
                                    props.column.clearSorting();
                                } else {
                                    props.column.toggleSorting(false);
                                }
                            }}
                            class={cn(
                                'justify-between',
                                isSorted() === 'asc' && 'bg-primary/10 text-primary'
                            )}
                        >
                            <span class="flex items-center gap-2">
                                <ArrowUpIcon class={cn('size-4', isSorted() === 'asc' ? 'text-primary' : 'text-muted')} />
                                <span>Ascendente</span>
                            </span>
                            <Show when={isSorted() === 'asc'}>
                                <span class="size-1.5 rounded-full bg-primary" />
                            </Show>
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                            onSelect={() => {
                                if (isSorted() === 'desc') {
                                    props.column.clearSorting();
                                } else {
                                    props.column.toggleSorting(true);
                                }
                            }}
                            class={cn(
                                'justify-between',
                                isSorted() === 'desc' && 'bg-primary/10 text-primary'
                            )}
                        >
                            <span class="flex items-center gap-2">
                                <ArrowDownIcon class={cn('size-4', isSorted() === 'desc' ? 'text-primary' : 'text-muted')} />
                                <span>Descendente</span>
                            </span>
                            <Show when={isSorted() === 'desc'}>
                                <span class="size-1.5 rounded-full bg-primary" />
                            </Show>
                        </DropdownMenu.Item>
                    </Show>

                    {/* Separator before hide */}
                    <Show when={canSort() && canHide()}>
                        <DropdownMenu.Separator />
                    </Show>

                    {/* Hide option */}
                    <Show when={canHide()}>
                        <DropdownMenu.Item onSelect={() => props.column.toggleVisibility(false)}>
                            <EyeOffIcon class="size-4 text-muted" />
                            <span>Ocultar</span>
                        </DropdownMenu.Item>
                    </Show>

                    {/* Separator before pinning */}
                    <Show when={(canSort() || canHide()) && canPin()}>
                        <DropdownMenu.Separator />
                    </Show>

                    {/* Pinning options */}
                    <Show when={canPin()}>
                        <DropdownMenu.Item
                            onSelect={() => props.column.pin(isPinned() === 'left' ? false : 'left')}
                        >
                            <Show when={isPinned() === 'left'} fallback={<PinIcon class="size-4 text-muted rotate-45" />}>
                                <PinOffIcon class="size-4 text-muted" />
                            </Show>
                            <span>{isPinned() === 'left' ? 'Desfijar' : 'Fijar izquierda'}</span>
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                            onSelect={() => props.column.pin(isPinned() === 'right' ? false : 'right')}
                        >
                            <Show when={isPinned() === 'right'} fallback={<PinIcon class="size-4 text-muted -rotate-45" />}>
                                <PinOffIcon class="size-4 text-muted" />
                            </Show>
                            <span>{isPinned() === 'right' ? 'Desfijar' : 'Fijar derecha'}</span>
                        </DropdownMenu.Item>
                    </Show>
                </DropdownMenu.Content>
            </DropdownMenu>

            {/* Quick unpin button - shows when column is pinned */}
            <Show when={isPinned()}>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        props.column.pin(false);
                    }}
                    class={cn(
                        'p-1 rounded-md',
                        'text-muted hover:text-primary hover:bg-dropdown-hover',
                        'transition-colors duration-150'
                    )}
                    title="Desfijar columna"
                >
                    <PinOffIcon class="size-3.5" />
                </button>
            </Show>
        </div>
    );
}

export default DataTableColumnHeader;
