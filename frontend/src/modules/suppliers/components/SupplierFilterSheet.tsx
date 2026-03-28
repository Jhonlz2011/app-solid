/**
 * SupplierFilterSheet — Thin wrapper over the shared FilterSheet.
 *
 * Only defines the supplier-specific filter groups and passes them through.
 */
import { Component } from 'solid-js';
import { FilterSheet, type FilterConfig } from '@shared/ui/DataTable/FilterSheet';

export interface SupplierFilterSheetProps {
    isOpen: boolean;
    onClose: () => void;
    filters: {
        personType: FilterConfig;
        taxIdType: FilterConfig;
        isActive: FilterConfig;
        businessName: FilterConfig;
    };
}

const GROUPS = [
    { key: 'isActive',     label: 'Estado' },
    { key: 'personType',   label: 'Tipo de persona' },
    { key: 'taxIdType',    label: 'Tipo de identificación' },
    { key: 'businessName', label: 'Razón Social' },
];

export const SupplierFilterSheet: Component<SupplierFilterSheetProps> = (props) => (
    <FilterSheet
        isOpen={props.isOpen}
        onClose={props.onClose}
        filters={props.filters}
        groups={GROUPS}
        entityName="proveedores"
    />
);
