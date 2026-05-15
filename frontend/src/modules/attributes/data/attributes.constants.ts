/**
 * Shared constants for Attribute components.
 * Centralized to avoid duplication across AttributeList, AttributeColumns, etc.
 */
import type { Component } from 'solid-js';
import type { AttributeDataType } from '@app/schema/frontend';
import type { IconProps } from '@shared/ui/icons';
import { FileTextIcon, HashIcon, SlidersIcon, CheckIcon } from '@shared/ui/icons';

/** Human-readable labels for attribute data types */
export const ATTRIBUTE_TYPE_LABELS: Record<AttributeDataType, string> = {
    TEXT: 'Texto',
    NUMBER: 'Número',
    SELECT: 'Selección',
    BOOLEAN: 'Sí/No',
};

/** Rich type metadata for the type picker cards */
export interface AttributeTypeOption {
    value: AttributeDataType;
    label: string;
    description: string;
    icon: Component<IconProps>;
    color: string; // Tailwind color token
}

export const ATTRIBUTE_TYPE_OPTIONS: AttributeTypeOption[] = [
    {
        value: 'TEXT',
        label: 'Texto',
        description: 'Entrada libre de texto',
        icon: FileTextIcon,
        color: 'primary',
    },
    {
        value: 'NUMBER',
        label: 'Número',
        description: 'Valor numérico decimal',
        icon: HashIcon,
        color: 'info',
    },
    {
        value: 'SELECT',
        label: 'Selección',
        description: 'Lista de opciones',
        icon: SlidersIcon,
        color: 'warning',
    },
    {
        value: 'BOOLEAN',
        label: 'Sí/No',
        description: 'Valor verdadero o falso',
        icon: CheckIcon,
        color: 'success',
    },
];
