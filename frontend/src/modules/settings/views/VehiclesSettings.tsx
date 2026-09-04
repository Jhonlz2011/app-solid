import { Component } from 'solid-js';
import { useNavigate } from '@tanstack/solid-router';
import { useVehiclesList } from '../data/vehicles.queries';
import { useUpdateVehicle } from '../data/vehicles.mutations';
import type { CompanyVehicleItemType } from '@app/schema/dto';
import { TruckIcon } from '@icons/TruckIcon';
import SettingsTable, { type SettingsColumn } from '../components/shared/SettingsTable';

const columns: SettingsColumn<CompanyVehicleItemType>[] = [
    {
        key: 'license_plate',
        label: 'Placa',
        width: '140px',
        render: (item) => (
            <span class="text-sm font-mono font-bold text-primary tracking-wide">
                {item.license_plate}
            </span>
        ),
    },
    {
        key: 'description',
        label: 'Descripción / Modelo',
        render: (item) => (
            <span
                class="text-sm font-medium text-text"
                classList={{ 'text-muted line-through': !item.is_active }}
            >
                {item.description || '—'}
            </span>
        ),
    },
];

const VehiclesSettings: Component = () => {
    const query = useVehiclesList();
    const navigate = useNavigate();
    const updateMut = useUpdateVehicle();

    const handleToggleActive = (item: CompanyVehicleItemType) => {
        updateMut.mutate({
            id: item.id,
            data: { isActive: !item.is_active },
        });
    };

    return (
        <SettingsTable<CompanyVehicleItemType>
            title="Vehículos"
            description="Gestiona la flota propia de vehículos de la empresa para despachos y emisión de Guías de Remisión."
            data={query.data as CompanyVehicleItemType[]}
            isLoading={query.isPending}
            columns={columns}
            searchable
            searchPlaceholder="Buscar por placa o modelo..."
            emptyMessage="No hay vehículos registrados en la flota aún."
            emptyIcon={<TruckIcon class="size-10 text-muted/25" />}
            onEdit={(item) => navigate({ to: `/settings/vehicles/${item.id}/edit` })}
            onToggleActive={handleToggleActive}
            getIsActive={(item) => item.is_active}
        />
    );
};

export default VehiclesSettings;
