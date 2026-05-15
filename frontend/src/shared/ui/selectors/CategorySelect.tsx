/**
 * CategorySelect — Reusable category autocomplete with hierarchical indentation.
 * Uses `useCategoriesFlat()` internally. Zero-config drop-in.
 */
import { Component, Show, createMemo, createSignal } from 'solid-js';
import { useCategoriesFlat } from '@/modules/categories/data/categories.queries';
import { Autocomplete } from '@shared/ui/Autocomplete';
import { FolderIcon } from '@shared/ui/icons';
import { cn } from '@shared/lib/utils';

type FlatCategory = { id: number; name: string; parent_id: number | null; is_active: boolean; depth: number };

export interface CategorySelectProps {
    value: number | null | undefined;
    onChange: (id: number | null) => void;
    label?: string;
    placeholder?: string;
    error?: string;
    required?: boolean;
    field?: any;
    onCreateNew?: () => void;
}

export const CategorySelect: Component<CategorySelectProps> = (props) => {
    const categoriesQuery = useCategoriesFlat();
    const categories = createMemo(() => ((categoriesQuery.data as any[]) ?? []).filter((c: any) => c.is_active) as FlatCategory[]);
    const [search, setSearch] = createSignal('');

    // Build breadcrumb path
    const flatMap = createMemo(() => {
        const map = new Map<number, FlatCategory>();
        for (const c of categories()) map.set(c.id, c);
        return map;
    });

    const getBreadcrumb = (id: number): string => {
        const parts: string[] = [];
        let current = flatMap().get(id);
        if (current?.parent_id) {
            current = flatMap().get(current.parent_id);
        } else {
            return '';
        }
        while (current) {
            parts.unshift(current.name);
            current = current.parent_id ? flatMap().get(current.parent_id) : undefined;
        }
        return parts.join(' › ');
    };

    const childrenSet = createMemo(() => {
        const set = new Set<number>();
        for (const c of categories()) {
            if (c.parent_id) set.add(c.parent_id);
        }
        return set;
    });

    // Filtered by search
    const filteredOptions = createMemo(() => {
        const s = search().toLowerCase().trim();
        if (!s) return categories();
        return categories().filter(c =>
            c.name.toLowerCase().includes(s) ||
            getBreadcrumb(c.id).toLowerCase().includes(s)
        );
    });

    // Sync display text from value
    const getDisplayText = (id: number | null | undefined): string => {
        if (!id) return '';
        const cat = flatMap().get(id);
        if (!cat) return '';
        const breadcrumb = getBreadcrumb(cat.id);
        return breadcrumb ? `${cat.name} (${breadcrumb})` : cat.name;
    };

    // Init search text from value
    createMemo(() => {
        if (props.value && !search()) {
            const text = getDisplayText(props.value);
            if (text) setSearch(text);
        }
    });

    return (
        <Autocomplete.Root field={props.field}>
            <Show when={props.label !== undefined}>
                <Autocomplete.Label>
                    {props.label ?? 'Categoría'}{props.required ? ' *' : ''}
                </Autocomplete.Label>
            </Show>
            <Autocomplete.Input<FlatCategory>
                value={search()}
                onInputChange={setSearch}
                options={filteredOptions()}
                optionValue={(cat) => String(cat.id)}
                optionLabel={(cat) => cat.name}
                placeholder={props.placeholder ?? 'Buscar categoría...'}
                hideEmptyState={false}
                minLength={0}
                onCreateNew={props.onCreateNew}
                createNewLabel="Crear categoría"
                onSelect={(cat) => {
                    if (cat) {
                        props.onChange(cat.id);
                        const breadcrumb = getBreadcrumb(cat.id);
                        setSearch(breadcrumb ? `${cat.name} (${breadcrumb})` : cat.name);
                    } else {
                        props.onChange(null);
                        setSearch('');
                    }
                }}
                itemRenderer={(cat) => {
                    const depth = cat.depth ?? 0;
                    const hasKids = childrenSet().has(cat.id);
                    const breadcrumb = getBreadcrumb(cat.id);

                    return (
                        <div
                            class="flex items-center gap-2.5 min-w-0 py-0.5"
                            style={{ "padding-left": `${depth * 16}px` }}
                        >
                            <FolderIcon
                                class={cn(
                                    "size-4 shrink-0",
                                    hasKids ? "text-amber-500" : "text-muted/40"
                                )}
                            />
                            <div class="flex flex-col min-w-0">
                                <span class="text-sm font-medium text-text truncate">
                                    {cat.name}
                                </span>
                                <Show when={breadcrumb}>
                                    <span class="text-[11px] text-muted/70 truncate leading-tight">
                                        {breadcrumb}
                                    </span>
                                </Show>
                            </div>
                        </div>
                    );
                }}
            />
            <Autocomplete.ErrorMessage />
            <Show when={props.error}>
                <small class="text-xs text-danger font-medium ml-1">{props.error}</small>
            </Show>
        </Autocomplete.Root>
    );
};

export default CategorySelect;
