import { Component, Show } from 'solid-js';
import { useNavigate } from '@tanstack/solid-router';
import { useFamiliesList } from '../../data/families.queries';
import { useDeactivateFamily, useRestoreFamily } from '../../data/families.mutations';
import type { FamilyItem } from '../../data/families.api';
import { useToggleActive } from '@shared/hooks/useToggleActive';
import { Badge } from '@shared/ui/Badge';
import { LayersIcon } from '@shared/ui/icons';
import SettingsTable, { type SettingsColumn } from '../shared/SettingsTable';

const columns: SettingsColumn<FamilyItem>[] = [
    {
        key: 'name', label: 'Nombre',
        render: (item) => (
            <span class="text-sm font-medium text-text" classList={{ 'text-muted line-through': !(item.is_active ?? true) }}>
                {item.name}
            </span>
        ),
    },
    {
        key: 'category', label: 'Categoría',
        render: (item) => (
            <Show when={item.categoryName} fallback={<span class="text-muted text-sm">—</span>}>
                <Badge variant="primary" class="text-[10px] px-1.5 py-0">{item.categoryName}</Badge>
            </Show>
        ),
    },
    {
        key: 'description', label: 'Descripción',
        render: (item) => <span class="text-sm text-muted truncate">{item.description || '—'}</span>,
    },
];

const FamilyList: Component = () => {
    const query = useFamiliesList();
    const navigate = useNavigate();

    const handleToggle = useToggleActive<FamilyItem>({
        deactivate: useDeactivateFamily(),
        restore: useRestoreFamily(),
        getName: (item) => item.name,
    });

    return (
        <SettingsTable<FamilyItem>
            title="Familias de Productos"
            description="Agrupa productos en familias para organizar pedidos de material y reportes."
            data={query.data as FamilyItem[]}
            isLoading={query.isPending}
            columns={columns}
            searchable
            searchPlaceholder="Buscar familia..."
            emptyMessage="No hay familias creadas aún."
            emptyIcon={<LayersIcon class="size-10 text-muted/25" />}
            onRowClick={(item) => navigate({ to: `/settings/families/${item.id}/edit` })}
            onEdit={(item) => navigate({ to: `/settings/families/${item.id}/edit` })}
            onToggleActive={handleToggle}
            getIsActive={(item) => item.is_active ?? true}
        />
    );
};

export default FamilyList;
