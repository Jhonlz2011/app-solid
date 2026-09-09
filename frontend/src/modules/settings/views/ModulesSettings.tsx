import { Component, createSignal } from 'solid-js';
import { useNavigate, Outlet } from '@tanstack/solid-router';
import { useTenantMenuItems } from '../data/menu.queries';
import { useResetMenuDefaults } from '../data/menu.mutations';
import ModulesTreeTable from '../components/navigation/ModulesTreeTable';
import ConfirmDialog from '@shared/ui/overlay/ConfirmDialog';
import Button from '@form/Button';

const ResetIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
    </svg>
);

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
        <div class="space-y-4">
            <Outlet />

            {/* Header row */}
            <div class="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
                <div class="flex items-center gap-2.5 min-w-0">
                    <h2 class="text-lg font-semibold text-text">Módulos</h2>
                    {query.data && (
                        <span class="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-primary/10 text-primary tabular-nums">
                            {query.data.length}
                        </span>
                    )}
                </div>
            </div>
            <p class="text-xs text-muted -mt-2">
                Personaliza las etiquetas visibles, los alias de URL amigables, la jerarquía con arrastrar y soltar (Drag & Drop), y la disponibilidad de los módulos para tu empresa.
            </p>

            <ModulesTreeTable
                data={query.data ?? []}
                rawData={query.data ?? []}
                isLoading={query.isPending}
                onEdit={(id) => navigate({ to: `/settings/modules/${id}/edit` })}
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
        </div>
    );
};

export default ModulesSettings;
