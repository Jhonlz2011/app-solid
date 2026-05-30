/**
 * Location Tree Columns — Compact design with type badge integrated into name.
 *
 * Design decisions:
 * - Removed redundant `path` column (tree indentation already shows hierarchy)
 * - Merged `type` badge inline with the name column for compactness
 * - Type filter moved to name column header
 */
import { Show } from "solid-js";
import type { ColumnDef } from "@tanstack/solid-table";
import { DataTableColumnHeader } from "@shared/ui/DataTable/DataTableColumnHeader";
import type { FilterOption } from "@shared/ui/DataTable/DataTableColumnFilter";
import { Badge, CounterBadge, StatusBadge } from "@shared/ui/Badge";
import Checkbox from "@shared/ui/Checkbox";
import ActionMenu from "@shared/ui/ActionMenu";
import {
  ChevronRightIcon,
  ChevronDownIcon,
  PlusIcon,
  WarehouseIcon,
  InboxIcon,
  EyeIcon,
} from "@shared/ui/icons";
import { cn } from "@shared/lib/utils";
import type { LocationNode } from "./locations.api";
import { LOCATION_TYPE_META } from "./locations.constants";
import type { LocationType } from "@app/schema/enums";

export interface ColumnFilterConfig {
  options: () => FilterOption[];
  selected: () => string[];
  onChange: (selected: string[]) => void;
  isLoading: () => boolean;
}

export interface LocationColumnHandlers {
  onEdit: (id: number) => void;
  onAddChild: (parentId: number) => void;
  onDelete: (id: number) => void;
  onRestore: (id: number) => void;
  filters?: {
    warehouse?: ColumnFilterConfig;
    type?: ColumnFilterConfig;
    status?: ColumnFilterConfig;
  };
}

