/**
 * Product Column Definitions
 */
import { Show } from 'solid-js';
import { Link } from '@tanstack/solid-router';
import type { ColumnDef } from '@tanstack/solid-table';
import type { ProductListItem } from '../data/products.api';
import { useAuth } from '@/modules/auth/store/auth.store';
import Checkbox from '@shared/ui/Checkbox';
import { Badge, StatusBadge } from '@shared/ui/Badge';
import { DataTableColumnHeader } from '@shared/ui/DataTable/DataTableColumnHeader';
import type { FilterOption } from '@shared/ui/DataTable/DataTableColumnFilter';
import ActionMenu from '@shared/ui/ActionMenu';
import { productTypeLabels, productSubtypeLabels } from './products.api';

export interface ColumnFilterConfig {
    options: () => FilterOption[];
    selected: () => string[];
    onChange: (selected: string[]) => void;
    isLoading: () => boolean;
}

export interface ProductColumnHandlers {
    onDelete: (product: ProductListItem) => void;
    onRestore: (product: ProductListItem) => void;
    auth: ReturnType<typeof useAuth>;
    filters?: {
        categoryId?: ColumnFilterConfig;
        brandId?: ColumnFilterConfig;
        productType?: ColumnFilterConfig;
        isActive?: ColumnFilterConfig;
    };
}

