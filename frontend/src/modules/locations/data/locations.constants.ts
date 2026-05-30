/**
 * locations.constants.ts — Single source of truth for Location type metadata.
 *
 * Shared across columns, selectors, and form components.
 */
import type { Component } from 'solid-js';
import type { LocationType } from '@app/schema/enums';
import type { IconProps } from '@shared/ui/icons';
import { InboxIcon, EyeIcon } from '@shared/ui/icons';
import { LOCATION_TYPES } from '@app/schema/enums';

export interface LocationTypeMeta {
    label: string;
    description: string;
    icon: Component<IconProps>;
    color: string;
}

export const LOCATION_TYPE_META: Record<LocationType, LocationTypeMeta> = {
    INTERNAL: {
        label: 'Contenedor',
        description: 'Ubicación física donde se almacena stock',
        icon: InboxIcon,
        color: 'text-blue-500 bg-blue-500/10',
    },
    VIEW: {
        label: 'Visual',
        description: 'Agrupación lógica (zona, área, sección)',
        icon: EyeIcon,
        color: 'text-purple-500 bg-purple-500/10',
    },
};

/** Pre-computed options for type pickers */
export const locationTypeOptions = LOCATION_TYPES.map(t => ({
    value: t,
    label: LOCATION_TYPE_META[t].label,
    icon: LOCATION_TYPE_META[t].icon,
}));
