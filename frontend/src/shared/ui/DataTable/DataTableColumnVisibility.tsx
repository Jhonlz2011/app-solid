/**
 * DataTableColumnVisibility — Shared dropdown for column visibility & pinning.
 *
 * Encapsulates the full Column Configuration UI:
 * - Per-column visibility toggle (Switch)
 * - Per-column pin left/right
 * - "Show All" / "Hide All" bulk actions
 * - "Reset Pinning" when custom pins are active
 *
 * Extracted from SuppliersPage and UsersRolesPage to eliminate ~200 lines of duplication.
 */
import { Component, For, Show } from 'solid-js';
import type { Table } from '@tanstack/solid-table';
import { DropdownMenu } from '@shared/ui/DropdownMenu';
import Switch from '@shared/ui/Switch';
import Button from '@shared/ui/Button';
import { ColumnsIcon, EyeIcon, EyeOffIcon, PinIcon, PinOffIcon } from '@shared/ui/icons';

interface DataTableColumnVisibilityProps {
    /** The TanStack Table instance */
    table: Table<any> | undefined;
}

/** Reserved column IDs that should not be configurable */
const RESERVED = new Set(['select', 'actions']);

export const DataTableColumnVisibility: Component<DataTableColumnVisibilityProps> = (props) => {
    const configurableColumns = () => {
        const table = props.table;
        if (!table) return [];
        return table.getAllLeafColumns().filter(
            col => !RESERVED.has(col.id) && (col.getCanHide() || col.getCanPin())
        );
    };

    const hasCustomPinnedColumns = () => {
        const table = props.table;
        if (!table) return false;
        return table.getAllLeafColumns().some(
            col => col.getIsPinned() && !RESERVED.has(col.id)
        );
    };

    return (
        <DropdownMenu placement="bottom-end">
            <DropdownMenu.Trigger class="h-9.5 px-4" variant="ghost">
                <ColumnsIcon />
                <span class="hidden sm:inline">Columnas</span>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content class="min-w-[280px] p-2">
                <DropdownMenu.Label class="text-xs font-semibold text-muted tracking-wider mb-2">
                    Visibilidad de columnas
                </DropdownMenu.Label>

                <div class="max-h-[320px] overflow-y-auto">
                    <For each={configurableColumns()}>
                        {(column) => {
                            const isPinned = () => column.getIsPinned();
                            const canPin = () => column.getCanPin();
                            const canHide = () => column.getCanHide();
                            const isVisible = () => column.getIsVisible();
                            const title = () => (column.columnDef.meta as { title?: string })?.title ?? column.id;

                            return (
                                <div class="flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-surface-2 transition-colors">
                                    <span class="flex-1 text-sm text-text truncate" title={title()}>
                                        {title()}
                                    </span>

                                    <Show when={canPin()}>
                                        <div class="flex items-center gap-0.5 bg-surface rounded-md p-0.5">
                                            <button
                                                onClick={() => column.pin(isPinned() === 'left' ? false : 'left')}
                                                class={`p-1 rounded transition-colors ${isPinned() === 'left'
                                                    ? 'bg-primary text-white'
                                                    : 'text-muted hover:text-text hover:bg-surface-2'
                                                    }`}
                                                title={isPinned() === 'left' ? 'Desfijar' : 'Fijar izquierda'}
                                                aria-label={isPinned() === 'left' ? `Desfijar` : `Fijar columna a la izquierda`}
                                            >
                                                <PinIcon class="size-3.5 rotate-45" />
                                            </button>
                                            <button
                                                onClick={() => column.pin(isPinned() === 'right' ? false : 'right')}
                                                class={`p-1 rounded transition-colors ${isPinned() === 'right'
                                                    ? 'bg-primary text-white'
                                                    : 'text-muted hover:text-text hover:bg-surface-2'
                                                    }`}
                                                title={isPinned() === 'right' ? 'Desfijar' : 'Fijar derecha'}
                                                aria-label={isPinned() === 'right' ? `Desfijar` : `Fijar columna a la derecha`}
                                            >
                                                <PinIcon class="size-3.5 -rotate-45" />
                                            </button>
                                        </div>
                                    </Show>

                                    <Show when={canHide()}>
                                        <Switch
                                            checked={isVisible()}
                                            onChange={column.toggleVisibility}
                                            aria-label={`Mostrar/ocultar ${title()}`}
                                        />
                                    </Show>
                                </div>
                            );
                        }}
                    </For>
                </div>

                <DropdownMenu.Separator class="my-2" />
                <div class="flex flex-col gap-2 p-1">
                    <div class="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            class="flex-1 text-xs h-8 px-2"
                            onClick={() => props.table?.getAllLeafColumns().forEach(col => col.getCanHide() && col.toggleVisibility(true))}
                            icon={<EyeIcon class="size-3.5" />}
                        >
                            Mostrar todo
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            class="flex-1 text-xs h-8 px-2"
                            onClick={() => props.table?.getAllLeafColumns().forEach(col => col.getCanHide() && col.toggleVisibility(false))}
                            icon={<EyeOffIcon class="size-3.5" />}
                        >
                            Ocultar todo
                        </Button>
                    </div>
                    <Show when={hasCustomPinnedColumns()}>
                        <Button
                            variant="ghost"
                            size="sm"
                            class="w-full justify-start text-xs h-8 font-normal text-muted hover:text-primary px-2"
                            onClick={() => props.table?.getAllLeafColumns().forEach(col => {
                                if (!RESERVED.has(col.id)) col.pin(false);
                            })}
                            icon={<PinOffIcon class="size-3.5" />}
                        >
                            Restablecer fijado
                        </Button>
                    </Show>
                </div>
            </DropdownMenu.Content>
        </DropdownMenu>
    );
};
