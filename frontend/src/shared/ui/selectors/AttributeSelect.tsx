/**
 * AttributeSelect — Multi-select for attribute definitions.
 *
 * Thin wrapper around MultiCombobox, same pattern as BrandSelect wraps Autocomplete.
 * "Crear nuevo atributo" button is placed in the label row (not inside the dropdown).
 */
import { Component, createMemo, createSignal } from 'solid-js';
import { useAttributeList } from '@modules/attributes/data/attributes.queries';
import { ATTRIBUTE_TYPE_LABELS } from '@modules/attributes/data/attributes.constants';
import type { AttributeItem } from '@modules/attributes/data/attributes.api';
import { MultiCombobox } from '@shared/ui/MultiCombobox';
import { Badge } from '@shared/ui/Badge';
import { PlusIcon, CheckIcon } from '@shared/ui/icons';
import Button from '../Button';

export interface AttributeSelectProps {
    value: number[];
    onChange: (ids: number[]) => void;
    onCreateNew?: () => void;
    label?: string;
    placeholder?: string;
    disabled?: boolean;
}

export const AttributeSelect: Component<AttributeSelectProps> = (props) => {
    const attrsQuery = useAttributeList();
    const [search, setSearch] = createSignal('');

    // All active attributes
    const allAttrs = createMemo(() =>
        ((attrsQuery.data ?? []) as AttributeItem[]).filter(a => a.is_active)
    );

    // Filtered by search
    const filteredOptions = createMemo(() => {
        const s = search().toLowerCase().trim();
        if (!s) return allAttrs();
        return allAttrs().filter(a => a.label.toLowerCase().includes(s));
    });

    // Currently selected AttributeItem objects (for controlled value)
    const selectedItems = createMemo(() => {
        const idSet = new Set(props.value);
        return allAttrs().filter(a => idSet.has(a.id));
    });

    const handleChange = (items: AttributeItem[]) => {
        props.onChange(items.map(a => a.id));
    };

    return (
        <MultiCombobox.Root>
            {/* Label row with "Crear nuevo" button */}
            <div class="flex items-center justify-between">
                <MultiCombobox.Label>{props.label ?? 'Atributos'}</MultiCombobox.Label>
                {props.onCreateNew && (
                    <Button
                        variant="link"
                        size="none"
                        class="text-xs font-medium px-1.5 py-0.5 rounded-md"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            props.onCreateNew!();
                        }}
                        icon={<PlusIcon class="size-3.5" />}
                    >
                        Crear nuevo
                    </Button>
                )}
            </div>

            <MultiCombobox.Input<AttributeItem>
                value={selectedItems()}
                onChange={handleChange}
                onInputChange={setSearch}
                options={filteredOptions()}
                optionValue={(a) => String(a.id)}
                optionLabel={(a) => a.label}
                placeholder={props.placeholder ?? 'Buscar atributos...'}
                placeholderWhenSelected="Agregar más..."
                disabled={props.disabled}
                isLoading={attrsQuery.isLoading}
                itemRenderer={(attr, isSelected) => (
                    <div class="flex w-full items-center justify-between gap-2">
                        <div class="flex items-center gap-2 min-w-0 flex-1">
                            <div class={`shrink-0 size-4 flex items-center justify-center ${isSelected ? '' : 'invisible'}`}>
                                <CheckIcon class="size-4 text-primary" />
                            </div>
                            <span class="font-medium text-text truncate">{attr.label}</span>
                            <Badge variant="primary" class="text-[10px] px-1.5 py-0 shrink-0">
                                {ATTRIBUTE_TYPE_LABELS[attr.type] ?? attr.type}
                            </Badge>
                        </div>
                        <span class="text-[11px] text-muted font-mono shrink-0">{attr.key}</span>
                    </div>
                )}
            />
            <MultiCombobox.ErrorMessage />
        </MultiCombobox.Root>
    );
};

export default AttributeSelect;
