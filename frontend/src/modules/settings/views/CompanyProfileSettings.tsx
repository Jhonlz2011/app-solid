import { Component, Show } from 'solid-js';
import { cn } from '@shared/lib/utils';
import { CompanyProfileFormSchema } from '@app/schema/frontend';
import { useCompanySettingsForm } from '../data/useCompanySettingsForm';
import { FileUploadDropzone } from '@/shared/ui/overlay/FileUpload';
import CompanyGeneralFields from '@shared/ui/form/company/CompanyGeneralFields';
import Button from '@form/Button';
import { FloppyDiskIcon } from '@icons/FloppyDiskIcon';
import { SkeletonLoader } from '@display/SkeletonLoader';
import { FormSubmissionContext } from '@shared/ui/form/form.types';

const CompanyProfileSettings: Component = () => {
    const {
        form, brandingQuery, updateBrandingMut,
        hasAttemptedSubmit, setHasAttemptedSubmit,
        logoPreviewUrl, isFormDirty,
    } = useCompanySettingsForm({
        onSuccessMessage: 'Perfil de empresa guardado correctamente',
        schema: CompanyProfileFormSchema,
        fieldsSubset: ['businessName', 'tradeName', 'ruc', 'mainAddress', 'businessType', 'email', 'phone', 'logoUrl'],
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
                                <h2 class="text-xl font-bold text-heading">Perfil Comercial</h2>
                                <p class="text-xs text-muted mt-0.5">Controla la información comercial y el logotipo de tu empresa</p>
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
                            <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                                {/* Datos de Empresa Form */}
                                <div class="lg:col-span-7 bg-card-alt/50 border border-border/80 rounded-2xl p-6 space-y-5">
                                    <h3 class="text-base font-bold text-heading border-b border-border/60 pb-2">Datos de la Organización</h3>
                                    <CompanyGeneralFields
                                        form={form}
                                        showSlug={false}
                                        showContact={true}
                                        isMatrizRequired={true}
                                        checkRucAvailability={false}
                                    />
                                </div>

                                {/* Logo Upload */}
                                <div class="lg:col-span-5 bg-card-alt/50 border border-border/80 rounded-2xl p-6 space-y-4">
                                    <h3 class="text-base font-bold text-heading border-b border-border/60 pb-2">Logo de la Marca</h3>
                                    <p class="text-xs text-muted">Sube tu logo corporativo. El selector te permitirá recortar la imagen en proporción cuadrada 1:1.</p>
                                    <form.Field name="logoUrl">
                                        {(field) => (
                                            <FileUploadDropzone
                                                maxFiles={1}
                                                accept={['image/png', 'image/jpeg', 'image/webp']}
                                                crop={true}
                                                cropShape="rectangle"
                                                cropAspectRatio={1}
                                                lockAspectRatio={true}
                                                existingUrls={logoPreviewUrl() ? [logoPreviewUrl()!] : []}
                                                onFilesChange={(files) => {
                                                    if (files.length > 0) {
                                                        field().handleChange(files[0]);
                                                    }
                                                }}
                                                onRemoveUrl={() => field().handleChange(null)}
                                                showPreview={false}
                                            />
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

export default CompanyProfileSettings;
