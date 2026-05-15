/**
 * uom.constants.ts — Single source of truth for UOM group metadata.
 *
 * Shared across columns, selectors, and form components.
 * Eliminates the 3-way duplication of UOM_GROUP_META.
 */
import type { Component } from 'solid-js';
import type { UomGroup } from '@app/schema/enums';
import type { IconProps } from '@shared/ui/icons';
import {
    WeightIcon, RulerIcon, BeakerIcon, GridIcon,
    BoxIcon, ClockIcon, DatabaseIcon,
} from '@shared/ui/icons';
import { UOM_GROUPS } from '@app/schema/enums';

export interface UomGroupMeta {
    label: string;
    icon: Component<IconProps>;
    color: string; // Tailwind text + bg classes
}

export const UOM_GROUP_META: Record<UomGroup, UomGroupMeta> = {
    PESO:        { label: 'Peso',        icon: WeightIcon,      color: 'text-amber-500 bg-amber-500/10' },
    LONGITUD:    { label: 'Longitud',    icon: RulerIcon,       color: 'text-blue-500 bg-blue-500/10' },
    VOLUMEN:     { label: 'Volumen',     icon: BeakerIcon,      color: 'text-cyan-500 bg-cyan-500/10' },
    AREA:        { label: 'Área',        icon: GridIcon,        color: 'text-green-500 bg-green-500/10' },
    CANTIDAD:    { label: 'Cantidad',    icon: BoxIcon,         color: 'text-purple-500 bg-purple-500/10' },
    TIEMPO:      { label: 'Tiempo',      icon: ClockIcon,       color: 'text-orange-500 bg-orange-500/10' },
    DATA:        { label: 'Data',        icon: DatabaseIcon,    color: 'text-indigo-500 bg-indigo-500/10' },
};

/** Pre-computed options for Kobalte Select — value + label + icon */
export const groupOptions = UOM_GROUPS.map(g => ({
    value: g,
    label: UOM_GROUP_META[g].label,
    icon: UOM_GROUP_META[g].icon,
}));

/** Strips trailing zeros: "1.00000000" → "1", "0.00100000" → "0.001" */
export const formatBaseFactor = (v: string | null): string =>
    v ? parseFloat(v).toString() : '—';
