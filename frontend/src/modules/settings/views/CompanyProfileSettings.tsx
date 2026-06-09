import { Component, createSignal, createEffect, onCleanup, untrack, Show } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { CompanySettingsFormSchema, type CompanySettingsFormData } from '@app/schema/frontend';
import { toast } from 'solid-sonner';
import { useCompanyBranding } from '../data/branding.queries';
import { useUpdateCompanyBranding } from '../data/branding.mutations';
import { FileUploadDropzone } from '@shared/ui/FileUpload';
import TextField from '@shared/ui/TextField';
import Button from '@shared/ui/Button';
import { FloppyDiskIcon } from '@shared/ui/icons';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import { FormSubmissionContext } from '@shared/ui/form/form.types';

const CompanyProfileSettings: Component = () => {
    const brandingQuery = useCompanyBranding();
    const updateBrandingMut = useUpdateCompanyBranding();

    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);
    const [logoPreviewUrl, setLogoPreviewUrl] = createSignal<string | null>(null);

    const form = createForm(() => ({
        defaultValues: {
            logoUrl: null,
            loginBgUrl: null,
            primaryColor: '#6366f1',
            secondaryColor: '#64748b',
            businessName: '',
            tradeName: '',
            ruc: '',
            mainAddress: '',
            businessType: 'COMERCIO',
            email: '',
            phone: '',
            obligadoContabilidad: false,
            contribuyenteEspecial: '',
            agenteRetencion: '',
            rimpeType: '',
            sriEnvironment: '2',
        } as CompanySettingsFormData,
        validatorAdapter: valibotValidator(),
        validators: {
            onChange: CompanySettingsFormSchema,
            onSubmit: CompanySettingsFormSchema,
        },
        onSubmit: async ({ value }) => {
            updateBrandingMut.mutate(value, {
                onSuccess: () => {
                    toast.success('Perfil de empresa guardado correctamente');
                },
                onError: (err: any) => {
                    toast.error(err.message || 'Error al guardar el perfil');
                }
            });
        },
    }));

    // Sincronizar datos de la query al formulario
    createEffect(() => {
        const data = brandingQuery.data;
        if (data) {
            untrack(() => {
                form.setFieldValue('logoUrl', data.logoUrl);
                form.setFieldValue('loginBgUrl', data.loginBgUrl);
                form.setFieldValue('primaryColor', data.primaryColor);
                form.setFieldValue('secondaryColor', data.secondaryColor);
                form.setFieldValue('businessName', data.businessName);
                form.setFieldValue('tradeName', data.tradeName);
                form.setFieldValue('ruc', data.ruc);
                form.setFieldValue('mainAddress', data.mainAddress);
                form.setFieldValue('businessType', data.businessType);
                form.setFieldValue('email', data.email);
                form.setFieldValue('phone', data.phone);
                form.setFieldValue('obligadoContabilidad', data.obligadoContabilidad);
                form.setFieldValue('contribuyenteEspecial', data.contribuyenteEspecial);
                form.setFieldValue('agenteRetencion', data.agenteRetencion);
                form.setFieldValue('rimpeType', data.rimpeType);
                form.setFieldValue('sriEnvironment', data.sriEnvironment);
            });
        }
    });

    // Crear URL de previsualización reactiva
    createEffect(() => {
        const logoVal = form.state.values.logoUrl;
        if (logoVal instanceof File) {
            const url = URL.createObjectURL(logoVal);
            setLogoPreviewUrl(url);
            onCleanup(() => URL.revokeObjectURL(url));
        } else if (typeof logoVal === 'string') {
            setLogoPreviewUrl(logoVal);
        } else {
            setLogoPreviewUrl(null);
        }
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
                                class="shadow-lg shadow-primary/25 cursor-pointer"
                            >
                                Guardar
                            </Button>
                        </div>

                        {/* Content scrollable */}
                        <div class="flex-1 min-h-0 overflow-y-auto pr-1 space-y-6">
                            <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                                {/* Datos de Empresa Form */}
                                <div class="lg:col-span-7 bg-card-alt/50 border border-border/80 rounded-2xl p-6 space-y-5">
                                    <h3 class="text-base font-bold text-heading border-b border-border/60 pb-2">Datos de la Organización</h3>
                                    
                                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                        <form.Field name="businessName">
                                            {(field) => (
                                                <TextField.Root field={field()}>
                                                    <TextField.Label>Razón Social *</TextField.Label>
                                                    <TextField.Input type="text" placeholder="Mi Empresa S.A." />
                                                    <TextField.ErrorMessage />
                                                </TextField.Root>
                                            )}
                                        </form.Field>

                                        <form.Field name="tradeName">
                                            {(field) => (
                                                <TextField.Root field={field()}>
                                                    <TextField.Label>Nombre Comercial</TextField.Label>
                                                    <TextField.Input type="text" placeholder="Mi Marca" />
                                                    <TextField.ErrorMessage />
                                                </TextField.Root>
                                            )}
                                        </form.Field>

                                        <form.Field name="ruc">
                                            {(field) => (
                                                <TextField.Root field={field()}>
                                                    <TextField.Label>RUC (13 dígitos) *</TextField.Label>
                                                    <TextField.Input type="text" placeholder="1792345678001" maxLength={13} />
                                                    <TextField.ErrorMessage />
                                                </TextField.Root>
                                            )}
                                        </form.Field>

                                        <form.Field name="businessType">
                                            {(field) => (
                                                <TextField.Root field={field()}>
                                                    <TextField.Label>Actividad Económica / Negocio</TextField.Label>
                                                    <TextField.Input type="text" placeholder="COMERCIO, OPTICA, CLINICA, etc." />
                                                    <TextField.ErrorMessage />
                                                </TextField.Root>
                                            )}
                                        </form.Field>

                                        <form.Field name="phone">
                                            {(field) => (
                                                <TextField.Root field={field()}>
                                                    <TextField.Label>Teléfono de Contacto</TextField.Label>
                                                    <TextField.Input type="text" placeholder="0987654321" />
                                                    <TextField.ErrorMessage />
                                                </TextField.Root>
                                            )}
                                        </form.Field>

                                        <form.Field name="email">
                                            {(field) => (
                                                <TextField.Root field={field()}>
                                                    <TextField.Label>Correo Electrónico</TextField.Label>
                                                    <TextField.Input type="text" placeholder="contacto@empresa.com" />
                                                    <TextField.ErrorMessage />
                                                </TextField.Root>
                                            )}
                                        </form.Field>
                                    </div>

                                    <form.Field name="mainAddress">
                                        {(field) => (
                                            <TextField.Root field={field()}>
                                                <TextField.Label>Dirección Matriz *</TextField.Label>
                                                <TextField.Input type="text" placeholder="Dirección física autorizada por el SRI" />
                                                <TextField.ErrorMessage />
                                            </TextField.Root>
                                        )}
                                    </form.Field>
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
                                                cropShape="circle"
                                                cropAspectRatio={1}
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
