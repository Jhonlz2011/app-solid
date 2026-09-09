import { Component, Show } from 'solid-js';
import { cn } from '@shared/lib/utils';
import { FiscalSettingsFormSchema } from '@app/schema/frontend';
import { useCompanySettingsForm } from '../data/useCompanySettingsForm';
import CompanyFiscalFields from '@shared/ui/form/company/CompanyFiscalFields';
import Button from '@form/Button';
import { FloppyDiskIcon } from '@icons/FloppyDiskIcon';
import { SkeletonLoader } from '@display/SkeletonLoader';
import { FormSubmissionContext } from '@shared/ui/form/form.types';

const FiscalSettings: Component = () => {
    const {
        form, brandingQuery, updateBrandingMut,
        hasAttemptedSubmit, setHasAttemptedSubmit,
        isFormDirty,
    } = useCompanySettingsForm({
        onSuccessMessage: 'Configuración fiscal guardada correctamente',
        schema: FiscalSettingsFormSchema,
        fieldsSubset: ['obligadoContabilidad', 'contribuyenteEspecial', 'agenteRetencion', 'rimpeType', 'sriEnvironment'],
    });

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
                        <div class="flex items-center justify-between border-b border-border pb-4 mb-5 shrink-0">
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
                                <CompanyFiscalFields
                                    form={form}
                                    regimeFieldName="rimpeType"
                                    obligadoControlType="switch"
                                    showAdvancedSri={true}
                                    alwaysShowContribuyenteEspecial={true}
                                />
                            </div>
                        </div>
                    </form>
                </FormSubmissionContext.Provider>
            </Show>
        </div>
    );
};

export default FiscalSettings;
