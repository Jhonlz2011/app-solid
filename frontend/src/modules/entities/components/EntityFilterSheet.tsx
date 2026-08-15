import { Component } from 'solid-js';
import { FilterSheet, type FilterConfig } from '@shared/ui/DataTable/FilterSheet';

export interface EntityFilterSheetProps {
    isOpen: boolean;
    onClose: () => void;
    filters: {
        personType: FilterConfig;
        taxIdType: FilterConfig;
        isActive: FilterConfig;
        businessName: FilterConfig;
    };
    entityNamePlural?: string;
}

const GROUPS = [
    { key: 'isActive',     label: 'Estado' },
    { key: 'personType',   label: 'Tipo de persona' },
    { key: 'taxIdType',    label: 'Tipo de identificación' },
    { key: 'businessName', label: 'Razón Social' },
];

export const EntityFilterSheet: Component<EntityFilterSheetProps> = (props) => (
    <FilterSheet
        isOpen={props.isOpen}
        onClose={props.onClose}
        filters={props.filters}
        groups={GROUPS}
        entityName={props.entityNamePlural ?? 'entidades'}
    />
);

export default EntityFilterSheet;
