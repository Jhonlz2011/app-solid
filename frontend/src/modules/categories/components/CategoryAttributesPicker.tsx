/**
 * CategoryAttributesPicker — Multi-select to assign attributes to a category.
 * Displays assigned attributes as a sortable DnD list with required toggle.
 * Allows adding from available attribute_definitions.
 *
 * Uses @thisbeyond/solid-dnd for intuitive drag-and-drop reordering.
 */
import { Component, For, Show, createSignal, createMemo } from 'solid-js';
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
import { type AttributeDef } from '@modules/settings/data/attributes.api';
import { useAttributes } from '@modules/settings/data/attributes.queries'
import { ATTRIBUTE_TYPE_LABELS } from '@modules/settings/data/attributes.constants';
import type { CategoryAttributeEntry } from '@app/schema/frontend';
import Button from '@shared/ui/Button';
import Checkbox from '@shared/ui/Checkbox';
import { Badge } from '@shared/ui/Badge';
import { PlusIcon, CloseIcon, GripVerticalIcon } from '@shared/ui/icons';

interface CategoryAttributesPickerProps {
    value: CategoryAttributeEntry[];
    onChange: (value: CategoryAttributeEntry[]) => void;
}

// ── Sortable Row Component ────────────────────────────────────────────
const SortableAttributeRow: Component<{
    attributeDefId: number;
    // We pass functions/memos to keep it reactive without re-mounting
    item: () => CategoryAttributeEntry;
    def: () => AttributeDef | undefined;
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
    const attrsQuery = useAttributes();
    const [showPicker, setShowPicker] = createSignal(false);

    // Assigned attribute IDs set for quick lookup
    const assignedIds = createMemo(() => new Set(props.value.map(a => a.attributeDefId)));

    // Available (unassigned, active) attributes
    const available = createMemo(() => {
        const all = (attrsQuery.data ?? []) as AttributeDef[];
        return all.filter(a => a.is_active && !assignedIds().has(a.id));
    });

    // Sorted assigned attributes with their definitions
    // Used strictly for looking up references in O(1) inside children
    const assignedWithDefMap = createMemo(() => {
        const allAttrs = (attrsQuery.data ?? []) as AttributeDef[];
        const defMap = new Map(allAttrs.map(a => [a.id, a]));
        const map = new Map<number, { item: CategoryAttributeEntry; def?: AttributeDef }>();
        props.value.forEach(a => {
            map.set(a.attributeDefId, { item: a, def: defMap.get(a.attributeDefId) });
        });
        return map;
    });

    // Instead of mapping objects, we sort the primitive IDs. 
    // SolidJS <For> tracks primitives perfectly and won't remount DOM nodes!
    const sortedIds = createMemo(() => {
        return [...props.value]
            .sort((a, b) => a.order - b.order)
            .map(a => a.attributeDefId);
    });

    // Sortable IDs for DnD provider
    const sortableIds = sortedIds;

    const addAttribute = (attrId: number) => {
        const maxOrder = props.value.reduce((max, a) => Math.max(max, a.order), -1);
        props.onChange([
            ...props.value,
            { attributeDefId: attrId, required: false, order: maxOrder + 1, specificOptions: null },
        ]);
        if (available().length <= 1) setShowPicker(false);
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

        // Move item
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
            {/* Assigned Attributes List with DnD */}
            <Show
                when={assignedWithDefMap().size > 0}
                fallback={
                    <div class="text-center py-6 bg-surface/30 rounded-xl border border-dashed border-border">
                        <p class="text-sm text-muted">No hay atributos asignados.</p>
                        <p class="text-xs text-muted mt-1">Agrega atributos para definir los campos de los productos en esta categoría.</p>
                    </div>
                }
            >
                <DragDropProvider onDragEnd={onDragEnd} collisionDetector={closestCenter}>
                    <DragDropSensors />
                    <div class="border border-border rounded-xl overflow-hidden divide-y divide-border/50">
                        <SortableProvider ids={sortableIds()}>
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

            {/* Add Attribute Picker */}
            <Show
                when={showPicker()}
                fallback={
                    <Show when={available().length > 0}>
                        <Button type="button" variant="outline" size="sm" onClick={() => setShowPicker(true)}>
                            <PlusIcon /> Agregar atributo
                        </Button>
                    </Show>
                }
            >
                <div class="border border-primary/30 rounded-xl p-3 bg-primary/5 space-y-2">
                    <div class="flex items-center justify-between">
                        <span class="text-xs font-semibold text-primary uppercase tracking-wider">Atributos disponibles</span>
                        <button
                            type="button"
                            class="text-muted hover:text-text text-xs"
                            onClick={() => setShowPicker(false)}
                        >
                            Cerrar
                        </button>
                    </div>
                    <Show
                        when={available().length > 0}
                        fallback={<p class="text-xs text-muted py-2">Todos los atributos ya están asignados.</p>}
                    >
                        <div class="flex flex-wrap gap-2">
                            <For each={available()}>
                                {(attr) => (
                                    <button
                                        type="button"
                                        class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded-lg text-sm hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer"
                                        onClick={() => addAttribute(attr.id)}
                                    >
                                        <PlusIcon class="size-3.5" />
                                        <span>{attr.label}</span>
                                        <Badge variant="primary" class="text-[10px] px-1 py-0 ml-1">
                                            {ATTRIBUTE_TYPE_LABELS[attr.type] ?? attr.type}
                                        </Badge>
                                    </button>
                                )}
                            </For>
                        </div>
                    </Show>
                </div>
            </Show>
        </div>
    );
};

export default CategoryAttributesPicker;
