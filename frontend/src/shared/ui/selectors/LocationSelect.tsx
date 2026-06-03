import { Component, Show, createMemo } from 'solid-js';
import { useLocationList } from '@modules/locations/data/locations.queries';
import { TreeSelect } from '@shared/ui/TreeSelect';
import { WarehouseIcon, MapPinIcon, CloseIcon } from '@shared/ui/icons';
import Button from '@shared/ui/Button';
import type { LocationItem } from '@modules/locations/data/locations.api';
import type { FieldLike } from '@shared/ui/form/form.types';
import { SelectorBreadcrumbs, buildBreadcrumbs } from './SelectorBreadcrumbs';

export interface LocationSelectProps {
    value: number | null | undefined;
    onChange: (id: number | null, location: LocationItem | null) => void;
    label?: string;
    placeholder?: string;
    field?: FieldLike<any>;
    disabled?: boolean;
    editingId?: number;
}

export const LocationSelect: Component<LocationSelectProps> = (props) => {
    const locationsQuery = useLocationList();
    const flatList = createMemo(() => (locationsQuery.data ?? []) as LocationItem[]);

    // Find the currently selected location item
    const selectedLocation = createMemo(() => {
        const val = props.value;
        if (!val) return null;
        return flatList().find(l => l.id === val) ?? null;
    });

    // Build breadcrumb path for display
    const getBreadcrumb = (id: number): string => {
        const parts: string[] = [];
        let current = flatList().find(l => l.id === id);
        if (current?.parent_id) {
            current = flatList().find(l => l.id === current!.parent_id);
        } else {
            return '';
        }
        while (current) {
            parts.unshift(current.name);
            current = current.parent_id ? flatList().find(l => l.id === current!.parent_id) : undefined;
        }
        return parts.join(' › ');
    };

    // Get array of breadcrumbs for selected state
    const breadcrumbs = createMemo(() => {
        const loc = selectedLocation();
        if (!loc) return [];
        return buildBreadcrumbs(loc.id, flatList(), {
            getId: (l) => l.id,
            getParentId: (l) => l.parent_id,
            getName: (l) => l.name,
            skipSelf: true,
        });
    });


    return (
        <Show
            when={selectedLocation()}
            fallback={
                <TreeSelect<LocationItem>
                    value={props.value}
                    onChange={(id, loc) => props.onChange(id, loc)}
                    options={flatList()}
                    optionValue={(loc) => loc.id}
                    optionLabel={(loc) => loc.name}
                    optionParentId={(loc) => loc.parent_id}
                    optionIsActive={(loc) => loc.is_active ?? true}
                    label={props.label}
                    placeholder={props.placeholder}
                    disabled={props.disabled}
                    field={props.field}
                    editingId={props.editingId}
                    inputPrefix={<MapPinIcon class="size-4 text-muted" />}
                    itemRenderer={(loc, meta) => {
                        const breadcrumb = getBreadcrumb(loc.id);
                        
                        const highlight = (text: string) => {
                            const q = meta.query.trim().toLowerCase();
                            const textCol = meta.highlighted ? "text-primary" : meta.selected ? "text-primary font-semibold" : "text-inherit";
                            if (!q) return <span class={textCol}>{text}</span>;
                            const idx = text.toLowerCase().indexOf(q);
                            if (idx === -1) return <span class={textCol}>{text}</span>;
                            
                            const before = text.substring(0, idx);
                            const match = text.substring(idx, idx + q.length);
                            const after = text.substring(idx + q.length);
                            return (
                                <span class={textCol}>
                                    {before}
                                    <mark class="bg-primary/25 text-primary font-bold rounded-sm px-0.5">{match}</mark>
                                    {after}
                                </span>
                            );
                        };

                        return (
                            <div class="flex flex-col min-w-0 flex-1 ml-1 select-none">
                                <span class="text-sm font-semibold text-text truncate transition-colors duration-150">
                                    {highlight(loc.name)}
                                </span>
                                <div class="flex items-center gap-1.5 text-[11px] mt-0.5 min-w-0 max-w-full">
                                    <Show when={breadcrumb}>
                                        <span class={meta.highlighted || meta.selected ? "text-primary-strong/70 truncate transition-colors duration-150" : "text-muted/70 truncate transition-colors duration-150"}>
                                            {breadcrumb}
                                        </span>
                                    </Show>
                                    <Show when={breadcrumb && loc.warehouse_name}>
                                        <span class={`size-1 rounded-full shrink-0 transition-colors duration-150 ${meta.highlighted || meta.selected ? "bg-primary/30" : "bg-border"}`} />
                                    </Show>
                                    <Show when={loc.warehouse_name}>
                                        <span class={`flex items-center gap-1 font-medium truncate shrink-0 transition-colors duration-150 ${
                                            meta.highlighted 
                                                ? "text-purple-500/80" 
                                                : meta.selected 
                                                    ? "text-purple-500/80" 
                                                    : "text-purple-600/80"
                                        }`}>
                                            <WarehouseIcon class="size-3 shrink-0" />
                                            {loc.warehouse_name}
                                        </span>
                                    </Show>
                                </div>
                            </div>
                        );
                    }}
                />
            }
        >
            {(loc) => (
                <div class="flex flex-col gap-1 w-full">
                    <Show when={props.label !== undefined}>
                        <label class="text-sm font-medium text-muted ml-1 w-fit">
                            {props.label}
                        </label>
                    </Show>
                    
                    <div class="flex items-center gap-2 p-1 pl-3 pr-2 rounded-xl bg-primary/5 border border-primary/20 hover:bg-primary/8 hover:border-primary/30 transition-all duration-200 shadow-sm min-h-9.5">
                        <div class="flex-1 min-w-0 ">
                            <div class='flex  items-center gap-2 '>
 <MapPinIcon class="size-4 text-muted shrink-0 " />
                            <p class="text-sm font-semibold text-text truncate">
                                {loc().name}
                            </p>
                            </div>
                           

                            <SelectorBreadcrumbs items={breadcrumbs()} basePath="/locations" />
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                props.onChange(null, null);
                            }}
                            disabled={props.disabled}
                            class="text-muted hover:text-danger hover:bg-transparent p-1 rounded-lg shrink-0 cursor-pointer h-7"
                            title="Desvincular ubicación"
                        >
                            <CloseIcon class="size-4" />
                        </Button>
                    </div>
                </div>
            )}
        </Show>
    );
};

export default LocationSelect;
