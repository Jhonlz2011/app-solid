import { Component } from 'solid-js';
import { useNavigate } from '@tanstack/solid-router';
import { useWarehousesList } from '../../data/warehouses.queries';
import { useDeactivateWarehouse, useRestoreWarehouse } from '../../data/warehouses.mutations';
import type { WarehouseItem } from '../../data/warehouses.api';
import { useToggleActive } from '@shared/hooks/useToggleActive';
import { MapPinIcon, WarehouseIcon } from '@shared/ui/icons';
import SettingsTable, { type SettingsColumn } from '../shared/SettingsTable';

const columns: SettingsColumn<WarehouseItem>[] = [
    {
        key: 'code', label: 'Código', width: '80px',
        render: (item) => <span class="text-xs font-mono text-primary font-semibold">{item.code}</span>,
    },
    {
        key: 'name', label: 'Nombre',
        render: (item) => (
            <span class="text-sm font-medium text-text" classList={{ 'text-muted line-through': !(item.is_active ?? true) }}>
                {item.name}
            </span>
        ),
    },
    {
        key: 'address', label: 'Dirección',
        render: (item) => <span class="text-sm text-muted truncate">{item.address || '—'}</span>,
    },
    {
        key: 'locations', label: 'Ubic.', width: '80px', align: 'center',
        render: (item) => (
            <span class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                <MapPinIcon class="size-3" />
                {item.locationCount}
            </span>
        ),
    },
];

const WarehouseList: Component = () => {
    const query = useWarehousesList();
    const navigate = useNavigate();

    const handleToggle = useToggleActive<WarehouseItem>({
        deactivate: useDeactivateWarehouse(),
        restore: useRestoreWarehouse(),
        getName: (item) => item.name,
    });

    return (
        <SettingsTable<WarehouseItem>
            title="Bodegas"
            description="Gestiona las bodegas y almacenes del sistema. Click en una bodega para ver sus ubicaciones."
            data={query.data as WarehouseItem[]}
            isLoading={query.isPending}
            columns={columns}
            searchable
            searchPlaceholder="Buscar bodega..."
            emptyMessage="No hay bodegas creadas aún."
            emptyIcon={<WarehouseIcon class="size-10 text-muted/25" />}
            onRowClick={(item) => navigate({ to: `/settings/warehouses/${item.id}/locations` })}
            onEdit={(item) => navigate({ to: `/settings/warehouses/${item.id}/edit` })}
            onToggleActive={handleToggle}
            getIsActive={(item) => item.is_active ?? true}
        />
    );
};

export default WarehouseList;
