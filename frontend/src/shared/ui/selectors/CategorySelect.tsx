import { Component, JSX, Show, createMemo, createSignal } from 'solid-js';
import { TreeSelect } from '@shared/ui/TreeSelect';
import { useCategoriesFlat } from '@/modules/categories/data/categories.queries';
import type { FieldLike } from '@shared/ui/form/form.types';
import { TagIcon, XIcon } from '@shared/ui/icons';

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
    const [isChanging, setIsChanging] = createSignal(false);

    const categories = createMemo(() => (categoriesQuery.data ?? []) as any[]);
    
    const selectedCategory = createMemo(() => {
        const val = props.value;
        if (!val) return null;
        return categories().find(c => c.id === val) ?? null;
    });

    const parentCategoryName = createMemo(() => {
        const cat = selectedCategory();
        if (!cat || !cat.parent_id) return null;
        const parent = categories().find(c => c.id === cat.parent_id);
        return parent ? parent.name.toUpperCase() : null;
    });

    const showSelectedMask = createMemo(() => {
        return !!selectedCategory() && !isChanging() && !props.disabled;
    });

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
            <Show
                when={showSelectedMask()}
                fallback={
                    <TreeSelect
                        value={props.value}
                        onChange={(id) => {
                            props.onChange(id);
                            setIsChanging(false);
                        }}
                        options={categories()}
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
                        inputPrefix={props.inputPrefix ?? <TagIcon class="size-4 text-muted" />}
                    />
                }
            >
                <div class="flex flex-col gap-1 w-full">
                    <Show when={props.label !== undefined}>
                        <label class="text-sm font-medium text-muted ml-1 w-fit">
                            {props.label}
                        </label>
                    </Show>
                    <div 
                        onClick={() => setIsChanging(true)}
                        class="group flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/30 hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all duration-200 cursor-pointer shadow-xs"
                        title="Haz clic para cambiar categoría"
                    >
                        <div class="flex items-center gap-2.5 min-w-0 flex-1">
                            <TagIcon class="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <div class="flex flex-col min-w-0 leading-tight">
                                <span class="text-xs font-bold text-text uppercase tracking-wide truncate group-hover:text-primary transition-colors">
                                    {selectedCategory()?.name}
                                </span>
                                <Show when={parentCategoryName()}>
                                    <span class="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 truncate">
                                        {parentCategoryName()}
                                    </span>
                                </Show>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                props.onChange(null);
                                setIsChanging(false);
                            }}
                            class="p-1 rounded-lg text-muted/60 hover:text-danger hover:bg-danger/10 transition-colors shrink-0 cursor-pointer"
                            title="Quitar categoría"
                        >
                            <XIcon class="size-3.5" />
                        </button>
                    </div>
                </div>
            </Show>
        </Show>
    );
};

export default CategorySelect;
