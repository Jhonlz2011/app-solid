/**
 * ProductSelect — Reusable autocomplete selector for Products.
 * Used in BOM component selection, document lines, etc.
 */
import { Component, Show, createMemo, createSignal, createEffect } from 'solid-js';
import { useProducts } from '@/modules/products/data/products.queries';
import type { Product } from '@/modules/products/data/products.api';
import { Autocomplete } from '@shared/ui/Autocomplete';

export interface ProductSelectProps {
    value: number | null | undefined;
    onChange: (product: Product | null) => void;
    excludeProductId?: number;
    label?: string;
    placeholder?: string;
    field?: any;
}

export const ProductSelect: Component<ProductSelectProps> = (props) => {
    const [search, setSearch] = createSignal('');

    const productsQuery = useProducts(() => ({
        limit: 30,
        search: search() || undefined,
    }));

    const products = createMemo(() => {
        const raw = (productsQuery.data?.items ?? []) as Product[];
        if (props.excludeProductId) {
            return raw.filter(p => p.id !== props.excludeProductId);
        }
        return raw;
    });

    // Sync search text when props.value changes externally (edit mode, form reset)
    createEffect(() => {
        const val = props.value;
        if (val != null) {
            const found = products().find(p => p.id === val);
            if (found && search() !== found.name) setSearch(found.name);
        } else if (search() !== '') {
            setSearch('');
        }
    });

    return (
        <Autocomplete.Root field={props.field}>
            <Show when={props.label !== undefined}>
                <Autocomplete.Label>{props.label ?? 'Producto Componente'}</Autocomplete.Label>
            </Show>
            <Autocomplete.Input<Product>
                value={search()}
                onInputChange={setSearch}
                options={products()}
                optionValue={(p) => String(p.id)}
                optionLabel={(p) => `${p.name}${p.slug ? ` (${p.slug})` : ''}`}
                placeholder={props.placeholder ?? 'Buscar producto por nombre o SKU...'}
                hideEmptyState={false}
                minLength={0}
                onSelect={(prod) => {
                    if (prod) {
                        props.onChange(prod);
                        setSearch(prod.name);
                    } else {
                        props.onChange(null);
                        setSearch('');
                    }
                }}
            />
            <Autocomplete.ErrorMessage />
        </Autocomplete.Root>
    );
};

export default ProductSelect;
