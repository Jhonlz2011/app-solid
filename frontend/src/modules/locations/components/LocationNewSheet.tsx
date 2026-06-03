import { Component } from 'solid-js';
import { useSearch, Outlet } from '@tanstack/solid-router';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { toast } from 'solid-sonner';
import { isNetworkError } from '@shared/utils/api-errors';
import { isOffline, showOfflineSavedToast } from '@shared/utils/offline-submit';
import { useCreateLocation } from '../data/locations.mutations';
import { FloppyDiskIcon } from '@shared/ui/icons';
import Sheet from '@shared/ui/Sheet';
import Button from '@shared/ui/Button';
import LocationForm from './LocationForm';
import type { LocationFormData } from '@app/schema/frontend';

interface LocationNewSheetProps { onClose?: () => void; }

const LocationNewSheet: Component<LocationNewSheetProps> = (props) => {
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    const createMut = useCreateLocation();

    // Support ?parentId=123 from "Add child" action in tree
    const search = useSearch({ strict: false }) as () => { parentId?: string };
    const defaultParentId = () => {
        const pid = search()?.parentId;
        return pid ? Number(pid) : undefined;
    };

    const handleSubmit = async (data: LocationFormData) => {
        if (isOffline()) {
            createMut.mutate({
                name: data.name,
                type: data.type,
                parent_id: data.parent_id ?? null,
                warehouse_id: data.warehouse_id ?? null,
            });
            showOfflineSavedToast();
            navigateAway();
            return;
        }
        try {
            await createMut.mutateAsync({
                name: data.name,
                type: data.type,
                parent_id: data.parent_id ?? null,
                warehouse_id: data.warehouse_id ?? null,
            });
            toast.success('Ubicación creada correctamente');
            navigateAway();
        } catch (err: any) {
            if (isNetworkError(err)) {
                toast.info('Guardado localmente', { description: 'Se sincronizará automáticamente al recuperar la conexión.', icon: '☁️' });
                navigateAway();
                return;
            }
            toast.error(err.message || 'Error al crear ubicación');
            throw err;
        }
    };

    return (
        <Sheet
            bindDismiss={bindDismiss} isOpen={true} onClose={navigateAway}
            title="Nueva Ubicación" description="Registra una nueva ubicación de bodega" size="md"
            footer={
                <>
                    <Button variant="outline" onClick={close} disabled={createMut.isPending}>Cancelar</Button>
                    <Button 
                        type="submit" 
                        form="location-form" 
                        loading={createMut.isPending} 
                        loadingText="Creando..." 
                        icon={<FloppyDiskIcon />}
                    >
                        Crear Ubicación
                    </Button>
                </>
            }
        >
            <LocationForm
                onSubmit={handleSubmit}
                isSubmitting={createMut.isPending}
                formId="location-form"
                defaultParentId={defaultParentId()}
            />
            <Outlet />
        </Sheet>
    );
};

export default LocationNewSheet;
