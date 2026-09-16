import {
    Component,
    Show,
    For,
    createMemo,
    createSignal,
    createEffect,
    type Accessor,
} from 'solid-js';
import {
    DragDropProvider,
    DragDropSensors,
    SortableProvider,
    closestCenter,
    type DragEvent,
} from '@thisbeyond/solid-dnd';
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
} from '@shared/ui/table';
import Checkbox from '@form/Checkbox';
import type { ProductVariantFormData, ProductOptionFormData } from '@app/schema/frontend';
import type { CatalogFormApi } from '../catalog-form.types';
import type { WarehouseItem } from '@modules/settings/data/warehouses.api';
import { VariantGroupRow } from './VariantGroupRow';
import { VariantChildRow } from './VariantChildRow';

export interface CategoryAttributeItem {
    key: string;
    label: string;
    type?: string;
    options?: string[];
}

export interface GroupedVariantTableProps {
    form: CatalogFormApi | any;
    primaryAxis: Accessor<string>;
    categoryAttributes?: CategoryAttributeItem[] | Accessor<CategoryAttributeItem[]>;
    warehouses?: WarehouseItem[] | Accessor<WarehouseItem[]>;
    onOpenDetailModal: (variantIndex: number) => void;
    selectedIndices?: Accessor<Set<number>>;
    onToggleSelect?: (variantIndex: number) => void;
    onToggleSelectGroup?: (indices: number[]) => void;
    onToggleSelectAll?: () => void;
    searchQuery?: Accessor<string>;
    defaultPrice?: Accessor<number | null> | number | null;
}

