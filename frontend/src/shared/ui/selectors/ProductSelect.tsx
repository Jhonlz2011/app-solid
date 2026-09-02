/**
 * ProductSelect — Reusable autocomplete selector for Products.
 * Used in BOM component selection, document lines, etc.
 */
import { Component, Show, createMemo, createSignal, createEffect, onCleanup } from 'solid-js';
import { useProducts } from '@/modules/products/data/products.queries';
import type { Product } from '@/modules/products/data/products.api';
import { Autocomplete } from '@form/Autocomplete';

export interface ProductSelectProps {
    value: number | null | undefined;
    onChange: (product: Product | null) => void;
    excludeProductId?: number;
    label?: string;
    placeholder?: string;
    field?: any;
}

const getProductLabel = (p: Product) => `${p.name}${p.slug ? ` (${p.slug})` : ''}`;

export const ProductSelect: Component<ProductSelectProps> = (props) => {
    const [localQuery, setLocalQuery] = createSignal('');
    const [debouncedQuery, setDebouncedQuery] = createSignal('');
    const [selectedName, setSelectedName] = createSignal<string | null>(null);

    let debounceTimer: ReturnType<typeof setTimeout>;
    onCleanup(() => clearTimeout(debounceTimer));

    const productsQuery = useProducts(() => ({
        limit: 30,
        search: debouncedQuery() || undefined,
    }));

    const products = createMemo(() => {
        const raw = (productsQuery.data?.data ?? []) as unknown as Product[];
        if (props.excludeProductId) {
            return raw.filter(p => p.id !== props.excludeProductId);
        }
        return raw;
    });

    // Sync search text when props.value changes externally or products finish loading
    createEffect(() => {
        const val = props.value;
        const list = products();
        if (val != null) {
            const found = list.find(p => p.id === val);
            if (found) {
                const label = getProductLabel(found);
                if (localQuery() !== label) {
                    setLocalQuery(label);
                    setSelectedName(label);
                }
            }
        } else if (localQuery() !== '') {
            setLocalQuery('');
            setSelectedName(null);
        }
    });

    const handleInputChange = (val: string) => {
        setLocalQuery(val);
        if (val === '') {
            clearTimeout(debounceTimer);
            setDebouncedQuery('');
        }
        if (val === selectedName()) {
            return;
        }
        setSelectedName(null);
    };

    const handleSearchAction = (val: string) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            setDebouncedQuery(val.trim());
        }, 300);
    };

    const handleSelect = (prod: Product | null) => {
        clearTimeout(debounceTimer);
        if (prod) {
            const label = getProductLabel(prod);
            props.onChange(prod);
            setLocalQuery(label);
            setSelectedName(label);
            setDebouncedQuery('');
        } else {
            props.onChange(null);
            setLocalQuery('');
            setSelectedName(null);
            setDebouncedQuery('');
        }
    };

    return (
        <Autocomplete.Root field={props.field}>
            <Show when={props.label !== undefined}>
                <Autocomplete.Label>{props.label ?? 'Producto Componente'}</Autocomplete.Label>
            </Show>
            <Autocomplete.Input<Product>
                value={localQuery()}
                onInputChange={handleInputChange}
                onSearchAction={handleSearchAction}
                options={products()}
                optionValue={(p) => String(p.id)}
                optionLabel={getProductLabel}
                placeholder={props.placeholder ?? 'Buscar producto por nombre o SKU...'}
                isLoading={productsQuery.isFetching && selectedName() !== localQuery()}
                hideEmptyState={selectedName() === localQuery()}
                minLength={0}
                onSelect={handleSelect}
            />
            <Autocomplete.ErrorMessage />
        </Autocomplete.Root>
    );
};

export default ProductSelect;
