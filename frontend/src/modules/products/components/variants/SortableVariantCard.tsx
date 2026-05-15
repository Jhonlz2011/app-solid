/**
 * SortableVariantCard — DnD-sortable variant card with form-integrated VariantFields.
 */
import { Component, createMemo } from 'solid-js';
import { createSortable, transformStyle } from '@thisbeyond/solid-dnd';
import Button from '@shared/ui/Button';
import { TrashIcon, GripVerticalIcon } from '@shared/ui/icons';
import VariantFields from './VariantFields';

export interface SortableVariantCardProps {
    form: any;
    /** Real index in the variants array (1-based for additional variants) */
    variantIndex: number;
    /** Display index (1, 2, 3...) for the user */
    displayIndex: number;
    onRemove: () => void;
    hasDimensionalTracking: boolean;
    hasAttemptedSubmit?: () => boolean;
}

const SortableVariantCard: Component<SortableVariantCardProps> = (props) => {
    const basePath = () => `variants[${props.variantIndex}]`;

    // Stable ID for DnD
    const stableId = createMemo(() => {
        const v = props.form.getFieldValue(`variants` as any)?.[props.variantIndex];
        return v?.id ?? `new-${v?.sort_order ?? props.displayIndex}`;
    });
    const sortable = createSortable(stableId());

    // Read variant name/sku reactively for header
    const variantLabel = () => {
        const v = props.form.getFieldValue(`variants` as any)?.[props.variantIndex];
        return v?.variant_name || v?.sku || 'Nueva Variante';
    };

    return (
        <div
            ref={sortable.ref}
            class="border border-border rounded-2xl p-5 space-y-4 bg-card/50 relative group hover:border-primary/30 transition-all"
            classList={{ 'opacity-25 scale-[0.98]': sortable.isActiveDraggable }}
            style={transformStyle(sortable.transform)}
        >
            {/* Header */}
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <button
                        type="button"
                        class="text-muted/40 hover:text-muted cursor-grab active:cursor-grabbing shrink-0 touch-none"
                        {...sortable.dragActivators}
                    >
                        <GripVerticalIcon class="size-3.5" />
                    </button>
                    <span class="flex items-center justify-center w-6 h-6 rounded-lg bg-primary/10 text-primary text-xs font-bold">
                        {props.displayIndex}
                    </span>
                    <span class="text-xs font-semibold text-muted uppercase tracking-wider">
                        {variantLabel()}
                    </span>
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon_md"
                    class="text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={props.onRemove}
                >
                    <TrashIcon class="size-4" />
                </Button>
            </div>

            {/* Fields */}
            <VariantFields
                form={props.form}
                basePath={basePath()}
                hasDimensionalTracking={props.hasDimensionalTracking}
                showPrice={true}
                showActiveToggle={true}
                showVariantName={true}
                hasAttemptedSubmit={props.hasAttemptedSubmit}
            />
        </div>
    );
};

export default SortableVariantCard;
