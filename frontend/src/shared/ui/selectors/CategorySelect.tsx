import { Component, JSX, Show, createSignal, createMemo, createEffect, onCleanup, For } from 'solid-js';
import { TreeSelect } from '@/shared/ui/form/TreeSelect';
import { useCategoriesFlat } from '@modules/categories/data/categories.queries';
import {
    fetchTaxonomyCategories,
    ensureTenantCategory,
    type TaxonomyCategoryResponseType,
} from '@modules/references/data/taxonomy.queries';
import type { CategoryNode } from '@app/schema/dto';
import type { FieldLike } from '@shared/ui/form/form.types';
import { SearchIcon } from '@icons/SearchIcon';
import { TagIcon } from '@icons/TagIcon';
import { CloseIcon } from '@icons/CloseIcon';
import { ChevronDownIcon } from '@icons/ChevronDownIcon';
import { DatabaseIcon } from '@icons/DatabaseIcon';

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
    useTaxonomy?: boolean;
    onSelectTaxonomyCategory?: (cat: TaxonomyCategoryResponseType) => void;
}

export const CategorySelect: Component<CategorySelectProps> = (props) => {
    // If parentSelectable is true (e.g. creating/editing category parent in CategoryForm),
    // use standard tree select for tenant categories
    const isTreeMode = () => props.parentSelectable === true || props.useTaxonomy === false;

    const categoriesQuery = useCategoriesFlat();

    // Taxonomy search states
    const [searchQuery, setSearchQuery] = createSignal('');
    const [isOpen, setIsOpen] = createSignal(false);
    const [isLoading, setIsLoading] = createSignal(false);
    const [taxonomyResults, setTaxonomyResults] = createSignal<TaxonomyCategoryResponseType[]>([]);
    const [selectedTaxonomyCat, setSelectedTaxonomyCat] = createSignal<TaxonomyCategoryResponseType | null>(null);

    let containerRef: HTMLDivElement | undefined;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    // Resolve current selection from tenant categories if available
    const currentTenantCategory = createMemo(() => {
        const val = props.value;
        if (!val || val <= 0) return null;
        const list = (categoriesQuery.data || []) as CategoryNode[];
        return list.find((c) => c.id === val) ?? null;
    });

    // Close popover on outside click
    const handleOutsideClick = (e: MouseEvent) => {
        if (containerRef && !containerRef.contains(e.target as Node)) {
            setIsOpen(false);
        }
    };

    createEffect(() => {
        if (isOpen()) {
            document.addEventListener('pointerdown', handleOutsideClick);
        } else {
            document.removeEventListener('pointerdown', handleOutsideClick);
        }
    });

    onCleanup(() => {
        document.removeEventListener('pointerdown', handleOutsideClick);
        if (debounceTimer) clearTimeout(debounceTimer);
    });

    // Search taxonomy categories with debounce
    const handleSearchInput = (query: string) => {
        setSearchQuery(query);
        if (debounceTimer) clearTimeout(debounceTimer);

        if (!query.trim()) {
            setTaxonomyResults([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        debounceTimer = setTimeout(async () => {
            try {
                const results = await fetchTaxonomyCategories(query.trim(), 15);
                setTaxonomyResults(results);
            } catch (err) {
                console.error('Error fetching taxonomy categories:', err);
                setTaxonomyResults([]);
            } finally {
                setIsLoading(false);
            }
        }, 250);
    };

    const handleSelectCategory = async (cat: TaxonomyCategoryResponseType) => {
        try {
            setIsLoading(true);
            setSelectedTaxonomyCat(cat);
            props.onSelectTaxonomyCategory?.(cat);

            // Ensure category exists in tenant DB to fulfill foreign key constraint
            const ensured = await ensureTenantCategory(cat.id);
            props.onChange(ensured.id);
            setIsOpen(false);
            setSearchQuery('');
        } catch (err) {
            console.error('Error ensuring category in tenant:', err);
            // Fallback: pass cat.id
            props.onChange(cat.id);
            setIsOpen(false);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClear = () => {
        props.onChange(null);
        setSelectedTaxonomyCat(null);
        setSearchQuery('');
    };

    return (
        <Show
            when={!isTreeMode()}
            fallback={
                <Show
                    when={!categoriesQuery.isLoading}
                    fallback={
                        <div class="space-y-1.5 w-full">
                            <Show when={props.label !== undefined}>
                                <label class="text-sm font-medium text-muted ml-1 w-fit">
                                    {props.label}
                                </label>
                            </Show>
                            <div class="h-9 w-full bg-surface border border-border animate-pulse rounded-lg" />
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
            }
        >
            {/* Taxonomy Autocomplete Combobox */}
            <div ref={containerRef} class="space-y-1.5 w-full relative">
                <Show when={props.label !== undefined}>
                    <div class="flex items-center justify-between">
                        <label class="text-xs font-semibold uppercase tracking-wider text-muted">
                            {props.label}
                        </label>
                        <span class="inline-flex items-center gap-1 text-[11px] text-primary font-medium">
                            <DatabaseIcon class="size-3" />
                            Taxonomía Estándar
                        </span>
                    </div>
                </Show>

                {/* Selected Pill Display OR Search Input */}
                <Show
                    when={!props.value || props.value <= 0}
                    fallback={
                        <div class="flex items-center justify-between px-3 py-2 bg-card border border-border/90 rounded-lg shadow-2xs group hover:border-primary/40 transition-colors">
                            <div class="flex items-center gap-2.5 min-w-0">
                                <div class="p-1.5 rounded-md bg-primary-soft text-primary shrink-0">
                                    <TagIcon class="size-3.5" />
                                </div>
                                <div class="flex flex-col min-w-0">
                                    <span class="text-sm font-medium text-text truncate">
                                        {selectedTaxonomyCat()?.name ?? currentTenantCategory()?.name ?? `Categoría #${props.value}`}
                                    </span>
                                    <Show when={selectedTaxonomyCat()?.fullPath ?? currentTenantCategory()?.description}>
                                        {(path) => (
                                            <span class="text-[11px] text-muted truncate">
                                                {path()}
                                            </span>
                                        )}
                                    </Show>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleClear}
                                disabled={props.disabled}
                                class="p-1 rounded-md text-muted hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer shrink-0"
                                title="Cambiar categoría"
                            >
                                <CloseIcon class="size-3.5" />
                            </button>
                        </div>
                    }
                >
                    <div class="relative">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                            <Show when={props.inputPrefix} fallback={<SearchIcon class="size-4" />}>
                                {props.inputPrefix}
                            </Show>
                        </div>

                        <input
                            type="text"
                            value={searchQuery()}
                            onInput={(e) => {
                                handleSearchInput(e.currentTarget.value);
                                setIsOpen(true);
                            }}
                            onFocus={() => setIsOpen(true)}
                            disabled={props.disabled}
                            placeholder={props.placeholder ?? 'Buscar en 14.606 categorías estándar...'}
                            class="w-full h-9 pl-9 pr-8 bg-surface border border-border hover:border-border-strong focus:border-primary focus:ring-1 focus:ring-primary rounded-lg text-sm text-text placeholder:text-muted/60 transition-colors outline-none"
                        />

                        <div class="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-muted">
                            <Show when={isLoading()} fallback={<ChevronDownIcon class="size-3.5" />}>
                                <div class="size-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                            </Show>
                        </div>
                    </div>
                </Show>

                {/* Autocomplete Dropdown Popover */}
                <Show when={isOpen() && searchQuery().trim().length > 0}>
                    <div class="absolute left-0 right-0 top-full mt-1.5 z-50 bg-card border border-border/90 rounded-xl shadow-lg p-1.5 max-h-64 overflow-y-auto">
                        <Show
                            when={taxonomyResults().length > 0}
                            fallback={
                                <div class="py-4 text-center text-xs text-muted">
                                    <Show when={isLoading()} fallback="No se encontraron categorías coincidentes.">
                                        Buscando en la taxonomía estándar...
                                    </Show>
                                </div>
                            }
                        >
                            <For each={taxonomyResults()}>
                                {(cat) => (
                                    <button
                                        type="button"
                                        onClick={() => handleSelectCategory(cat)}
                                        class="w-full flex flex-col items-start px-3 py-2 rounded-lg text-left hover:bg-primary-soft/40 transition-colors group cursor-pointer"
                                    >
                                        <div class="flex items-center gap-2 w-full">
                                            <span class="text-sm font-medium text-text group-hover:text-primary transition-colors truncate">
                                                {cat.name}
                                            </span>
                                            <span class="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border text-muted shrink-0">
                                                {cat.code}
                                            </span>
                                        </div>
                                        <span class="text-[11px] text-muted truncate max-w-full">
                                            {cat.fullPath}
                                        </span>
                                    </button>
                                )}
                            </For>
                        </Show>
                    </div>
                </Show>
            </div>
        </Show>
    );
};

export default CategorySelect;