export function createProductColumns(handlers: ProductColumnHandlers): ColumnDef<ProductListItem>[] {
    return [
        // Selection
        {
            id: 'select',
            header: ({ table }) => (
                <Checkbox
                    indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
                    checked={table.getIsAllPageRowsSelected()}
                    onChange={(checked) => table.toggleAllPageRowsSelected(checked)}
                />
            ),
            cell: ({ row }) => (
                <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={row.getIsSelected()} onChange={(checked) => row.toggleSelected(checked)} />
                </div>
            ),
            size: 36,
            enableSorting: false,
            enableHiding: false,
        },

        // SKU
        {
            accessorKey: 'sku',
            header: ({ column }) => <DataTableColumnHeader column={column} title="SKU" />,
            meta: { title: 'SKU' },
            size: 130,
            cell: (info) => (
                <Link
                    to={`/products/${info.row.original.id}/show`}
                    preload="intent"
                    class="block cursor-pointer group/cell"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div class="font-mono text-sm font-semibold text-primary group-hover/cell:underline underline-offset-2 transition-all duration-150">
                        {info.getValue<string>()}
                    </div>
                </Link>
            ),
        },

        // Name + Description
        {
            accessorKey: 'name',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Producto" />,
            meta: { title: 'Producto' },
            size: 240,
            cell: (info) => (
                <Link
                    to={`/products/${info.row.original.id}/show`}
                    preload="intent"
                    class="min-w-0 block cursor-pointer group/cell"
                    title={info.getValue<string>()}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div class="font-medium text-text truncate group-hover/cell:text-primary transition-colors duration-150">
                        {info.getValue<string>()}
                    </div>
                    <Show when={info.row.original.description}>
                        <div class="text-xs text-muted truncate">{info.row.original.description}</div>
                    </Show>
                </Link>
            ),
        },

        // Category (faceted)
        {
            accessorKey: 'category_name',
            id: 'category_id',
            header: ({ column }) => (
                <DataTableColumnHeader
                    column={column}
                    title="Categoría"
                    filterOptions={handlers.filters?.categoryId?.options()}
                    selectedFilters={handlers.filters?.categoryId?.selected()}
                    onFilterChange={handlers.filters?.categoryId?.onChange}
                    isFilterLoading={handlers.filters?.categoryId?.isLoading()}
                />
            ),
            meta: { title: 'Categoría' },
            size: 150,
            cell: (info) => (
                <Show when={info.getValue<string>()} fallback={<span class="text-muted text-xs">—</span>}>
                    <Badge variant="primary" class="text-[11px]">{info.getValue<string>()}</Badge>
                </Show>
            ),
        },

        // Brand (faceted)
        {
            accessorKey: 'brand_name',
            id: 'brand_id',
            header: ({ column }) => (
                <DataTableColumnHeader
                    column={column}
                    title="Marca"
                    filterOptions={handlers.filters?.brandId?.options()}
                    selectedFilters={handlers.filters?.brandId?.selected()}
                    onFilterChange={handlers.filters?.brandId?.onChange}
                    isFilterLoading={handlers.filters?.brandId?.isLoading()}
                />
            ),
            meta: { title: 'Marca' },
            size: 130,
            cell: (info) => (
                <Show when={info.getValue<string>()} fallback={<span class="text-muted text-xs">—</span>}>
                    <span class="text-sm font-medium">{info.getValue<string>()}</span>
                </Show>
            ),
        },

        // Product Type (faceted)
        {
            accessorKey: 'product_type',
            header: ({ column }) => (
                <DataTableColumnHeader
                    column={column}
                    title="Tipo"
                    filterOptions={handlers.filters?.productType?.options()}
                    selectedFilters={handlers.filters?.productType?.selected()}
                    onFilterChange={handlers.filters?.productType?.onChange}
                    isFilterLoading={handlers.filters?.productType?.isLoading()}
                />
            ),
            meta: { title: 'Tipo' },
            size: 120,
            cell: (info) => {
                const type = info.getValue<string>();
                const subtype = info.row.original.product_subtype;
                return (
                    <div class="flex flex-col gap-0.5">
                        <Badge variant={type === 'PRODUCTO' ? 'primary' : 'info'} class="text-[11px] w-max">
                            {productTypeLabels[type as keyof typeof productTypeLabels] ?? type}
                        </Badge>
                        <Show when={subtype}>
                            <span class="text-[10px] text-muted uppercase tracking-wider">
                                {productSubtypeLabels[subtype as keyof typeof productSubtypeLabels] ?? subtype}
                            </span>
                        </Show>
                    </div>
                );
            },
        },

        // Price
        {
            accessorKey: 'base_price',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Precio" />,
            meta: { title: 'Precio' },
            size: 110,
            cell: (info) => {
                const price = Number(info.getValue<string>());
                return (
                    <span class="font-mono text-sm font-semibold tabular-nums">
                        ${price.toFixed(2)}
                    </span>
                );
            },
        },

        // UOM
        {
            accessorKey: 'uom_inventory_id',
            header: ({ column }) => <DataTableColumnHeader column={column} title="UOM" />,
            meta: { title: 'UOM' },
            size: 80,
            cell: (info) => {
                const val = info.getValue<number | null>();
                return (
                    <Show when={val != null} fallback={<span class="text-muted text-xs">—</span>}>
                        <span class="text-xs font-medium uppercase bg-surface px-1.5 py-0.5 rounded border border-border">
                            #{val}
                        </span>
                    </Show>
                );
            },
        },

        // Status (faceted)
        {
            accessorKey: 'is_active',
            header: ({ column }) => (
                <DataTableColumnHeader
                    column={column}
                    title="Estado"
                    filterOptions={handlers.filters?.isActive?.options()}
                    selectedFilters={handlers.filters?.isActive?.selected()}
                    onFilterChange={handlers.filters?.isActive?.onChange}
                    isFilterLoading={handlers.filters?.isActive?.isLoading()}
                />
            ),
            meta: { title: 'Estado' },
            size: 100,
            cell: (info) => <StatusBadge isActive={info.getValue<boolean>()} />,
        },

        // Actions
        {
            id: 'actions',
            header: '',
            size: 50,
            enableHiding: false,
            cell: (info) => {
                const product = info.row.original;
                return (
                    <ActionMenu
                        module="products"
                        isActive={product.is_active ?? false}
                        showTo={`/products/${product.id}/show`}
                        editTo={`/products/${product.id}/edit`}
                        onRestore={() => handlers.onRestore(product)}
                        onDelete={() => handlers.onDelete(product)}
                    />
                );
            },
        },
    ];
}
