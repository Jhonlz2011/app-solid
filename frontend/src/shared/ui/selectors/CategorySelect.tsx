import { Component, JSX, Show } from 'solid-js';
import { TreeSelect } from '@shared/ui/TreeSelect';
import { useCategoriesFlat } from '@/modules/categories/data/categories.queries';
import type { FieldLike } from '@shared/ui/form/form.types';

export interface CategorySelectProps {
    value: number | null | undefined;
    onChange: (id: number | null) => void;
    parentSelectable?: boolean;
    editingId?: number;
    label?: string;
    placeholder?: string;
    disabled?: boolean;
    field?: FieldLike<any>;
    inputPrefix?: JSX.Element;
}

export const CategorySelect: Component<CategorySelectProps> = (props) => {
    const categoriesQuery = useCategoriesFlat();

    return (
        <Show
            when={!categoriesQuery.isLoading}
            fallback={
                <div class="space-y-1.5 w-full">
                    <Show when={props.label !== undefined}>
                        <label class="text-sm font-medium text-muted ml-1 w-fit">
                            {props.label}
                        </label>
                    </Show>
                    <div class="h-10 w-full bg-surface/30 animate-pulse rounded-xl" />
                </div>
            }
        >
            <TreeSelect
                value={props.value}
                onChange={(id) => props.onChange(id)}
                options={categoriesQuery.data || []}
                optionValue={(c: any) => c.id}
                optionLabel={(c: any) => c.name}
                optionParentId={(c: any) => c.parent_id}
                optionIsActive={(c: any) => c.is_active}
                parentSelectable={props.parentSelectable}
                editingId={props.editingId}
                label={props.label}
                placeholder={props.placeholder}
                disabled={props.disabled}
                field={props.field}
                inputPrefix={props.inputPrefix}
            />
        </Show>
    );
};

export default CategorySelect;
