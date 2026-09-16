import { Component, Show } from 'solid-js';
import { createSortable, transformStyle } from '@thisbeyond/solid-dnd';
import type { ProductVariantFormData } from '@app/schema/frontend';
import { TableRow, TableCell } from '@shared/ui/table';
import Checkbox from '@form/Checkbox';
import TextField from '@form/TextField';
import Button from '@form/Button';
import { Badge } from '@display/Badge';
import { GripVerticalIcon } from '@icons/GripVerticalIcon';
import { EditIcon } from '@icons/EditIcon';
import { cn } from '@shared/lib/utils';

export interface VariantChildRowProps {
    variant: ProductVariantFormData;
    variantIndex: number;
    sortableId: string;
    isSelected: boolean;
    primaryAxisName: string;
    defaultPrice?: number | null;
    onToggleSelect: (index: number) => void;
    onUpdatePrice: (index: number, price: number | null) => void;
    onOpenDetailModal: (index: number) => void;
}

export const VariantChildRow: Component<VariantChildRowProps> = (props) => {
    const sortable = createSortable(props.sortableId);

    // Compute secondary option attributes string (excluding primary axis key)
    const secondaryDisplay = () => {
        const attrs = props.variant.variant_attributes;
        if (!attrs || Object.keys(attrs).length === 0) {
            return props.variant.variant_name || 'Variante Estándar';
        }

        const entries = Object.entries(attrs).filter(
            ([key]) => key.toLowerCase() !== props.primaryAxisName.toLowerCase()
        );

        if (entries.length === 0) {
            return props.variant.variant_name || 'Estándar';
        }

        return entries.map(([key, val]) => `${key}: ${String(val)}`).join(' • ');
    };

    return (
        <TableRow
            ref={sortable.ref}
            style={transformStyle(sortable.transform)}
            class={cn(
                'group/row transition-colors border-b border-border/40 hover:bg-surface/30',
                props.isSelected && 'bg-primary/5 hover:bg-primary/10',
                sortable.isActiveDraggable && 'opacity-25 z-30'
            )}
        >
            {/* Drag Handle Container */}
            <TableCell class="w-10 pl-6 text-center">
                <div
                    {...sortable.dragActivators}
                    class="p-1 text-muted/30 group-hover/row:text-muted cursor-grab active:cursor-grabbing rounded hover:bg-surface transition-colors inline-flex items-center justify-center touch-none select-none"
                    title="Arrastrar para reordenar variante"
                >
                    <GripVerticalIcon class="size-3.5" />
                </div>
            </TableCell>

            {/* Selection Checkbox */}
            <TableCell class="w-10 text-center">
                <Checkbox
                    checked={props.isSelected}
                    onChange={() => props.onToggleSelect(props.variantIndex)}
                />
            </TableCell>

            {/* Secondary Options / Name & Details */}
            <TableCell>
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-sm font-medium text-text">
                        {secondaryDisplay()}
                    </span>
                    <Show when={props.variant.is_default}>
                        <Badge variant="primary" size="sm">
                            Principal
                        </Badge>
                    </Show>
                    <Show when={props.variant.barcode}>
                        <span
                            class="text-[11px] font-mono text-muted/80 truncate max-w-36 px-1.5 py-0.5 rounded bg-surface/60 border border-border/30"
                            title={`Código: ${props.variant.barcode}`}
                        >
                            {props.variant.barcode}
                        </span>
                    </Show>
                </div>
            </TableCell>

            {/* SKU */}
            <TableCell class="w-44">
                <span class="font-mono text-xs text-muted font-medium truncate block">
                    {props.variant.sku || '—'}
                </span>
            </TableCell>

            {/* Quick Edit Price */}
            <TableCell class="w-36">
                <TextField.Root
                    value={props.variant.unit_price ?? ''}
                    onChange={(val) => {
                        const n = val === '' || val == null ? null : parseFloat(val);
                        props.onUpdatePrice(props.variantIndex, n != null && !isNaN(n) ? n : null);
                    }}
                    class="w-28"
                >
                    <TextField.NumericInput
                        prefix="$"
                        allowDecimal={true}
                        step={0.01}
                        min={0}
                        placeholder={props.defaultPrice != null ? `Hereda ($${props.defaultPrice})` : '0.00'}
                        class="h-7 text-xs font-mono py-1 px-2"
                    />
                </TextField.Root>
            </TableCell>

            {/* Status Badge */}
            <TableCell class="w-24 text-center">
                <Badge
                    variant={props.variant.is_active ? 'success' : 'danger'}
                    size="sm"
                >
                    {props.variant.is_active ? 'Activo' : 'Inactivo'}
                </Badge>
            </TableCell>

            {/* Detail Edit Action Button */}
            <TableCell class="w-16 text-right pr-4">
                <Button
                    variant="ghost"
                    size="icon_xs"
                    onClick={() => props.onOpenDetailModal(props.variantIndex)}
                    title="Editar detalles de variante"
                    class="p-1 text-muted hover:text-primary transition-colors inline-flex items-center justify-center"
                >
                    <EditIcon class="size-4" />
                </Button>
            </TableCell>
        </TableRow>
    );
};

export default VariantChildRow;
