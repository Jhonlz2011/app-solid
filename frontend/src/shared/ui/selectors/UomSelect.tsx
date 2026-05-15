/**
 * UomSelect — Redesigned UOM selector with magnitude group tags.
 * Uses Kobalte Select with optionGroup sections per magnitude type.
 * Value is now an integer id (UOM PK), not a string code.
 */
import { Component, Show, createMemo, For } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { useUomList } from '@modules/uom/data/uom.queries';
import type { UomItem } from '@modules/uom/data/uom.api';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@shared/ui/Select';
import { Select as KSelect } from '@kobalte/core/select';
import { FieldLabel } from '@shared/ui/TextField';
import { UOM_GROUPS, type UomGroup } from '@app/schema/frontend';
import { UOM_GROUP_META } from '@modules/uom/data/uom.constants';
import { BoxIcon } from '@shared/ui/icons';

export interface UomSelectProps {
    /** Integer UOM id (the new PK) */
    value: number | null | undefined;
    onChange: (id: number | null) => void;
    label?: string;
    placeholder?: string;
    error?: string;
    required?: boolean;
}

interface UomGroupEntry {
    group: UomGroup;
    label: string;
    icon: Component<any>;
    items: UomItem[];
}

export const UomSelect: Component<UomSelectProps> = (props) => {
    const uomsQuery = useUomList();
    const uoms = createMemo(() => (uomsQuery.data ?? []) as UomItem[]);
    const selected = createMemo(() => uoms().find((u) => u.id === props.value));

    // Build grouped structure for rendering
    const groupedUoms = createMemo((): UomGroupEntry[] => {
        const items = uoms().filter(u => (u.is_active ?? true));
        const groups: Record<string, UomItem[]> = {};
        for (const item of items) {
            const g = item.uom_group || 'CANTIDAD';
            if (!groups[g]) groups[g] = [];
            groups[g].push(item);
        }
        return Object.entries(groups)
            .map(([key, items]) => ({
                group: key as UomGroup,
                label: UOM_GROUP_META[key as UomGroup]?.label ?? key,
                icon: UOM_GROUP_META[key as UomGroup]?.icon ?? BoxIcon,
                items,
            }))
            .sort((a, b) => UOM_GROUPS.indexOf(a.group) - UOM_GROUPS.indexOf(b.group));
    });

    return (
        <div class="space-y-1.5">
            <Show when={props.label !== undefined}>
                <FieldLabel>
                    {props.label ?? 'UOM'}{props.required ? ' *' : ''}
                </FieldLabel>
            </Show>
            <Select
                value={selected()}
                onChange={(opt: any) => props.onChange(opt?.id ?? null)}
                options={groupedUoms()}
                optionValue="id"
                optionTextValue="name"
                optionGroupChildren="items"
                placeholder={props.placeholder ?? 'Seleccionar UOM...'}
                itemComponent={(itemProps: any) => (
                    <SelectItem item={itemProps.item}>
                        <span class="flex items-center gap-2.5 w-full">
                            <span class="inline-flex items-center justify-center font-mono text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded min-w-[36px] text-center">
                                {itemProps.item.rawValue?.code}
                            </span>
                            <span class="flex-1 truncate text-sm">{itemProps.item.rawValue?.name}</span>
                        </span>
                    </SelectItem>
                )}
                sectionComponent={(sectionProps: any) => {
                    const groupKey = sectionProps.section.rawValue?.group;
                    const meta = UOM_GROUP_META[groupKey as UomGroup];
                    return (
                        <KSelect.Section>
                            <KSelect.Label class="flex items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-muted/70 select-none mt-1 first:mt-0">
                                <Dynamic component={meta?.icon ?? BoxIcon} class="size-4 opacity-70" />
                                <span>{meta?.label ?? groupKey}</span>
                                <span class="text-[10px] font-normal text-muted/50">({(sectionProps.section.rawValue?.items ?? []).length})</span>
                            </KSelect.Label>
                            {sectionProps.section.items}
                        </KSelect.Section>
                    );
                }}
            >
                <SelectTrigger>
                    <SelectValue<any>>
                        {(state) => {
                            const opt = state.selectedOption();
                            if (!opt) return props.placeholder ?? 'Seleccionar UOM...';
                            const groupMeta = UOM_GROUP_META[opt.uom_group as UomGroup];
                            return (
                                <span class="flex items-center gap-2">
                                    <Dynamic component={groupMeta?.icon ?? BoxIcon} class="size-3.5 opacity-70" />
                                    <span class="font-mono text-xs text-primary font-bold">{opt.code}</span>
                                    <span class="text-sm">{opt.name}</span>
                                </span>
                            );
                        }}
                    </SelectValue>
                </SelectTrigger>
                <SelectContent class="max-h-[320px]" />
            </Select>
            <Show when={props.error}>
                <small class="text-xs text-danger font-medium ml-1">{props.error}</small>
            </Show>
        </div>
    );
};

export default UomSelect;
