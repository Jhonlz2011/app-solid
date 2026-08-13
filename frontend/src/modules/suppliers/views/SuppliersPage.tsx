import { Component } from 'solid-js';
import { useEntityState } from '@modules/entities/hooks/useEntityState';
import { EntityPage } from '@modules/entities/views/EntityPage';
import { UsersIcon } from '@shared/ui/icons';

import { suppliersApi } from '../data/suppliers.api';
import { supplierKeys } from '../data/suppliers.keys';
import { supplierQueries } from '../data/suppliers.queries';
import { supplierMutations } from '../data/suppliers.mutations';
import { createSupplierColumns } from '../data/supplier.columns';
import { taxIdTypeLabels, personTypeLabels } from '../models/supplier.types';
import { SupplierFilterSheet } from '../components/SupplierFilterSheet';
import SupplierDeleteDialog from '../components/SupplierDeleteDialog';

const SuppliersPage: Component = () => {
    const state = useEntityState({
        api: suppliersApi,
        keys: supplierKeys,
        queries: supplierQueries,
        mutations: supplierMutations,
        createColumns: createSupplierColumns,
        sseRoom: 'suppliers',
        permissionKey: 'suppliers',
        entityNamePlural: 'proveedores',
        taxIdTypeLabels,
        personTypeLabels,
    });

    return (
        <EntityPage
            title="Proveedores"
            icon={<UsersIcon />}
            iconBg="linear-gradient(135deg, #ffdb03, #a37014)"
            description="Gestiona los proveedores de tu negocio. Puedes agregar, editar, eliminar y buscar proveedores."
            state={state}
            entityNamePlural="proveedores"
            permissionKey="suppliers"
            newRoutePath="/suppliers/new"
            CustomFilterSheet={SupplierFilterSheet}
            CustomDeleteDialog={SupplierDeleteDialog}
        />
    );
};

export default SuppliersPage;
