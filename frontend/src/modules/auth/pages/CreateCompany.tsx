import { Component, createSignal, Show } from 'solid-js';
import { toast } from 'solid-sonner';
import { useNavigate } from '@tanstack/solid-router';
import { createForm } from '@tanstack/solid-form';
import { RegisterStep2Schema, type RegisterStep2Data } from '@app/schema/frontend';
import { authApi } from '@modules/auth/api/auth.api';
import { activateNewTenantAndRedirect } from '../utils/resolve-routing';
import { useAuth } from '@modules/auth/store/auth.store';
import Button from '@form/Button';
import { FormSubmissionContext } from '@shared/ui/form/form.types';
import Turnstile from '@shared/ui/Turnstile';
import { getFriendlyErrorMessage } from '@shared/utils/api-errors';
import CompanyFields from '../components/CompanyFields';
import CompanySummaryCard from '../components/CompanySummaryCard';
import AuthStepper from '../components/AuthStepper';
import { ScrollArea } from '@/layout/components/ScrollArea';
import { Badge } from '@shared/ui/display/Badge';

export const CreateCompany: Component = () => {
    const navigate = useNavigate();
    const auth = useAuth();

    const [step, setStep] = createSignal(0);
    const [stepSubmitted, setStepSubmitted] = createSignal(false);
    const [submitting, setSubmitting] = createSignal(false);

    // Turnstile
    const [turnstileToken, setTurnstileToken] = createSignal<string | null>(null);
    let turnstileActions: { reset: () => void } | undefined;

    const form = createForm(() => ({
        defaultValues: {
            slug: '',
            ruc: '',
            businessName: '',
            tradeName: undefined,
            businessType: '',
            mainAddress: undefined,
            taxRegimeType: 'GENERAL' as const,
            obligadoContabilidad: false,
            contribuyenteEspecial: undefined,
        } as RegisterStep2Data,
        validators: {
            onChange: RegisterStep2Schema,
            onSubmit: RegisterStep2Schema,
        },
        onSubmit: async () => {
            setStep(1);
        },
    }));

    const handleCreateCompany = async () => {
        const values = form.state.values;
        setSubmitting(true);
        try {
            const res = await authApi.createCompany({
                slug: values.slug,
                ruc: values.ruc,
                businessName: values.businessName,
                tradeName: values.tradeName || undefined,
                businessType: values.businessType || undefined,
                mainAddress: values.mainAddress || undefined,
                obligadoContabilidad: values.obligadoContabilidad || undefined,
                contribuyenteEspecial: values.contribuyenteEspecial || undefined,
                taxRegimeType: values.taxRegimeType || undefined,
                turnstileToken: turnstileToken() ?? undefined,
            });

            // Force refresh cached organizations, activate, and redirect
            toast.success(`¡Empresa "${values.businessName}" creada exitosamente!`);

            const navigatedLocally = await activateNewTenantAndRedirect(values.slug);
            if (navigatedLocally) {
                navigate({ to: '/dashboard', replace: true });
            }
        } catch (err: any) {
            setTurnstileToken(null);
            turnstileActions?.reset();
            toast.error(getFriendlyErrorMessage(err, 'Error al registrar la nueva empresa'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <ScrollArea resetKey={step()}>
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
                            <div class="hidden sm:flex items-center gap-2">
                                <Badge variant="primary" class="gap-1.5 px-3 py-1 text-xs">
                                    <span class="size-2 rounded-full bg-primary animate-pulse" />
                                    <span>{auth.user()?.email}</span>
                                </Badge>
                            </div>
                        </div>
                    </div>

                    <AuthStepper steps={['Datos de Empresa', 'Confirmar y Crear']} current={step()} />

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
                                        selector={(s) => ({
                                            isSubmitting: s.isSubmitting,
                                            isValidating: s.isValidating,
                                            canSubmit: s.canSubmit,
                                        })}
                                        children={(s) => (
                                            <Button
                                                type="submit"
                                                disabled={!s().canSubmit || s().isSubmitting}
                                                loading={s().isSubmitting || s().isValidating}
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

                            <div class="flex items-center justify-between gap-3 pt-4 border-t border-border mt-4">
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
        </ScrollArea>
    );
};

export default CreateCompany;
