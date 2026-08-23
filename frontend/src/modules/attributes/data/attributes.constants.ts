/**
 * Shared constants for Attribute components.
 * Centralized to eliminate duplication across AttributeForm, AttributeColumns, AttributeShowPanel, etc.
 */
import type { Component } from 'solid-js';
import type { AttributeDataType } from '@app/schema/enums';
import type { IconProps } from '@icons/BaseIcon';
import { FileTextIcon } from '@icons/FileTextIcon';
import { HashIcon } from '@icons/HashIcon';
import { SlidersIcon } from '@icons/SlidersIcon';
import { CheckIcon } from '@icons/CheckIcon';

export type AttributeSemanticColor = 'primary' | 'info' | 'warning' | 'success';

/** Semantic color token by attribute data type */
export const ATTRIBUTE_TYPE_COLORS: Record<AttributeDataType, AttributeSemanticColor> = {
    TEXT: 'primary',
    NUMBER: 'info',
    SELECT: 'warning',
    BOOLEAN: 'success',
};

/** Human-readable labels for attribute data types */
export const ATTRIBUTE_TYPE_LABELS: Record<AttributeDataType, string> = {
    TEXT: 'Texto',
    NUMBER: 'Número',
    SELECT: 'Selección',
    BOOLEAN: 'Sí/No',
};

/** Shared Tailwind CSS classes for badges across columns & panels */
export const ATTRIBUTE_TYPE_BADGE_CLASSES: Record<AttributeDataType, string> = {
    TEXT: 'text-primary bg-primary/10 border-primary/20',
    NUMBER: 'text-info bg-info/10 border-info/20',
    SELECT: 'text-warning bg-warning/10 border-warning/20',
    BOOLEAN: 'text-success bg-success/10 border-success/20',
};

/** Rich type metadata for the type picker cards */
export interface AttributeTypeOption {
    value: AttributeDataType;
    label: string;
    description: string;
    icon: Component<IconProps>;
    color: AttributeSemanticColor;
}

export const ATTRIBUTE_TYPE_OPTIONS: AttributeTypeOption[] = [
    {
        value: 'TEXT',
        label: ATTRIBUTE_TYPE_LABELS.TEXT,
        description: 'Entrada libre de texto',
        icon: FileTextIcon,
        color: ATTRIBUTE_TYPE_COLORS.TEXT,
    },
    {
        value: 'NUMBER',
        label: ATTRIBUTE_TYPE_LABELS.NUMBER,
        description: 'Valor numérico decimal',
        icon: HashIcon,
        color: ATTRIBUTE_TYPE_COLORS.NUMBER,
    },
    {
        value: 'SELECT',
        label: ATTRIBUTE_TYPE_LABELS.SELECT,
        description: 'Lista de opciones',
        icon: SlidersIcon,
        color: ATTRIBUTE_TYPE_COLORS.SELECT,
    },
    {
        value: 'BOOLEAN',
        label: ATTRIBUTE_TYPE_LABELS.BOOLEAN,
        description: 'Valor verdadero o falso',
        icon: CheckIcon,
        color: ATTRIBUTE_TYPE_COLORS.BOOLEAN,
    },
];
