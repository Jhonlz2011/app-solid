/**
 * Shared constants for Attribute components.
 * Centralized to avoid duplication across AttributeList, CategoryAttributesPicker, etc.
 */
import type { AttributeDataType } from '@app/schema/frontend';

/** Human-readable labels for attribute data types */
export const ATTRIBUTE_TYPE_LABELS: Record<AttributeDataType, string> = {
    TEXT: 'Texto',
    NUMBER: 'Número',
    SELECT: 'Selección',
    BOOLEAN: 'Sí/No',
};

/** Options for the attribute type picker/segmented control */
export const ATTRIBUTE_TYPE_OPTIONS: Array<{ value: AttributeDataType; label: string; icon: string }> = [
    { value: 'TEXT', label: 'Texto', icon: 'T' },
    { value: 'NUMBER', label: 'Número', icon: '#' },
    { value: 'SELECT', label: 'Selección', icon: '▤' },
    { value: 'BOOLEAN', label: 'Sí/No', icon: '◉' },
];
