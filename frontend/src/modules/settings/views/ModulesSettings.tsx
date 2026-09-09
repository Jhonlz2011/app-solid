import { Component, createSignal } from 'solid-js';
import { useNavigate } from '@tanstack/solid-router';
import { useTenantMenuItems } from '../data/menu.queries';
import { useResetMenuDefaults } from '../data/menu.mutations';
import type { MenuItemResponseType } from '@app/schema/backend';
import SettingsTable, { type SettingsColumn } from '../components/shared/SettingsTable';
import ConfirmDialog from '@shared/ui/overlay/ConfirmDialog';
import Button from '@form/Button';
import { LayoutIcon } from '@icons/LayoutIcon';

const ResetIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
    </svg>
);

const columns: SettingsColumn<MenuItemResponseType>[] = [
    {
        key: 'label',
        label: 'Módulo / Menú',
        width: '260px',
        render: (item) => (
            <div class="flex items-center gap-2 min-w-0">
                {item.parent_id !== null ? (
                    <span class="text-muted/40 font-mono text-xs select-none pl-3 shrink-0">└─</span>
                ) : (
                    <div class="size-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                        <LayoutIcon class="size-3.5 text-primary" />
                    </div>
                )}
                <div class="min-w-0">
                    <span class="text-sm font-semibold text-text truncate block">
                        {item.label}
                    </span>
                    <span class="text-[10px] text-muted font-mono truncate block">
                        {item.key}
                    </span>
                </div>
            </div>
        ),
    },
    {
        key: 'path',
        label: 'Ruta Interna',
        width: '180px',
        render: (item) => (
            <code class="text-xs font-mono px-2 py-0.5 rounded bg-surface/80 border border-border/50 text-muted">
                {item.path || '— (Agrupador)'}
            </code>
        ),
    },
    {
        key: 'path_alias',
        label: 'Alias de URL (Visible)',
        render: (item) => (
            item.path_alias ? (
                <div class="flex items-center gap-1.5">
                    <span class="px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 text-xs font-mono font-semibold">
                        {item.path_alias}
                    </span>
                    <span class="text-[10px] text-emerald-500 font-medium bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                        Personalizada
                    </span>
                </div>
            ) : (
                <span class="text-xs text-muted/50 italic font-mono">
                    Por defecto {item.path ? `(${item.path})` : ''}
                </span>
            )
        ),
    },
    {
        key: 'status',
        label: 'Estado',
        width: '130px',
        align: 'center',
        render: (item) => {
            switch (item.status) {
                case 'active':
                    return (
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            Activo
                        </span>
                    );
                case 'development':
                    return (
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            En Desarrollo
                        </span>
                    );
                case 'deprecated':
                default:
                    return (
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                            Oculto
                        </span>
                    );
            }
        },
    },
];

const ModulesSettings: Component = () => {
    const query = useTenantMenuItems();
    const navigate = useNavigate();
    const resetMut = useResetMenuDefaults();
    const [isResetConfirmOpen, setIsResetConfirmOpen] = createSignal(false);

    const handleConfirmReset = async () => {
        await resetMut.mutateAsync();
        setIsResetConfirmOpen(false);
    };

    return (
        <>
            <SettingsTable<MenuItemResponseType>
                title="Módulos"
                description="Personaliza las etiquetas visibles, los alias de URL amigables y la disponibilidad de los módulos para tu empresa."
                data={query.data}
                isLoading={query.isPending}
                columns={columns}
                searchable
                searchPlaceholder="Buscar por nombre, clave o ruta..."
                searchFn={(item, term) => {
                    return (
                        item.label.toLowerCase().includes(term) ||
                        item.key.toLowerCase().includes(term) ||
                        (item.path ? item.path.toLowerCase().includes(term) : false) ||
                        (item.path_alias ? item.path_alias.toLowerCase().includes(term) : false)
                    );
                }}
                headerActions={
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsResetConfirmOpen(true)}
                        disabled={resetMut.isPending}
                        icon={<ResetIcon />}
                    >
                        Restaurar Valores por Defecto
                    </Button>
                }
                emptyMessage="No se encontraron módulos configurados."
                onEdit={(item) => navigate({ to: `/settings/modules/${item.id}/edit` })}
            />

            <ConfirmDialog
                isOpen={isResetConfirmOpen()}
                onClose={() => setIsResetConfirmOpen(false)}
                onConfirm={handleConfirmReset}
                title="¿Restaurar configuración de módulos?"
                description="Se restablecerán todos los nombres de los menús y los alias de rutas a los valores oficiales por defecto del sistema. Esta acción no se puede deshacer."
                confirmLabel="Restaurar por Defecto"
                cancelLabel="Cancelar"
                variant="warning"
                isLoading={resetMut.isPending}
                loadingText="Restaurando..."
            />
        </>
    );
};

export default ModulesSettings;
