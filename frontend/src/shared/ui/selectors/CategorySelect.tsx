import { Component, JSX, Show } from 'solid-js';
import { TreeSelect } from '@/shared/ui/form/TreeSelect';
import { useCategoriesFlat } from '@modules/categories/data/categories.queries';
import type { CategoryNode } from '@app/schema/dto';
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
            <TreeSelect<CategoryNode>
                value={props.value}
                onChange={(id) => props.onChange(id)}
                options={(categoriesQuery.data || []) as CategoryNode[]}
                optionValue={(c) => c.id}
                optionLabel={(c) => c.name}
                optionParentId={(c) => c.parent_id}
                optionIsActive={(c) => c.is_active}
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
