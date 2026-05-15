import { Component, createSignal } from 'solid-js';
import { useSearch } from '@tanstack/solid-router';
import { createForm } from '@tanstack/solid-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { LocationFormSchema, type LocationFormData } from '@app/schema/frontend';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { toast } from 'solid-sonner';
import { useCreateLocation } from '../data/locations.mutations';
import { FloppyDiskIcon } from '@shared/ui/icons';
import Sheet from '@shared/ui/Sheet';
import Button from '@shared/ui/Button';
import LocationForm from './LocationForm';

interface LocationNewSheetProps { onClose?: () => void; }

const LocationNewSheet: Component<LocationNewSheetProps> = (props) => {
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    const createMut = useCreateLocation();
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);

    // Support ?parentId=123 from "Add child" action in tree
    const search = useSearch({ strict: false }) as () => { parentId?: string };
    const defaultParentId = () => {
        const pid = search()?.parentId;
        return pid ? Number(pid) : undefined;
    };

    const form = createForm(() => ({
        defaultValues: {
            name: '',
            type: 'INTERNAL',
            barcode: '',
            parent_id: defaultParentId() ?? null,
        } as LocationFormData,
        validatorAdapter: valibotValidator(),
        validators: { onChange: LocationFormSchema, onSubmit: LocationFormSchema },
        onSubmit: async ({ value }) => {
            createMut.mutate(
                {
                    name: value.name,
                    type: value.type as 'VIEW' | 'INTERNAL',
                    barcode: value.barcode || null,
                    parent_id: value.parent_id ?? null,
                },
                {
                    onSuccess: () => { toast.success('Ubicación creada correctamente'); navigateAway(); },
                    onError: (err: any) => toast.error(err.message || 'Error al crear ubicación'),
                },
            );
        },
    }));

    const handleSubmit = () => { setHasAttemptedSubmit(true); form.handleSubmit(); };

    return (
        <Sheet
            bindDismiss={bindDismiss} isOpen={true} onClose={navigateAway}
            title="Nueva Ubicación" description="Registra una nueva ubicación de bodega" size="md"
            footer={
                <>
                    <Button variant="outline" onClick={close} disabled={createMut.isPending}>Cancelar</Button>
                    <Button type="submit" form="location-form" loading={createMut.isPending} loadingText="Creando..." icon={<FloppyDiskIcon />} onClick={handleSubmit}>
                        Crear Ubicación
                    </Button>
                </>
            }
        >
            <LocationForm
                form={form}
                formId="location-form"
                hasAttemptedSubmit={hasAttemptedSubmit}
                defaultParentId={defaultParentId()}
            />
        </Sheet>
    );
};

export default LocationNewSheet;
