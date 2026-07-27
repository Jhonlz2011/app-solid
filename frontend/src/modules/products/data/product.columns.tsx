/**
 * Product & Service Column Definitions for DataTable
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
    routePrefix?: string;
    hideTypeColumn?: boolean;
    hideBrandColumn?: boolean;
    filters?: {
        categoryId?: ColumnFilterConfig;
        brandId?: ColumnFilterConfig;
        productType?: ColumnFilterConfig;
        isActive?: ColumnFilterConfig;
    };
}

export function createProductColumns(handlers: ProductColumnHandlers): ColumnDef<ProductListItem>[] {
    const routePrefix = handlers.routePrefix || '/products';
    const isServiceMode = handlers.hideTypeColumn ?? false;

    const columns: ColumnDef<ProductListItem>[] = [
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

        // SKU + Variant Count
        {
            accessorKey: 'default_sku',
            header: ({ column }) => <DataTableColumnHeader column={column} title="SKU" />,
            meta: { title: 'SKU' },
            size: 140,
            cell: (info) => {
                const item = info.row.original as any;
                const skuText = item.default_sku || item.sku || '—';
                const variantCount = item.variant_count ?? 0;

                return (
                    <Link
                        to={`${routePrefix}/${item.id}/show`}
                        preload="intent"
                        class="block cursor-pointer group/cell"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div class="flex items-center gap-1.5 min-w-0">
                            <span class="font-mono text-sm font-semibold text-primary group-hover/cell:underline underline-offset-2 transition-all duration-150 truncate">
                                {skuText}
                            </span>
                            <Show when={variantCount > 1}>
                                <span class="text-[10px] font-semibold text-muted bg-surface border border-border/80 px-1 py-0.2 rounded shrink-0">
                                    {variantCount} vars
                                </span>
                            </Show>
                        </div>
                    </Link>
                );
            },
        },

        // Name + Description
        {
            accessorKey: 'name',
            header: ({ column }) => <DataTableColumnHeader column={column} title={isServiceMode ? "Servicio" : "Producto"} />,
            meta: { title: isServiceMode ? 'Servicio' : 'Producto' },
            size: 260,
            cell: (info) => (
                <Link
                    to={`${routePrefix}/${info.row.original.id}/show`}
                    preload="intent"
                    class="min-w-0 block cursor-pointer group/cell"
                    title={info.getValue<string>()}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div class="font-semibold text-sm text-text truncate group-hover/cell:text-primary transition-colors duration-150">
                        {info.getValue<string>()}
                    </div>
                    <Show when={info.row.original.description}>
                        <div class="text-xs text-muted/80 truncate mt-0.5">{info.row.original.description}</div>
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
                    <Badge variant="primary" class="text-[11px] font-medium">{info.getValue<string>()}</Badge>
                </Show>
            ),
        },
    ];

    // Conditionally include Brand column (only for Products, not for Services)
    const hideBrand = handlers.hideBrandColumn ?? isServiceMode;
    if (!hideBrand) {
        columns.push({
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
                    <span class="text-xs font-semibold text-text">{info.getValue<string>()}</span>
                </Show>
            ),
        });
    }

    // Conditionally include Product Type column (only for Products, not for Services)
    if (!isServiceMode) {
        columns.push({
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
                        <Badge variant={type === 'PRODUCTO' ? 'primary' : 'info'} class="text-[10px] w-max font-semibold">
                            {productTypeLabels[type as keyof typeof productTypeLabels] ?? type}
                        </Badge>
                        <Show when={subtype}>
                            <span class="text-[10px] font-bold text-muted uppercase tracking-wider">
                                {productSubtypeLabels[subtype as keyof typeof productSubtypeLabels] ?? subtype}
                            </span>
                        </Show>
                    </div>
                );
            },
        });
    }

    // Price, UOM, Status, Actions
    columns.push(
        // Base Price (safe formatting without $NaN)
        {
            accessorKey: 'default_base_price',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Precio Base" />,
            meta: { title: 'Precio Base' },
            size: 120,
            cell: (info) => {
                const raw = info.row.original.default_base_price ?? (info.row.original as any).base_price;
                const num = typeof raw === 'number' ? raw : (raw != null ? parseFloat(String(raw)) : 0);
                const safeNum = Number.isFinite(num) ? num : 0;
                const formatted = new Intl.NumberFormat('es-CO', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                }).format(safeNum);

                return (
                    <span class="font-mono text-sm font-semibold tabular-nums text-text">
                        $ {formatted}
                    </span>
                );
            },
        },

        // UOM (inventory unit of measure)
        {
            accessorKey: 'uom_code',
            header: ({ column }) => <DataTableColumnHeader column={column} title="UOM" />,
            meta: { title: 'UOM' },
            size: 90,
            cell: (info) => {
                const item = info.row.original as any;
                const uomText = item.uom_code || item.uom_name || (item.uom_inventory_id ? `#${item.uom_inventory_id}` : null);
                return (
                    <Show when={uomText} fallback={<span class="text-muted text-xs">—</span>}>
                        <span class="text-[11px] font-semibold font-mono uppercase bg-surface-hover/80 text-text px-2 py-0.5 rounded border border-border/60">
                            {uomText}
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
                        module={isServiceMode ? "services" : "products"}
                        isActive={product.is_active ?? false}
                        showTo={`${routePrefix}/${product.id}/show`}
                        editTo={`${routePrefix}/${product.id}/edit`}
                        onRestore={() => handlers.onRestore(product)}
                        onDelete={() => handlers.onDelete(product)}
                    />
                );
            },
        }
    );

    return columns;
}

export default createProductColumns;
