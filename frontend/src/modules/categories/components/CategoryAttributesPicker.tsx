/**
 * CategoryAttributesPicker — Multi-select + DnD list for category attributes.
 *
 * Two-part UI:
 * 1. AttributeSelect (Kobalte multi-select combobox) — for adding/removing attributes
 * 2. Sortable DnD list — for reordering and toggling "required"
 *
 * Both parts share the same reactive source: the `value` prop (CategoryAttributeEntry[]).
 */
import { Component, For, Show, createMemo } from 'solid-js';
import {
    DragDropProvider,
    DragDropSensors,
    SortableProvider,
    createSortable,
    closestCenter,
    transformStyle,
    DragOverlay,
    type DragEvent,
} from '@thisbeyond/solid-dnd';
import { type AttributeItem } from '@modules/attributes/data/attributes.api';
import { useAttributeList } from '@modules/attributes/data/attributes.queries';
import { ATTRIBUTE_TYPE_LABELS } from '@modules/attributes/data/attributes.constants';
import type { CategoryAttributeEntry } from '@app/schema/frontend';
import { AttributeSelect } from '@shared/ui/selectors/AttributeSelect';
import Checkbox from '@shared/ui/Checkbox';
import { Badge } from '@shared/ui/Badge';
import { CloseIcon, GripVerticalIcon } from '@shared/ui/icons';

interface CategoryAttributesPickerProps {
    value: CategoryAttributeEntry[];
    onChange: (value: CategoryAttributeEntry[]) => void;
    onCreateNew?: () => void;
}

// ── Sortable Row Component ────────────────────────────────────────────
const SortableAttributeRow: Component<{
    attributeDefId: number;
    item: () => CategoryAttributeEntry;
    def: () => AttributeItem | undefined;
    index: number;
    onToggleRequired: (id: number) => void;
    onRemove: (id: number) => void;
}> = (props) => {
    const sortable = createSortable(props.attributeDefId);

    return (
        <div
            ref={sortable.ref}
            class="flex items-center gap-2 px-3 py-2.5 bg-card hover:bg-surface/30 transition-all group"
            classList={{
                'opacity-25': sortable.isActiveDraggable,
                'transition-transform': !!sortable.isActiveDroppable,
            }}
            style={transformStyle(sortable.transform)}
        >
            {/* Drag handle */}
            <button
                type="button"
                class="text-muted/40 hover:text-muted cursor-grab active:cursor-grabbing shrink-0 touch-none"
                {...sortable.dragActivators}
            >
                <GripVerticalIcon />
            </button>
            <span class="text-xs font-mono text-muted w-5 text-center tabular-nums select-none">
                {props.index + 1}
            </span>

            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                    <span class="text-sm font-medium text-text truncate">
                        {props.def()?.label ?? `ID ${props.attributeDefId}`}
                    </span>
                    <Badge variant="primary" class="text-[10px] px-1.5 py-0">
                        {ATTRIBUTE_TYPE_LABELS[props.def()?.type!] ?? props.def()?.type}
                    </Badge>
                </div>
                <span class="text-[11px] text-muted font-mono">{props.def()?.key}</span>
            </div>

            {/* Required toggle */}
            <Checkbox
                checked={props.item().required}
                onChange={() => props.onToggleRequired(props.attributeDefId)}
                class="shrink-0"
            >
                <span class="text-xs text-muted">Requerido</span>
            </Checkbox>

            {/* Remove button */}
            <button
                type="button"
                class="size-7 flex items-center justify-center rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors opacity-0 group-hover:opacity-100"
                onClick={() => props.onRemove(props.attributeDefId)}
            >
                <CloseIcon class="size-3.5" />
            </button>
        </div>
    );
};

