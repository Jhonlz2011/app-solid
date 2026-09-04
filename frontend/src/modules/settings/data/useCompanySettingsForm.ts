import { createSignal, createEffect, createMemo, onCleanup, untrack } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import {
    CompanySettingsFormSchema,
    type CompanySettingsFormData,
} from '@app/schema/frontend';
import type { CropCoordinates } from '@app/schema/dto';
import { BRANDING_DEFAULTS } from '@app/schema/utils';
import { toast } from 'solid-sonner';
import { useCompanyBranding } from './branding.queries';
import { useUpdateSettingsBranding } from './branding.mutations';

/**
 * Serializes a CompanySettingsFormData into a stable JSON string for dirty comparison.
 * Single source of truth for which fields are compared — avoids repeating the list.
 */
function snapshotFields(source: CompanySettingsFormData): string {
    return JSON.stringify({
        logoUrl: source.logoUrl,
        loginBgUrl: source.loginBgUrl,
        primaryColor: source.primaryColor,
        themeColor: source.themeColor,
        businessName: source.businessName,
        tradeName: source.tradeName,
        ruc: source.ruc,
        mainAddress: source.mainAddress,
        businessType: source.businessType,
        email: source.email,
        phone: source.phone,
        obligadoContabilidad: source.obligadoContabilidad,
        contribuyenteEspecial: source.contribuyenteEspecial,
        agenteRetencion: source.agenteRetencion,
        rimpeType: source.rimpeType,
        sriEnvironment: source.sriEnvironment,
    });
}

export interface UseCompanySettingsFormOptions {
    onSuccessMessage?: string;
    schema?: any;
    fieldsSubset?: (keyof CompanySettingsFormData)[];
}

/**
 * Shared hook for company settings forms.
 * Supports specialized modular schemas per view (Branding, Profile, Fiscal)
 * and partial updates to prevent race conditions and cross-tab ghost validation errors.
 */
export function useCompanySettingsForm(options?: UseCompanySettingsFormOptions) {
    const brandingQuery = useCompanyBranding();
    const updateBrandingMut = useUpdateSettingsBranding();

    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);
    const [logoPreviewUrl, setLogoPreviewUrl] = createSignal<string | null>(null);
    const [loginBgPreviewUrl, setLoginBgPreviewUrl] = createSignal<string | null>(null);
    const [loginBgCropDetails, setLoginBgCropDetails] = createSignal<CropCoordinates | undefined>();

    const form = createForm(() => ({
        defaultValues: {
            logoUrl: null,
            loginBgUrl: null,
            primaryColor: BRANDING_DEFAULTS.primaryColor,
            themeColor: BRANDING_DEFAULTS.themeColor,
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
        validators: {
            onChange: options?.schema || CompanySettingsFormSchema,
            onSubmit: options?.schema || CompanySettingsFormSchema,
        },
        onSubmit: async ({ value }) => {
            const bodyPayload: Partial<CompanySettingsFormData> = options?.fieldsSubset
                ? options.fieldsSubset.reduce((acc, key) => {
                      (acc as Record<string, unknown>)[key] = value[key];
                      return acc;
                  }, {} as Partial<CompanySettingsFormData>)
                : value;

            updateBrandingMut.mutate(
                { body: bodyPayload as CompanySettingsFormData, loginBgCrop: loginBgCropDetails() },
                {
                    onSuccess: () => {
                        toast.success(options?.onSuccessMessage || 'Guardado correctamente');
                    },
                }
            );
        },
    }));

    // Sync query data → form fields
    // Store the last synced server data for manual dirty comparison
    const [serverBaseline, setServerBaseline] = createSignal<string>('');

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

                setServerBaseline(snapshotFields(data as CompanySettingsFormData));
            });
        }
    });

    const formValues = form.useStore((s) => s.values);

    const isFormDirty = createMemo(() => {
        const baseline = serverBaseline();
        if (!baseline) return false;
        const v = formValues();

        if (options?.fieldsSubset) {
            try {
                const baselineParsed = JSON.parse(baseline);
                return options.fieldsSubset.some((key) => {
                    if (v[key] instanceof File) return true;
                    return v[key] !== baselineParsed[key];
                });
            } catch {
                return false;
            }
        }

        if (v.logoUrl instanceof File || v.loginBgUrl instanceof File) return true;
        return snapshotFields(v) !== baseline;
    });

    // Logo preview URL (File object or string URL)
    createEffect(() => {
        const logoVal = formValues().logoUrl;
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
        const bgVal = formValues().loginBgUrl;
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
        setLoginBgCropDetails,
        isFormDirty,
    };
}
