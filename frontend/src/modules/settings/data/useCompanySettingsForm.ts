import { createSignal, createEffect, onCleanup, untrack } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { CompanySettingsFormSchema, type CompanySettingsFormData } from '@app/schema/frontend';
import { toast } from 'solid-sonner';
import { useCompanyBranding } from './branding.queries';
import { useUpdateSettingsBranding } from './branding.mutations';

/**
 * Shared hook for company settings forms.
 * Extracts the identical boilerplate shared by BrandingSettings, CompanyProfileSettings, and FiscalSettings:
 *   - createForm() with 17 default fields
 *   - createEffect() to sync query data → form fields
 *   - Logo and login background preview signals
 *   - Submit handler with mutation + toast
 */
export function useCompanySettingsForm(options?: { onSuccessMessage?: string }) {
    const brandingQuery = useCompanyBranding();
    const updateBrandingMut = useUpdateSettingsBranding();

    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);
    const [logoPreviewUrl, setLogoPreviewUrl] = createSignal<string | null>(null);
    const [loginBgPreviewUrl, setLoginBgPreviewUrl] = createSignal<string | null>(null);

    const form = createForm(() => ({
        defaultValues: {
            logoUrl: null,
            loginBgUrl: null,
            primaryColor: '#6366f1',
            themeColor: '#64748b',
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
            rimpeType: 'GENERAL',
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
                    toast.success(options?.onSuccessMessage || 'Guardado correctamente');
                },
            });
        },
    }));

    // Sync query data → form fields
    createEffect(() => {
        const data = brandingQuery.data;
        if (data) {
            untrack(() => {
                form.setFieldValue('logoUrl', data.logoUrl);
                form.setFieldValue('loginBgUrl', data.loginBgUrl);
                form.setFieldValue('primaryColor', data.primaryColor);
                form.setFieldValue('themeColor', data.themeColor);
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

    // Logo preview URL (File object or string URL)
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

    // Login background preview URL
    createEffect(() => {
        const bgVal = form.state.values.loginBgUrl;
        if (bgVal instanceof File) {
            const url = URL.createObjectURL(bgVal);
            setLoginBgPreviewUrl(url);
            onCleanup(() => URL.revokeObjectURL(url));
        } else if (typeof bgVal === 'string') {
            setLoginBgPreviewUrl(bgVal);
        } else {
            setLoginBgPreviewUrl(null);
        }
    });

    return {
        form,
        brandingQuery,
        updateBrandingMut,
        hasAttemptedSubmit,
        setHasAttemptedSubmit,
        logoPreviewUrl,
        loginBgPreviewUrl,
    };
}
