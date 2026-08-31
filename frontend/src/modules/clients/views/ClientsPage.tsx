import { Component } from 'solid-js';
import { useEntityState } from '@modules/entities/hooks/useEntityState';
import { EntityPage } from '@modules/entities/views/EntityPage';
import { UsersIcon } from '@icons/UsersIcon';
import { clientsApi } from '../data/clients.api';
import { clientKeys } from '../data/clients.keys';
import { clientQueries } from '../data/clients.queries';
import { clientMutations } from '../data/clients.mutations';
import { createClientColumns } from '../data/client.columns';
import { taxIdTypeDisplayLabels, personTypeLabels } from '@shared/constants/entity-labels';

const ClientsPage: Component = () => {
    const state = useEntityState({
        api: clientsApi,
        keys: clientKeys,
        queries: clientQueries,
        mutations: clientMutations,
        createColumns: createClientColumns,
        sseRoom: 'clients',
        permissionKey: 'clients',
        entityNamePlural: 'clientes',
        taxIdTypeDisplayLabels,
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
        />
    );
};

export default ClientsPage;