export const GroupedVariantTable: Component<GroupedVariantTableProps> = (props) => {
    // Form store subscription
    const variants = props.form.useStore((s: any) => s.values.variants);

    // Resolved Default Product Price
    const resolvedDefaultPrice = createMemo(() => {
        if (typeof props.defaultPrice === 'function') return props.defaultPrice();
        if (props.defaultPrice !== undefined) return props.defaultPrice;
        const formVal = props.form.getFieldValue('default_unit_price');
        return formVal != null && !isNaN(Number(formVal)) ? Number(formVal) : null;
    });

    // Resolved Primary Option Axis (e.g. "Talla", "Color", etc.)
    const resolvedPrimaryAxis = createMemo(() => {
        const passed = props.primaryAxis();
        if (passed && passed.trim()) return passed.trim();

        // 1. Fallback to product options array in form
        const formOptions = props.form.getFieldValue('options') as ProductOptionFormData[] | undefined;
        if (formOptions && formOptions.length > 0 && formOptions[0]?.name?.trim()) {
            return formOptions[0].name.trim();
        }

        // 2. Fallback to first attribute key in variants
        const currentVariants = (variants() ?? []) as ProductVariantFormData[];
        for (const v of currentVariants) {
            if (v.variant_attributes) {
                const keys = Object.keys(v.variant_attributes);
                if (keys.length > 0 && keys[0]?.trim()) return keys[0].trim();
            }
        }

        return 'Opción';
    });

    // Stable Sortable IDs
    const getVariantSortableId = (v: ProductVariantFormData, idx: number): string => {
        if (v.id != null) return `var-id-${v.id}`;
        if (v.sku && v.sku.trim()) return `var-sku-${v.sku.trim()}-${idx}`;
        return `var-idx-${idx}`;
    };

    const getGroupSortableId = (groupKey: string): string => {
        return `group-${encodeURIComponent(groupKey)}`;
    };

    // Hierarchical Grouping Engine
    const groups = createMemo(() => {
        const all = (variants() ?? []) as ProductVariantFormData[];
        const axis = resolvedPrimaryAxis();
        const query = (props.searchQuery ? props.searchQuery().trim().toLowerCase() : '');

        const groupMap = new Map<
            string,
            {
                groupKey: string;
                groupValue: string;
                sortableGroupId: string;
                primaryAxisName: string;
                items: Array<{
                    variant: ProductVariantFormData;
                    index: number;
                    sortableId: string;
                }>;
            }
        >();

        all.forEach((v, index) => {
            // Apply search query filter if active
            if (query) {
                const skuMatch = v.sku?.toLowerCase().includes(query);
                const nameMatch = v.variant_name?.toLowerCase().includes(query);
                const barcodeMatch = v.barcode?.toLowerCase().includes(query);
                const attrMatch =
                    v.variant_attributes &&
                    Object.values(v.variant_attributes).some((val) =>
                        String(val).toLowerCase().includes(query)
                    );
                if (!skuMatch && !nameMatch && !barcodeMatch && !attrMatch) return;
            }

            // Determine primary axis value
            let primaryVal = '';
            if (v.variant_attributes && v.variant_attributes[axis] !== undefined) {
                primaryVal = String(v.variant_attributes[axis] ?? '').trim();
            } else if (v.variant_attributes) {
                const matchKey = Object.keys(v.variant_attributes).find(
                    (k) => k.toLowerCase() === axis.toLowerCase()
                );
                if (matchKey && v.variant_attributes[matchKey] != null) {
                    primaryVal = String(v.variant_attributes[matchKey]).trim();
                }
            }

            if (!primaryVal && v.variant_name && v.variant_name.includes('/')) {
                const parts = v.variant_name.split('/');
                primaryVal = parts[0]?.trim() || '';
            }

            if (!primaryVal) {
                primaryVal = 'General';
            }

            const groupKey = primaryVal.toLowerCase();
            if (!groupMap.has(groupKey)) {
                groupMap.set(groupKey, {
                    groupKey,
                    groupValue: primaryVal,
                    sortableGroupId: getGroupSortableId(groupKey),
                    primaryAxisName: axis,
                    items: [],
                });
            }

            groupMap.get(groupKey)!.items.push({
                variant: v,
                index,
                sortableId: getVariantSortableId(v, index),
            });
        });

        const defPrice = resolvedDefaultPrice();
        return Array.from(groupMap.values()).map((g) => {
            // Price range summary calculation
            const prices = g.items
                .map((i) => i.variant.unit_price ?? defPrice ?? null)
                .filter((p): p is number => p !== null && !isNaN(p));

            let priceSummary = 'Hereda precio';
            if (prices.length > 0) {
                const minP = Math.min(...prices);
                const maxP = Math.max(...prices);
                priceSummary =
                    minP === maxP
                        ? `$${minP.toFixed(2)}`
                        : `$${minP.toFixed(2)} – $${maxP.toFixed(2)}`;
            } else if (defPrice != null) {
                priceSummary = `$${defPrice.toFixed(2)}`;
            }

            // Stock / content quantity summary
            let stockSummary: string | undefined;
            const totalContent = g.items.reduce(
                (acc, i) => acc + (i.variant.content_quantity || 1),
                0
            );
            if (totalContent > g.items.length) {
                stockSummary = `${totalContent} unids total`;
            }

            return {
                ...g,
                priceSummary,
                stockSummary,
            };
        });
    });

    // Expand / Collapse Reactive State
    const [expandedGroups, setExpandedGroups] = createSignal<Set<string>>(new Set());

    // Auto-expand all groups on initial load or when groups appear
    createEffect(() => {
        const currentGroups = groups();
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            for (const g of currentGroups) {
                if (!prev.has(`collapsed:${g.groupKey}`)) {
                    next.add(g.groupKey);
                }
            }
            return next;
        });
    });

    const isGroupExpanded = (groupKey: string): boolean => {
        return expandedGroups().has(groupKey);
    };

    const toggleGroupExpand = (groupKey: string) => {
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(groupKey)) {
                next.delete(groupKey);
                next.add(`collapsed:${groupKey}`);
            } else {
                next.add(groupKey);
                next.delete(`collapsed:${groupKey}`);
            }
            return next;
        });
    };

    // Selection State Management
    const [internalSelected, setInternalSelected] = createSignal<Set<number>>(new Set());
    const selectedIndices = () =>
        props.selectedIndices ? props.selectedIndices() : internalSelected();

    const handleToggleSelect = (index: number) => {
        if (props.onToggleSelect) {
            props.onToggleSelect(index);
        } else {
            setInternalSelected((prev) => {
                const next = new Set(prev);
                if (next.has(index)) next.delete(index);
                else next.add(index);
                return next;
            });
        }
    };

    const handleToggleSelectGroup = (indices: number[]) => {
        if (props.onToggleSelectGroup) {
            props.onToggleSelectGroup(indices);
        } else {
            setInternalSelected((prev) => {
                const next = new Set(prev);
                const allSelected = indices.length > 0 && indices.every((i) => next.has(i));
                if (allSelected) {
                    indices.forEach((i) => next.delete(i));
                } else {
                    indices.forEach((i) => next.add(i));
                }
                return next;
            });
        }
    };

    const visibleIndices = createMemo(() => {
        const list: number[] = [];
        for (const g of groups()) {
            for (const item of g.items) {
                list.push(item.index);
            }
        }
        return list;
    });

    // Master Checkbox State (Mathematical 3-state evaluation)
    const isMasterChecked = createMemo(() => {
        const indices = visibleIndices();
        const sel = selectedIndices();
        return indices.length > 0 && indices.every((i) => sel.has(i));
    });

    const isMasterIndeterminate = createMemo(() => {
        const indices = visibleIndices();
        const sel = selectedIndices();
        return !isMasterChecked() && indices.some((i) => sel.has(i));
    });

    const handleMasterToggle = () => {
        if (props.onToggleSelectAll) {
            props.onToggleSelectAll();
        } else {
            const indices = visibleIndices();
            setInternalSelected((prev) => {
                const allSelected = indices.length > 0 && indices.every((i) => prev.has(i));
                if (allSelected) {
                    return new Set<number>();
                } else {
                    return new Set<number>(indices);
                }
            });
        }
    };

    // Quick Edit Price Handler
    const handleUpdatePrice = (index: number, newPrice: number | null) => {
        props.form.setFieldValue(`variants[${index}].unit_price`, newPrice);
    };

    // Active Sortable IDs for DnD
    const activeSortableIds = createMemo(() => {
        const ids: string[] = [];
        for (const g of groups()) {
            ids.push(g.sortableGroupId);
            for (const item of g.items) {
                ids.push(item.sortableId);
            }
        }
        return ids;
    });

    // DnD Reordering Handler
    const handleDragEnd = (event: DragEvent) => {
        const { draggable, droppable } = event;
        if (!draggable || !droppable || draggable.id === droppable.id) return;

        const dragId = String(draggable.id);
        const dropId = String(droppable.id);

        const currentVariants = (props.form.getFieldValue('variants') ?? []) as ProductVariantFormData[];

        // Case 1: Reorder child variant rows
        if (dragId.startsWith('var-') && dropId.startsWith('var-')) {
            const fromIdx = currentVariants.findIndex(
                (v, i) => getVariantSortableId(v, i) === dragId
            );
            const toIdx = currentVariants.findIndex(
                (v, i) => getVariantSortableId(v, i) === dropId
            );

            if (fromIdx !== -1 && toIdx !== -1) {
                const reordered = [...currentVariants];
                const [moved] = reordered.splice(fromIdx, 1);
                reordered.splice(toIdx, 0, moved);

                const updated = reordered.map((v, i) => ({
                    ...v,
                    sort_order: i + 1,
                }));

                props.form.setFieldValue('variants', updated);
            }
            return;
        }

        // Case 2: Reorder entire groups
        if (dragId.startsWith('group-') && dropId.startsWith('group-')) {
            const currentGroups = groups();
            const fromGroupIdx = currentGroups.findIndex((g) => g.sortableGroupId === dragId);
            const toGroupIdx = currentGroups.findIndex((g) => g.sortableGroupId === dropId);

            if (fromGroupIdx !== -1 && toGroupIdx !== -1) {
                const reorderedGroups = [...currentGroups];
                const [movedGroup] = reorderedGroups.splice(fromGroupIdx, 1);
                reorderedGroups.splice(toGroupIdx, 0, movedGroup);

                const nextVariants: ProductVariantFormData[] = [];
                for (const g of reorderedGroups) {
                    for (const item of g.items) {
                        nextVariants.push(item.variant);
                    }
                }

                const updated = nextVariants.map((v, i) => ({
                    ...v,
                    sort_order: i + 1,
                }));

                props.form.setFieldValue('variants', updated);
            }
            return;
        }
    };

    return (
        <DragDropProvider onDragEnd={handleDragEnd} collisionDetector={closestCenter}>
            <DragDropSensors />
            <SortableProvider ids={activeSortableIds()}>
                <div class="w-full overflow-x-auto rounded-2xl border border-border bg-card shadow-xs">
                    <Table>
                        <TableHeader>
                            <TableRow class="bg-card-alt/60 hover:bg-card-alt/60 border-b border-border">
                                <TableHead class="w-10 text-center" />
                                <TableHead class="w-10 text-center">
                                    <Checkbox
                                        checked={isMasterChecked()}
                                        indeterminate={isMasterIndeterminate()}
                                        onChange={handleMasterToggle}
                                    />
                                </TableHead>
                                <TableHead>Variante / Opciones</TableHead>
                                <TableHead class="w-44">SKU</TableHead>
                                <TableHead class="w-36">Precio Venta</TableHead>
                                <TableHead class="w-24 text-center">Estado</TableHead>
                                <TableHead class="w-16 text-right pr-4">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <Show
                                when={groups().length > 0}
                                fallback={
                                    <TableRow>
                                        <TableCell colSpan={7} class="py-12 text-center text-muted">
                                            No hay variantes configuradas para mostrar.
                                        </TableCell>
                                    </TableRow>
                                }
                            >
                                <For each={groups()}>
                                    {(group) => {
                                        const groupIndices = () => group.items.map((i) => i.index);
                                        const isGroupChecked = () => {
                                            const indices = groupIndices();
                                            const sel = selectedIndices();
                                            return (
                                                indices.length > 0 &&
                                                indices.every((i) => sel.has(i))
                                            );
                                        };
                                        const isGroupIndeterminate = () => {
                                            const indices = groupIndices();
                                            const sel = selectedIndices();
                                            return (
                                                !isGroupChecked() &&
                                                indices.some((i) => sel.has(i))
                                            );
                                        };

                                        return (
                                            <>
                                                <VariantGroupRow
                                                    groupKey={group.groupKey}
                                                    groupValue={group.groupValue}
                                                    primaryAxisName={group.primaryAxisName}
                                                    sortableGroupId={group.sortableGroupId}
                                                    childCount={group.items.length}
                                                    priceSummary={group.priceSummary}
                                                    stockSummary={group.stockSummary}
                                                    isExpanded={isGroupExpanded(group.groupKey)}
                                                    isGroupChecked={isGroupChecked()}
                                                    isGroupIndeterminate={isGroupIndeterminate()}
                                                    onToggleExpand={() => toggleGroupExpand(group.groupKey)}
                                                    onToggleGroupSelection={() =>
                                                        handleToggleSelectGroup(groupIndices())
                                                    }
                                                />
                                                <Show when={isGroupExpanded(group.groupKey)}>
                                                    <For each={group.items}>
                                                        {(item) => (
                                                            <VariantChildRow
                                                                variant={item.variant}
                                                                variantIndex={item.index}
                                                                sortableId={item.sortableId}
                                                                isSelected={selectedIndices().has(item.index)}
                                                                primaryAxisName={group.primaryAxisName}
                                                                defaultPrice={resolvedDefaultPrice()}
                                                                onToggleSelect={handleToggleSelect}
                                                                onUpdatePrice={handleUpdatePrice}
                                                                onOpenDetailModal={props.onOpenDetailModal}
                                                            />
                                                        )}
                                                    </For>
                                                </Show>
                                            </>
                                        );
                                    }}
                                </For>
                            </Show>
                        </TableBody>
                    </Table>
                </div>
            </SortableProvider>
        </DragDropProvider>
    );
};

export default GroupedVariantTable;
