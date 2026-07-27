/**
 * BrandSelect — Reusable brand autocomplete with search and selected item mask.
 * Uses `useBrandsList()` internally.
 */
import { Component, Show, createMemo, createSignal } from 'solid-js';
import { useBrandsList } from '@modules/brands/data/brands.queries';
import { Autocomplete } from '@shared/ui/Autocomplete';
import { TagIcon, XIcon } from '@shared/ui/icons';

type Brand = { id: number; name: string };

export interface BrandSelectProps {
    value: number | null | undefined;
    onChange: (id: number | null) => void;
    label?: string;
    placeholder?: string;
    field?: any;
    onCreateNew?: () => void;
    disabled?: boolean;
}

export const BrandSelect: Component<BrandSelectProps> = (props) => {
    const brandsQuery = useBrandsList();
    const [search, setSearch] = createSignal('');
    const [isChanging, setIsChanging] = createSignal(false);

    const brands = createMemo(() => (brandsQuery.data ?? []) as Brand[]);

    const selectedBrand = createMemo(() => {
        if (!props.value) return null;
        return brands().find(b => b.id === props.value) ?? null;
    });

    const showSelectedMask = createMemo(() => {
        return !!selectedBrand() && !isChanging() && !props.disabled;
    });

    // Filtered options by search
    const filteredOptions = createMemo(() => {
        const s = search().toLowerCase().trim();
        if (!s) return brands();
        return brands().filter(b => b.name.toLowerCase().includes(s));
    });

    return (
        <Show
            when={showSelectedMask()}
            fallback={
                <Autocomplete.Root field={props.field}>
                    <Show when={props.label !== undefined}>
                        <Autocomplete.Label>{props.label ?? 'Marca'}</Autocomplete.Label>
                    </Show>
                    <Autocomplete.Input<Brand>
                        value={search()}
                        onInputChange={setSearch}
                        options={filteredOptions()}
                        optionValue={(b) => String(b.id)}
                        optionLabel={(b) => b.name}
                        placeholder={props.placeholder ?? 'Buscar marca...'}
                        hideEmptyState={false}
                        minLength={0}
                        onCreateNew={props.onCreateNew}
                        createNewLabel="Crear marca"
                        onSelect={(brand) => {
                            if (brand) {
                                props.onChange(brand.id);
                                setSearch(brand.name);
                                setIsChanging(false);
                            } else {
                                props.onChange(null);
                                setSearch('');
                                setIsChanging(false);
                            }
                        }}
                    />
                    <Autocomplete.ErrorMessage />
                </Autocomplete.Root>
            }
        >
            <div class="flex flex-col gap-1 w-full">
                <Show when={props.label !== undefined}>
                    <label class="text-sm font-medium text-muted ml-1 w-fit">
                        {props.label ?? 'Marca'}
                    </label>
                </Show>
                <div 
                    onClick={() => setIsChanging(true)}
                    class="group flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/30 hover:border-primary/50 hover:bg-primary/10 transition-all duration-200 cursor-pointer shadow-xs"
                    title="Haz clic para cambiar marca"
                >
                    <div class="flex items-center gap-2.5 min-w-0 flex-1">
                        <TagIcon class="size-4 text-primary shrink-0" />
                        <div class="flex flex-col min-w-0 leading-tight">
                            <span class="text-xs font-bold text-text uppercase tracking-wide truncate group-hover:text-primary transition-colors">
                                {selectedBrand()?.name}
                            </span>
                            <span class="text-[11px] font-semibold text-primary/80 truncate">
                                MARCA SELECCIONADA
                            </span>
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
                        title="Quitar marca"
                    >
                        <XIcon class="size-3.5" />
                    </button>
                </div>
            </div>
        </Show>
    );
};

export default BrandSelect;
