import { Component, Show } from 'solid-js';
import { createSortable, transformStyle } from '@thisbeyond/solid-dnd';
import { TableRow, TableCell } from '@shared/ui/table';
import Checkbox from '@form/Checkbox';
import Button from '@form/Button';
import { CounterBadge } from '@display/Badge';
import { GripVerticalIcon } from '@icons/GripVerticalIcon';
import { ChevronRightIcon } from '@icons/ChevronRightIcon';
import { ChevronDownIcon } from '@icons/ChevronDownIcon';
import { TagIcon } from '@icons/TagIcon';
import { WarehouseIcon } from '@icons/WarehouseIcon';
import { cn } from '@shared/lib/utils';

export interface VariantGroupRowProps {
    groupKey: string;
    groupValue: string;
    primaryAxisName: string;
    sortableGroupId: string;
    childCount: number;
    priceSummary: string;
    stockSummary?: string;
    isExpanded: boolean;
    isGroupChecked: boolean;
    isGroupIndeterminate: boolean;
    onToggleExpand: () => void;
    onToggleGroupSelection: () => void;
}

export const VariantGroupRow: Component<VariantGroupRowProps> = (props) => {
    const sortable = createSortable(props.sortableGroupId);

    return (
        <TableRow
            ref={sortable.ref}
            style={transformStyle(sortable.transform)}
            class={cn(
                'group/group-row bg-card-alt/80 hover:bg-card-alt border-y border-border/70 select-none transition-colors',
                sortable.isActiveDraggable && 'opacity-25 z-30'
            )}
        >
            <TableCell colSpan={7} class="py-2.5 px-3">
                <div class="flex items-center gap-3">
                    {/* Group Drag Handle */}
                    <div
                        {...sortable.dragActivators}
                        class="p-1 text-muted/40 hover:text-muted cursor-grab active:cursor-grabbing rounded hover:bg-surface transition-colors inline-flex items-center justify-center touch-none select-none"
                        title="Arrastrar para reordenar grupo"
                    >
                        <GripVerticalIcon class="size-4" />
                    </div>

                    {/* Group Indeterminate Checkbox */}
                    <Checkbox
                        checked={props.isGroupChecked}
                        indeterminate={props.isGroupIndeterminate}
                        onChange={props.onToggleGroupSelection}
                    />

                    {/* Expand/Collapse Toggle Button */}
                    <Button
                        variant="ghost"
                        size="icon_xs"
                        onClick={props.onToggleExpand}
                        class="p-1 text-muted hover:text-text rounded-md transition-colors inline-flex items-center justify-center"
                        title={props.isExpanded ? 'Colapsar grupo' : 'Expandir grupo'}
                    >
                        <Show
                            when={props.isExpanded}
                            fallback={<ChevronRightIcon class="size-4" />}
                        >
                            <ChevronDownIcon class="size-4" />
                        </Show>
                    </Button>

                    {/* Primary Axis Label & Group Value */}
                    <div
                        class="flex items-center gap-2 cursor-pointer py-0.5"
                        onClick={props.onToggleExpand}
                    >
                        <span class="text-xs font-medium text-muted uppercase tracking-wider">
                            {props.primaryAxisName}:
                        </span>
                        <span class="text-sm font-bold text-text">
                            {props.groupValue}
                        </span>
                    </div>

                    {/* Child Variants Count Badge */}
                    <CounterBadge
                        count={props.childCount}
                        variant="tab-pill"
                    />

                    {/* Spacer */}
                    <div class="flex-1" />

                    {/* Price Range Summary */}
                    <div class="flex items-center gap-1.5 text-xs text-muted font-mono bg-surface/50 px-2.5 py-1 rounded-lg border border-border/30">
                        <TagIcon class="size-3.5 text-muted/70" />
                        <span>{props.priceSummary}</span>
                    </div>

                    {/* Stock Summary (if available) */}
                    <Show when={props.stockSummary}>
                        <div class="flex items-center gap-1.5 text-xs text-muted bg-surface/50 px-2.5 py-1 rounded-lg border border-border/30">
                            <WarehouseIcon class="size-3.5 text-muted/70" />
                            <span>{props.stockSummary}</span>
                        </div>
                    </Show>
                </div>
            </TableCell>
        </TableRow>
    );
};

export default VariantGroupRow;