// ── Main Component ────────────────────────────────────────────────────
const CategoryAttributesPicker: Component<CategoryAttributesPickerProps> = (props) => {
    const attrsQuery = useAttributeList();

    // Assigned attribute IDs for the selector
    const assignedIds = createMemo(() => props.value.map(a => a.attributeDefId));

    // Map for quick lookup of assigned items + definitions
    const assignedWithDefMap = createMemo(() => {
        const allAttrs = (attrsQuery.data ?? []) as AttributeItem[];
        const defMap = new Map(allAttrs.map(a => [a.id, a]));
        const map = new Map<number, { item: CategoryAttributeEntry; def?: AttributeItem }>();
        props.value.forEach(a => {
            map.set(a.attributeDefId, { item: a, def: defMap.get(a.attributeDefId) });
        });
        return map;
    });

    // Sorted IDs for DnD — primitives for efficient <For> tracking
    const sortedIds = createMemo(() => {
        return [...props.value]
            .sort((a, b) => a.order - b.order)
            .map(a => a.attributeDefId);
    });

    // ── Sync handler: reconcile selector changes with existing entries ──
    const syncFromSelector = (newIds: number[]) => {
        const existingMap = new Map(props.value.map(a => [a.attributeDefId, a]));
        const newIdSet = new Set(newIds);
        const maxOrder = props.value.reduce((max, a) => Math.max(max, a.order), -1);

        // Preserve existing entries, add new ones, remove deselected
        let nextOrder = maxOrder + 1;
        const result: CategoryAttributeEntry[] = [];

        // Keep existing entries that are still selected (preserve order, required, specificOptions)
        for (const entry of props.value) {
            if (newIdSet.has(entry.attributeDefId)) {
                result.push(entry);
            }
        }

        // Add newly selected entries
        for (const id of newIds) {
            if (!existingMap.has(id)) {
                result.push({
                    attributeDefId: id,
                    required: false,
                    order: nextOrder++,
                    specificOptions: null as any,
                });
            }
        }

        props.onChange(result);
    };

    const removeAttribute = (attrId: number) => {
        props.onChange(props.value.filter(a => a.attributeDefId !== attrId));
    };

    const toggleRequired = (attrId: number) => {
        props.onChange(props.value.map(a =>
            a.attributeDefId === attrId ? { ...a, required: !a.required } : a
        ));
    };

    // DnD reorder handler
    const onDragEnd = (event: DragEvent) => {
        const { draggable, droppable } = event;
        if (!draggable || !droppable) return;

        const fromId = draggable.id as number;
        const toId = droppable.id as number;
        if (fromId === toId) return;

        const sortedArgs = [...props.value].sort((a, b) => a.order - b.order);
        const fromIndex = sortedArgs.findIndex(a => a.attributeDefId === fromId);
        const toIndex = sortedArgs.findIndex(a => a.attributeDefId === toId);
        if (fromIndex < 0 || toIndex < 0) return;

        const [item] = sortedArgs.splice(fromIndex, 1);
        sortedArgs.splice(toIndex, 0, item);

        // Recalculate order values
        props.onChange(sortedArgs.map((a, i) => ({
            attributeDefId: a.attributeDefId,
            required: a.required,
            order: i,
            specificOptions: a.specificOptions,
        })));
    };

    return (
        <div class="space-y-3">
            {/* Multi-select combobox */}
            <AttributeSelect
                value={assignedIds()}
                onChange={syncFromSelector}
                onCreateNew={props.onCreateNew}
                placeholder="Buscar y agregar atributos..."
            />

            {/* Assigned Attributes List with DnD */}
            <Show when={assignedWithDefMap().size > 0}>
                <DragDropProvider onDragEnd={onDragEnd} collisionDetector={closestCenter}>
                    <DragDropSensors />
                    <div class="border border-border rounded-xl overflow-hidden divide-y divide-border/50">
                        <SortableProvider ids={sortedIds()}>
                            <For each={sortedIds()}>
                                {(id, index) => (
                                    <Show when={assignedWithDefMap().get(id)}>
                                        {(mapped) => (
                                            <SortableAttributeRow
                                                attributeDefId={id}
                                                item={() => mapped().item}
                                                def={() => mapped().def}
                                                index={index()}
                                                onToggleRequired={toggleRequired}
                                                onRemove={removeAttribute}
                                            />
                                        )}
                                    </Show>
                                )}
                            </For>
                        </SortableProvider>
                    </div>
                    <DragOverlay>
                        {(draggable) => {
                            const mapped = assignedWithDefMap().get(draggable?.id as number);
                            if (!mapped) return null;
                            const itemDef = mapped.def;
                            return (
                                <div class="flex items-center gap-2 px-3 py-2.5 bg-card border border-primary/30 rounded-xl shadow-xl">
                                    <span class="text-sm font-medium text-text">{itemDef?.label ?? `ID ${draggable?.id}`}</span>
                                    <Badge variant="primary" class="text-[10px] px-1.5 py-0">
                                        {ATTRIBUTE_TYPE_LABELS[itemDef?.type as keyof typeof ATTRIBUTE_TYPE_LABELS] ?? itemDef?.type}
                                    </Badge>
                                </div>
                            );
                        }}
                    </DragOverlay>
                </DragDropProvider>
            </Show>
        </div>
    );
};

export default CategoryAttributesPicker;