export function createLocationColumns(
  handlers: LocationColumnHandlers,
): ColumnDef<LocationNode>[] {
  return [
    // ── Select Checkbox ──
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          indeterminate={
            table.getIsSomePageRowsSelected() &&
            !table.getIsAllPageRowsSelected()
          }
          checked={table.getIsAllPageRowsSelected()}
          onChange={(checked) => table.toggleAllPageRowsSelected(checked)}
        />
      ),
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={row.getIsSelected()}
            onChange={(checked) => row.toggleSelected(checked)}
          />
        </div>
      ),
      size: 36,
      enableSorting: false,
      enableHiding: false,
    },

    // ── Name + Type badge + Children count (unified column) ──
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Nombre"
          filterOptions={handlers.filters?.type?.options()}
          selectedFilters={handlers.filters?.type?.selected()}
          onFilterChange={handlers.filters?.type?.onChange}
          isFilterLoading={handlers.filters?.type?.isLoading()}
        />
      ),
      meta: { title: "Nombre" },
      size: 400,
      cell: ({ row }) => {
        const depth = row.depth;
        const hasChildren = row.getCanExpand();
        const isExpanded = () => row.getIsExpanded();
        const loc = row.original;
        const isView = loc.type === "VIEW";

        return (
          <div
            class="flex items-center gap-2 min-w-0 w-full h-full cursor-pointer select-none group/name "
            style={{ "padding-left": `${depth * 1.5}rem` }}
            onClick={(e) => {
              e.stopPropagation();
              if (hasChildren) {
                row.toggleExpanded();
              } else {
                handlers.onEdit(loc.id);
              }
            }}
          >
            {/* Expand/Collapse chevron */}
            <Show
              when={hasChildren}
              fallback={
                <span class="size-5 shrink-0 flex items-center justify-center">
                  <span
                    class={cn(
                      "size-1.5 rounded-full transition-transform duration-200 group-hover/name:scale-125",
                      isView
                        ? "bg-purple-400/40 group-hover/name:bg-purple-500"
                        : "bg-blue-400/40 group-hover/name:bg-blue-500",
                    )}
                  />
                </span>
              }
            >
              <button
                type="button"
                class={cn(
                  "size-5 shrink-0 flex items-center justify-center rounded-md cursor-pointer",
                  "hover:bg-surface transition-colors text-muted hover:text-text",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  row.toggleExpanded();
                }}
                title={isExpanded() ? "Colapsar" : "Expandir"}
              >
                <Show
                  when={isExpanded()}
                  fallback={
                    <ChevronRightIcon stroke-width="3" class="size-3.5" />
                  }
                >
                  <ChevronDownIcon stroke-width="3" class="size-3.5" />
                </Show>
              </button>
            </Show>

            {/* Type icon — Rendered only for parent nodes (with children) */}
            <Show when={hasChildren}>
              <Show
                when={isView}
                fallback={
                  <InboxIcon class="size-4 shrink-0 text-blue-500 group-hover/name:text-blue-600 transition-colors" />
                }
              >
                <EyeIcon class="size-4 shrink-0 text-purple-500 group-hover/name:text-purple-600 transition-colors" />
              </Show>
            </Show>

            {/* Name + type pill + children count */}
            <div class="flex flex-col min-w-0 gap-0.5">
              <div class="flex items-center gap-1.5 min-w-0">
                <span
                  class={cn(
                    "text-sm font-medium truncate",
                    !loc.is_active && "line-through text-muted",
                  )}
                  title={loc.name}
                >
                  {loc.name}
                </span>

                {/* Children count */}
                <Show when={hasChildren && loc.subRows?.length}>
                  <CounterBadge
                    count={loc.subRows?.length}
                    variant="default"
                    class="text-[10px] font-mono tabular-nums shrink-0 transition-colors group-hover/name:bg-surface/80"
                  />
                </Show>
              </div>
            </div>
          </div>
        );
      },
    },

    // ── Warehouse ──
    {
      id: "warehouse",
      accessorKey: "warehouse_name",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Bodega"
          filterOptions={handlers.filters?.warehouse?.options()}
          selectedFilters={handlers.filters?.warehouse?.selected()}
          onFilterChange={handlers.filters?.warehouse?.onChange}
          isFilterLoading={handlers.filters?.warehouse?.isLoading()}
        />
      ),
      meta: { title: "Bodega" },
      size: 180,
      cell: ({ row }) => {
        const loc = row.original;
        if (!loc.warehouse_name) {
          return <span class="text-xs text-muted/40 italic">Sin bodega</span>;
        }
        return (
          <div class="flex items-center gap-1.5 min-w-0">
            <WarehouseIcon class="size-3.5 text-muted/60 shrink-0" />
            <div class="flex flex-col min-w-0">
              <span class="text-xs font-medium text-text truncate">
                {loc.warehouse_name}
              </span>
              <Show when={loc.warehouse_code}>
                <span class="text-[10px] text-muted font-mono leading-tight">
                  {loc.warehouse_code}
                </span>
              </Show>
            </div>
          </div>
        );
      },
    },

    // ── Products Count ──
    {
      id: "products",
      accessorKey: "product_count",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Productos" />
      ),
      meta: { title: "Productos" },
      size: 110,
      cell: ({ row }) => {
        const count = row.original.product_count ?? 0;
        return (
          <div class="flex items-center gap-1.5 justify-start">
            <Badge
              variant={count > 0 ? "success" : "default"}
              class="font-mono tabular-nums text-[11px]"
            >
              {count} {count === 1 ? "producto" : "productos"}
            </Badge>
          </div>
        );
      },
    },

    // ── Status ──
    {
      id: "status",
      accessorKey: "is_active",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Estado"
          filterOptions={handlers.filters?.status?.options()}
          selectedFilters={handlers.filters?.status?.selected()}
          onFilterChange={handlers.filters?.status?.onChange}
          isFilterLoading={handlers.filters?.status?.isLoading()}
        />
      ),
      meta: { title: "Estado" },
      size: 118,
      cell: ({ row }) => (
        <StatusBadge isActive={row.original.is_active ?? true} />
      ),
    },

    // ── Actions ──
    {
      id: "actions",
      header: "",
      size: 50,
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => {
        const loc = row.original;
        return (
          <ActionMenu
            module="locations"
            isActive={loc.is_active ?? true}
            showTo={`/locations/${loc.id}/show`}
            editTo={`/locations/${loc.id}/edit`}
            onDelete={() => handlers.onDelete(loc.id)}
            onRestore={() => handlers.onRestore(loc.id)}
          >
            {/* Add child location */}
            <Show when={loc.is_active ?? true}>
              <button
                type="button"
                class="flex w-full items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-dropdown-hover transition-colors"
                onClick={() => handlers.onAddChild(loc.id)}
              >
                <PlusIcon class="size-4 text-muted" />
                <span>Agregar sub-ubicación</span>
              </button>
            </Show>
          </ActionMenu>
        );
      },
    },
  ];
}
