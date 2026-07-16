import { Component, Show } from 'solid-js';
import { cn } from '@shared/lib/utils';
import { useCompanySettingsForm } from '../data/useCompanySettingsForm';
import TextField from '@shared/ui/TextField';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@shared/ui/Select';
import Switch from '@shared/ui/Switch';
import Button from '@shared/ui/Button';
import { FloppyDiskIcon } from '@shared/ui/icons';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import { FormSubmissionContext } from '@shared/ui/form/form.types';

const RIMPE_OPTIONS = [
    { value: 'GENERAL', label: 'No aplica (Régimen General)' },
    { value: 'RIMPE_NEGOCIO_POPULAR', label: 'Rimpe - Negocio Popular' },
    { value: 'RIMPE_EMPRENDEDOR', label: 'Rimpe - Emprendedor' },
];

const SRI_ENV_OPTIONS = [
    { value: '1', label: 'Pruebas (Ambiente 1)' },
    { value: '2', label: 'Producción (Ambiente 2)' },
];

const FiscalSettings: Component = () => {
    const {
        form, brandingQuery, updateBrandingMut,
        hasAttemptedSubmit, setHasAttemptedSubmit,
        isFormDirty,
    } = useCompanySettingsForm({ onSuccessMessage: 'Configuración fiscal guardada correctamente' });

    return (
        <div class="h-full flex flex-col">
            <Show when={!brandingQuery.isLoading} fallback={<SkeletonLoader type="text" count={6} />}>
                <FormSubmissionContext.Provider value={hasAttemptedSubmit}>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            setHasAttemptedSubmit(true);
                            form.handleSubmit();
                        }}
                        class="flex-1 flex flex-col min-h-0"
                    >
                        {/* Header */}
                        <div class="flex items-center justify-between border-b border-border pb-4 mb-5 flex-shrink-0">
                            <div>
                                <h2 class="text-xl font-bold text-heading">Información Fiscal</h2>
                                <p class="text-xs text-muted mt-0.5">Controla el ambiente SRI, resoluciones especiales y obligaciones contables</p>
                            </div>
                            <Button
                                type="submit"
                                loading={updateBrandingMut.isPending}
                                loadingText="Guardando..."
                                icon={<FloppyDiskIcon />}
                                class={cn(
                                    'shadow-lg cursor-pointer transition-all duration-300',
                                    isFormDirty()
                                        ? 'shadow-primary/25 ring-2 ring-primary/30'
                                        : 'shadow-primary/10 opacity-80',
                                )}
                            >
                                Guardar
                                <Show when={isFormDirty()}>
                                    <span class="size-2 rounded-full bg-white animate-pulse ml-1" />
                                </Show>
                            </Button>
                        </div>

                        {/* Content scrollable */}
                        <div class="flex-1 min-h-0 overflow-y-auto pr-1 space-y-6">
                            <div class="max-w-3xl bg-card-alt/50 border border-border/80 rounded-2xl p-6 space-y-5">
                                <h3 class="text-base font-bold text-heading border-b border-border/60 pb-2">Información Fiscal Tributaria</h3>

                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    {/* Rimpe type select */}
                                    <form.Field name="rimpeType">
                                        {(field) => (
                                            <div class="flex flex-col gap-1.5">
                                                <label class="text-sm font-medium text-muted ml-1">Régimen RIMPE</label>
                                                <Select
                                                    value={RIMPE_OPTIONS.find(o => o.value === field().state.value)}
                                                    onChange={(opt: any) => field().handleChange(opt ? opt.value : 'GENERAL')}
                                                    options={RIMPE_OPTIONS}
                                                    optionValue="value"
                                                    optionTextValue="label"
                                                    placeholder="Seleccionar régimen..."
                                                    itemComponent={(itemProps: any) => (
                                                        <SelectItem item={itemProps.item}>
                                                            {itemProps.item.rawValue.label}
                                                        </SelectItem>
                                                    )}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue>
                                                            {(state: any) => {
                                                                const opt = state.selectedOption();
                                                                return opt ? opt.label : <span class="text-muted">No aplica (Régimen General)</span>;
                                                            }}
                                                        </SelectValue>
                                                    </SelectTrigger>
                                                    <SelectContent />
                                                </Select>
                                            </div>
                                        )}
                                    </form.Field>

                                    {/* SRI environment select */}
                                    <form.Field name="sriEnvironment">
                                        {(field) => (
                                            <div class="flex flex-col gap-1.5">
                                                <label class="text-sm font-medium text-muted ml-1">Ambiente de Emisión SRI *</label>
                                                <Select
                                                    value={SRI_ENV_OPTIONS.find(o => o.value === field().state.value)}
                                                    onChange={(opt: any) => field().handleChange(opt ? opt.value : '2')}
                                                    options={SRI_ENV_OPTIONS}
                                                    optionValue="value"
                                                    optionTextValue="label"
                                                    placeholder="Seleccionar ambiente..."
                                                    itemComponent={(itemProps: any) => (
                                                        <SelectItem item={itemProps.item}>
                                                            {itemProps.item.rawValue.label}
                                                        </SelectItem>
                                                    )}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue>
                                                            {(state: any) => {
                                                                const opt = state.selectedOption();
                                                                return opt ? opt.label : <span class="text-muted">Producción (Ambiente 2)</span>;
                                                            }}
                                                        </SelectValue>
                                                    </SelectTrigger>
                                                    <SelectContent />
                                                </Select>
                                            </div>
                                        )}
                                    </form.Field>

                                    <form.Field name="contribuyenteEspecial">
                                        {(field) => (
                                            <TextField.Root field={field()}>
                                                <TextField.Label>Resolución Contribuyente Especial</TextField.Label>
                                                <TextField.Input type="text" placeholder="Resolución SRI nro..." />
                                                <TextField.ErrorMessage />
                                            </TextField.Root>
                                        )}
                                    </form.Field>

                                    <form.Field name="agenteRetencion">
                                        {(field) => (
                                            <TextField.Root field={field()}>
                                                <TextField.Label>Resolución Agente de Retención</TextField.Label>
                                                <TextField.Input type="text" placeholder="Resolución SRI nro..." />
                                                <TextField.ErrorMessage />
                                            </TextField.Root>
                                        )}
                                    </form.Field>
                                </div>

                                {/* Obligado a llevar contabilidad Switch */}
                                <div class="border-t border-border/40 pt-4">
                                    <form.Field name="obligadoContabilidad">
                                        {(field) => (
                                            <div class="flex items-center justify-between p-3 rounded-xl bg-card border border-border">
                                                <div>
                                                    <span class="text-sm font-bold text-heading block">Obligado a Llevar Contabilidad</span>
                                                    <span class="text-xs text-muted mt-0.5">Activa esta casilla si tu empresa está registrada ante el SRI como obligada a llevar contabilidad.</span>
                                                </div>
                                                <Switch
                                                    checked={field().state.value}
                                                    onChange={(val) => field().handleChange(val)}
                                                />
                                            </div>
                                        )}
                                    </form.Field>
                                </div>
                            </div>
                        </div>
                    </form>
                </FormSubmissionContext.Provider>
            </Show>
        </div>
    );
};

export default FiscalSettings;
