import { Component } from 'solid-js';
import { useEntityState } from '@modules/entities/hooks/useEntityState';
import { EntityPage } from '@modules/entities/views/EntityPage';
import { UsersIcon } from '@shared/ui/icons';

import { clientsApi } from '../data/clients.api';
import { clientKeys } from '../data/clients.keys';
import { clientQueries } from '../data/clients.queries';
import { clientMutations } from '../data/clients.mutations';
import { createClientColumns } from '../data/client.columns';
import { taxIdTypeLabels, personTypeLabels } from '../models/client.types';
import { ClientFilterSheet } from '../components/ClientFilterSheet';

const ClientsPage: Component = () => {
    const state = useEntityState({
        api: clientsApi,
        keys: clientKeys,
        queries: clientQueries as any, // SRI methods are mixed in, cast is fine
        mutations: clientMutations,
        createColumns: createClientColumns,
        sseRoom: 'clients',
        permissionKey: 'clients',
        entityNamePlural: 'clientes',
        taxIdTypeLabels,
        personTypeLabels,
    });

    return (
        <EntityPage
            title="Clientes"
            icon={<UsersIcon />}
            iconBg="linear-gradient(135deg, #10b981, #059669)"
            description="Gestiona los clientes de tu negocio. Puedes agregar, editar, eliminar y buscar clientes."
            state={state}
            entityNamePlural="clientes"
            entityNameSingular="cliente"
            permissionKey="clients"
            newRoutePath="/clients/new"
            CustomFilterSheet={ClientFilterSheet}
        />
    );
};

export default ClientsPage;
