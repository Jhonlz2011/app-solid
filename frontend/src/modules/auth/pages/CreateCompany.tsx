import { Component, createSignal, Show, For } from 'solid-js';
import { toast } from 'solid-sonner';
import { useNavigate } from '@tanstack/solid-router';
import { createForm } from '@tanstack/solid-form';
import { RegisterStep2Schema } from '@app/schema/frontend';
import { isGlobalPortalHost, buildTenantUrl } from '@app/schema/utils';
import { authApi } from '@modules/auth/api/auth.api';
import { authClient } from '@shared/lib/auth-client';
import { fetchUserOrganizations, invalidateOrgCache } from '../utils/resolve-routing';
import { actions, useAuth } from '@modules/auth/store/auth.store';
import Button from '@form/Button';
import { FormSubmissionContext } from '@shared/ui/form/form.types';
import Turnstile from '@shared/ui/Turnstile';
import { getFriendlyErrorMessage } from '@shared/utils/api-errors';
import CompanyFields, { type CompanyFieldsStatus } from '../components/CompanyFields';
import CompanySummaryCard from '../components/CompanySummaryCard';

const CreateCompanyStepper: Component<{ current: number }> = (props) => {
    const steps = ['Datos de Empresa', 'Confirmar y Crear'];
    return (
        <div class="flex items-center justify-center gap-2 mb-6">
            <For each={steps}>{(label, i) => (
                <div class="flex items-center gap-2">
                    <div class={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                        i() < props.current ? 'bg-primary text-on-primary' :
                        i() === props.current ? 'bg-primary/20 text-primary border-2 border-primary' :
                        'bg-card-alt text-muted border border-border'
                    }`}>
                        <Show when={i() < props.current} fallback={i() + 1}>
                            <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                            </svg>
                        </Show>
                    </div>
                    <span class={`text-xs font-medium hidden sm:inline ${i() <= props.current ? 'text-text' : 'text-muted'}`}>
                        {label}
                    </span>
                    <Show when={i() < steps.length - 1}>
                        <div class={`w-12 h-0.5 ${i() < props.current ? 'bg-primary' : 'bg-border'} transition-colors duration-300`} />
                    </Show>
                </div>
            )}</For>
        </div>
    );
};

export const CreateCompany: Component = () => {
    const navigate = useNavigate();
    const auth = useAuth();

    const [step, setStep] = createSignal(0);
    const [stepSubmitted, setStepSubmitted] = createSignal(false);
    const [submitting, setSubmitting] = createSignal(false);

    // Turnstile
    const [turnstileToken, setTurnstileToken] = createSignal<string | null>(null);
    let turnstileActions: { reset: () => void } | undefined;

    // Status from CompanyFields
    let fieldsStatus: CompanyFieldsStatus | undefined;

    const form = createForm(() => ({
        defaultValues: {
            slug: '',
            ruc: '',
            businessName: '',
            tradeName: undefined as string | undefined,
            businessType: '',
            mainAddress: undefined as string | undefined,
            taxRegime: 'GENERAL' as const,
            obligadoContabilidad: false,
            contribuyenteEspecial: undefined as string | undefined,
        },
        validators: { onSubmit: RegisterStep2Schema },
        onSubmit: async () => {
            setStep(1);
        },
    }));

    const handleCreateCompany = async () => {
        const values = form.state.values;
        setSubmitting(true);
        try {
            const res = await authApi.onboard({
                slug: values.slug,
                ruc: values.ruc,
                businessName: values.businessName,
                tradeName: values.tradeName || undefined,
                businessType: values.businessType || undefined,
                mainAddress: values.mainAddress || undefined,
                obligadoContabilidad: values.obligadoContabilidad || undefined,
                contribuyenteEspecial: values.contribuyenteEspecial || undefined,
                taxRegime: values.taxRegime || undefined,
                turnstileToken: turnstileToken() ?? undefined,
            });

            // Force refresh cached organizations and activate the new organization in session
            invalidateOrgCache();
            const orgs = await fetchUserOrganizations(true);
            const matchingOrg = orgs.find(o => o.slug === values.slug) || (res.company?.organizationId ? orgs.find(o => o.id === res.company.organizationId) : orgs[0]);

            if (matchingOrg) {
                await authClient.organization.setActive({ organizationId: matchingOrg.id });
            }

            await actions.initSession();
            toast.success(`¡Empresa "${values.businessName}" creada exitosamente!`);

            const isGlobal = isGlobalPortalHost(window.location.hostname);
            if (isGlobal && values.slug) {
                window.location.href = buildTenantUrl(values.slug, '/dashboard', { queryParams: { session: 'true' } });
            } else {
                window.location.href = buildTenantUrl(values.slug, '/dashboard', { queryParams: { session: 'true' } });
            }
        } catch (err: any) {
            setTurnstileToken(null);
            turnstileActions?.reset();
            toast.error(getFriendlyErrorMessage(err, 'Error al registrar la nueva empresa'));
        } finally {
            setSubmitting(false);
        }
    };

    const isNextDisabled = () => {
        if (!fieldsStatus) return false;
        return !fieldsStatus.isValidForSubmit();
    };

    return (
        <div class="max-w-2xl mx-auto py-8 px-4 sm:px-6">
            <div class="p-6 sm:p-8 bg-card border border-border rounded-2xl shadow-xl">
                {/* Header */}
                <div class="mb-6 pb-4 border-b border-border">
                    <div class="flex items-center justify-between">
                        <div>
                            <h1 class="text-2xl font-bold text-heading">Registrar nueva empresa</h1>
                            <p class="text-muted text-sm mt-1">
                                Crea y aprovisiona un nuevo espacio de trabajo independiente para tu cuenta.
                            </p>
                        </div>
                        <div class="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-medium">
                            <span class="size-2 rounded-full bg-primary animate-pulse" />
                            <span>{auth.user()?.email}</span>
                        </div>
                    </div>
                </div>

                <CreateCompanyStepper current={step()} />

                {/* ─── STEP 0: Company Info ─── */}
                <Show when={step() === 0}>
                    <FormSubmissionContext.Provider value={stepSubmitted}>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                setStepSubmitted(true);
                                form.handleSubmit();
                            }}
                            class="flex flex-col gap-4"
                            novalidate
                        >
                            <CompanyFields
                                form={form}
                                stepSubmitted={stepSubmitted}
                                onStatusChange={(status) => { fieldsStatus = status; }}
                            />

                            <div class="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-border">
                                <Button
                                    variant="outline"
                                    type="button"
                                    onClick={() => navigate({ to: '/dashboard' })}
                                >
                                    Cancelar
                                </Button>
                                <form.Subscribe
                                    selector={(s) => ({ isSubmitting: s.isSubmitting })}
                                    children={(s) => (
                                        <Button
                                            type="submit"
                                            disabled={isNextDisabled() || s().isSubmitting}
                                            loading={s().isSubmitting}
                                            loadingText="Validando…"
                                        >
                                            Continuar
                                        </Button>
                                    )}
                                />
                            </div>
                        </form>
                    </FormSubmissionContext.Provider>
                </Show>

                {/* ─── STEP 1: Confirmation & Creation ─── */}
                <Show when={step() === 1}>
                    <div class="space-y-4">
                        <CompanySummaryCard data={form.state.values} />

                        {/* Cloudflare Turnstile */}
                        <Turnstile
                            action="register"
                            ref={(act) => { turnstileActions = act; }}
                            onToken={(token) => setTurnstileToken(token)}
                            onExpire={() => setTurnstileToken(null)}
                            onError={() => setTurnstileToken(null)}
                        />

                        <div class="flex items-center justify-between gap-3 pt-4 border-t border-border">
                            <Button
                                variant="outline"
                                type="button"
                                onClick={() => setStep(0)}
                                disabled={submitting()}
                            >
                                Atrás
                            </Button>
                            <Button
                                disabled={submitting() || !turnstileToken()}
                                loading={submitting() || !turnstileToken()}
                                loadingText={!turnstileToken() ? "Verificando seguridad…" : "Creando empresa…"}
                                onClick={handleCreateCompany}
                            >
                                Crear y activar empresa
                            </Button>
                        </div>
                    </div>
                </Show>
            </div>
        </div>
    );
};

export default CreateCompany;
