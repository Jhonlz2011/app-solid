import { Component, createSignal, Show, For, createEffect } from 'solid-js';
import { toast } from 'solid-sonner';
import { useNavigate } from '@tanstack/solid-router';
import { createForm } from '@tanstack/solid-form';
import { RegisterStep1Schema, RegisterStep2Schema } from '@app/schema/frontend';
import { isGlobalPortalHost, buildTenantUrl } from '@app/schema/utils';
import { authApi } from '@modules/auth/api/auth.api';
import { authClient } from '@shared/lib/auth-client';
import { fetchUserOrganizations, invalidateOrgCache } from '../utils/resolve-routing';
import { actions, useAuth } from '@modules/auth/store/auth.store';
import TextField from '@form/TextField';
import Button from '@form/Button';
import OAuthButtons from '../components/OAuthButtons';
import { FormSubmissionContext } from '@shared/ui/form/form.types';
import Turnstile from '@shared/ui/Turnstile';
import { getFriendlyErrorMessage } from '@shared/utils/api-errors';
import CompanyFields, { type CompanyFieldsStatus } from '../components/CompanyFields';
import CompanySummaryCard from '../components/CompanySummaryCard';
import AuthStepper from '../components/AuthStepper';
import { Badge } from '@shared/ui/display/Badge';

// ─── Password Strength Meter ───
const PasswordStrength: Component<{ password: string }> = (props) => {
    const strength = () => {
        const p = props.password;
        if (!p) return 0;
        let s = 0;
        if (p.length >= 8) s++;
        if (/[A-Z]/.test(p)) s++;
        if (/[0-9]/.test(p)) s++;
        if (/[^A-Za-z0-9]/.test(p)) s++;
        return s;
    };
    const label = () => ['', 'Débil', 'Regular', 'Buena', 'Fuerte'][strength()];
    const color = () => ['bg-border', 'bg-danger', 'bg-warning', 'bg-primary', 'bg-success'][strength()];
    return (
        <Show when={props.password}>
            <div class="flex items-center gap-2 mt-1 px-1">
                <div class="flex-1 flex gap-1">
                    <For each={[0, 1, 2, 3]}>{(i) => (
                        <div class={`h-1 flex-1 rounded-full transition-colors duration-300 ${i < strength() ? color() : 'bg-border'}`} />
                    )}</For>
                </div>
                <span class="text-xs text-muted font-medium">{label()}</span>
            </div>
        </Show>
    );
};

// ─── Main Component ───
const Register: Component = () => {
    const navigate = useNavigate();
    const auth = useAuth();
    const isOAuthUser = () => auth.isAuthenticated() && !auth.user()?.companySlug && (!auth.user()?.companyId || auth.user()?.companyId === 0);

    const [step, setStep] = createSignal(0);
    const [step1Submitted, setStep1Submitted] = createSignal(false);
    const [step2Submitted, setStep2Submitted] = createSignal(false);

    // Turnstile token — captured in step 3 (confirmation)
    const [turnstileToken, setTurnstileToken] = createSignal<string | null>(null);
    let turnstileActions: { reset: () => void } | undefined;

    const [submitting, setSubmitting] = createSignal(false);

    // Status from CompanyFields
    let step2FieldsStatus: CompanyFieldsStatus | undefined;

    // ─── STEP 1 FORM ───
    const step1Form = createForm(() => ({
        defaultValues: {
            fullName: auth.user()?.name || auth.user()?.username || '',
            username: auth.user()?.username || '',
            email: auth.user()?.email || '',
            password: '',
            phone: undefined as string | undefined,
            cedula: undefined as string | undefined,
        },
        validators: { onSubmit: RegisterStep1Schema },
        onSubmit: async () => {
            setStep(1);
        },
    }));

    // Auto-redirect authenticated users with existing companies to /create-company
    createEffect(() => {
        if (auth.isAuthenticated() && (auth.user()?.companySlug || (auth.user()?.companyId && auth.user()?.companyId !== 0))) {
            navigate({ to: '/create-company', replace: true });
        }
    });

    // Auto-onboarding for OAuth user reactively when user session becomes available
    createEffect(() => {
        if (isOAuthUser() && step() === 0) {
            const u = auth.user();
            if (u) {
                step1Form.setFieldValue('fullName', u.name || u.username || '');
                step1Form.setFieldValue('username', u.username || '');
                step1Form.setFieldValue('email', u.email || '');
                step1Form.setFieldValue('password', 'OAuthPass123!');
                setStep(1);
                toast.info(`¡Hola ${u.name || u.username || ''}! Completa los datos de tu empresa para comenzar.`);
            }
        }
    });

    const handleCancelOAuth = async () => {
        try {
            await actions.logout();
            toast.info('Registro cancelado. Sesión cerrada.');
            navigate({ to: '/login', search: { redirect: undefined }, replace: true });
        } catch (err) {
            toast.error('Error al cerrar la sesión');
        }
    };

    // ─── STEP 2 FORM ───
    const step2Form = createForm(() => ({
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
            setStep(2);
        },
    }));

    // ─── Final Submit ───
    const handleFinalSubmit = async () => {
        const s1 = step1Form.state.values;
        const s2 = step2Form.state.values;
        setSubmitting(true);
        try {
            if (isOAuthUser()) {
                // Caso Onboarding: el usuario ya está autenticado con Google/Microsoft
                const res = await authApi.onboard({
                    slug: s2.slug,
                    ruc: s2.ruc,
                    businessName: s2.businessName,
                    tradeName: s2.tradeName || undefined,
                    businessType: s2.businessType || undefined,
                    mainAddress: s2.mainAddress || undefined,
                    obligadoContabilidad: s2.obligadoContabilidad || undefined,
                    contribuyenteEspecial: s2.contribuyenteEspecial || undefined,
                    taxRegime: s2.taxRegime || undefined,
                    phone: s1.phone || undefined,
                    cedula: s1.cedula || undefined,
                    turnstileToken: turnstileToken() ?? undefined,
                });

                // Set active organization in Better-Auth session (force refresh to pick up new org)
                invalidateOrgCache();
                const orgs = await fetchUserOrganizations(true);
                const matchingOrg = orgs.find(o => o.slug === s2.slug) || orgs[0];
                if (matchingOrg) {
                    await authClient.organization.setActive({ organizationId: matchingOrg.id });
                }

                await actions.initSession();
                toast.success('¡Empresa creada exitosamente!');

                const isGlobal = isGlobalPortalHost(window.location.hostname);
                if (isGlobal && s2.slug) {
                    window.location.href = buildTenantUrl(s2.slug, '/dashboard', { queryParams: { session: 'true' } });
                } else {
                    navigate({ to: '/dashboard', replace: true });
                }
                return;
            }

            // Caso Registro Estándar (Email + Password)
            await authApi.register({
                fullName: s1.fullName,
                username: s1.username,
                email: s1.email,
                password: s1.password,
                phone: s1.phone || undefined,
                cedula: s1.cedula || undefined,
                slug: s2.slug,
                ruc: s2.ruc,
                businessName: s2.businessName,
                tradeName: s2.tradeName || undefined,
                businessType: s2.businessType || undefined,
                mainAddress: s2.mainAddress || undefined,
                obligadoContabilidad: s2.obligadoContabilidad || undefined,
                contribuyenteEspecial: s2.contribuyenteEspecial || undefined,
                taxRegime: s2.taxRegime || undefined,
                turnstileToken: turnstileToken() ?? undefined,
            });

            // Automatic sign-in via Better-Auth
            const signInRes = await authClient.signIn.email({
                email: s1.email,
                password: s1.password,
            });

            if (signInRes.error) {
                toast.success('¡Empresa creada exitosamente! Por favor inicia sesión.');
                navigate({ to: '/login', search: { redirect: undefined }, replace: true });
                return;
            }

            // Set active organization in Better-Auth session (force refresh to pick up new org)
            invalidateOrgCache();
            const orgs = await fetchUserOrganizations(true);
            const matchingOrgStd = orgs.find(o => o.slug === s2.slug) || orgs[0];
            if (matchingOrgStd) {
                await authClient.organization.setActive({ organizationId: matchingOrgStd.id });
            }

            await actions.initSession();

            // Verification email is already dispatched atomically by the backend register endpoint
            sessionStorage.setItem('resend_cooldown_until', String(Date.now() + 60000));
            toast.success('¡Cuenta creada exitosamente!');

            const isGlobal = isGlobalPortalHost(window.location.hostname);
            if (isGlobal && s2.slug) {
                window.location.href = buildTenantUrl(s2.slug, '/dashboard', { queryParams: { session: 'true' } });
            } else {
                navigate({ to: '/dashboard', replace: true });
            }
        } catch (err: any) {
            setTurnstileToken(null);
            turnstileActions?.reset();
            toast.error(getFriendlyErrorMessage(err, 'Error al registrar la empresa'));
        } finally {
            setSubmitting(false);
        }
    };

    const isStep2NextDisabled = () => {
        if (!step2FieldsStatus) return false;
        return !step2FieldsStatus.isValidForSubmit();
    };

    const stepperSteps = () => isOAuthUser() ? ['Usuario', 'Empresa', 'Confirmar'] : ['Usuario', 'Empresa', 'Confirmar'];

    return (
        <div class="w-full p-6 sm:p-8 bg-card border border-border rounded-2xl shadow-xl">
            <AuthStepper steps={stepperSteps()} current={step()} />

            {/* ─── STEP 1: User ─── */}
            <Show when={step() === 0}>
                <div class="mb-4">
                    <h2 class="text-2xl font-bold text-heading">Crear cuenta</h2>
                    <p class="text-muted text-sm mt-1">Ingresa tus datos personales para registrarte</p>
                </div>

                <FormSubmissionContext.Provider value={step1Submitted}>
                    <form onSubmit={(e) => { e.preventDefault(); setStep1Submitted(true); step1Form.handleSubmit(); }} class="flex flex-col gap-4" novalidate>
                        <step1Form.Field name="fullName" children={(f) => (
                            <TextField.Root field={f()}>
                                <TextField.Label>Nombre completo *</TextField.Label>
                                <TextField.Input type="text" placeholder="Ej: Juan Pérez" autocomplete="name" />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )} />
                        <step1Form.Field name="username" children={(f) => (
                            <TextField.Root field={f()}>
                                <TextField.Label>Nombre de usuario *</TextField.Label>
                                <TextField.Input type="text" placeholder="ej: juan.perez" autocomplete="username"
                                    onInput={(e) => {
                                        const v = e.currentTarget.value.toLowerCase().replace(/[^a-z0-9._-]/g, '');
                                        e.currentTarget.value = v;
                                        f().handleChange(v);
                                    }} />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )} />
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <step1Form.Field name="phone" children={(f) => (
                                <TextField.Root field={f()}>
                                    <TextField.Label optional>Teléfono</TextField.Label>
                                    <TextField.Input type="tel" placeholder="0999999999" />
                                    <TextField.ErrorMessage />
                                </TextField.Root>
                            )} />
                            <step1Form.Field name="cedula" children={(f) => (
                                <TextField.Root field={f()}>
                                    <TextField.Label optional>Cédula</TextField.Label>
                                    <TextField.Input type="text" placeholder="0912345678" />
                                    <TextField.ErrorMessage />
                                </TextField.Root>
                            )} />
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                            <step1Form.Field name="email" children={(f) => (
                                <TextField.Root field={f()}>
                                    <TextField.Label>Correo electrónico *</TextField.Label>
                                    <TextField.Input type="email" placeholder="correo@ejemplo.com" autocomplete="email" disabled={isOAuthUser()} />
                                    <TextField.ErrorMessage />
                                </TextField.Root>
                            )} />
                            <Show when={!isOAuthUser()}>
                                <step1Form.Field name="password" children={(f) => (
                                    <div class="flex flex-col gap-1">
                                        <TextField.Root field={f()}>
                                            <TextField.Label>Contraseña *</TextField.Label>
                                            <TextField.PasswordInput placeholder="Mínimo 8 caracteres" autocomplete="new-password" />
                                            <TextField.ErrorMessage />
                                        </TextField.Root>
                                        <PasswordStrength password={f().state.value} />
                                    </div>
                                )} />
                            </Show>
                        </div>
                        <step1Form.Subscribe selector={(s) => ({ isSubmitting: s.isSubmitting, isDirty: s.isDirty })}
                            children={(s) => (
                                <Button class="mt-2" type="submit" fullWidth disabled={(!isOAuthUser() && !s().isDirty) || s().isSubmitting}
                                    loading={s().isSubmitting} loadingText="Validando…">
                                    Siguiente
                                </Button>
                            )} />

                        {/* ── OAuth Social Providers ── */}
                        <Show when={!isOAuthUser()}>
                            <div class="relative flex items-center justify-center my-2">
                                <div class="grow border-t border-border" />
                                <span class="px-3 text-xs text-muted font-medium uppercase tracking-wider bg-card">o regístrate con</span>
                                <div class="grow border-t border-border" />
                            </div>

                            <OAuthButtons mode="register" />
                        </Show>

                        <div class="text-sm text-muted mt-2 text-center">
                            ¿Ya tienes cuenta?{' '}
                            <a href="/login" class="text-primary hover:underline font-medium" onClick={(e) => { e.preventDefault(); navigate({ to: '/login', search: { redirect: undefined } }); }}>
                                Inicia sesión
                            </a>
                        </div>
                    </form>
                </FormSubmissionContext.Provider>
            </Show>

            {/* ─── STEP 2: Company ─── */}
            <Show when={step() === 1}>
                <Show when={isOAuthUser()}>
                    <div class="flex items-center justify-between gap-3 p-3 mb-4 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-medium">
                        <div class="flex items-center gap-2 min-w-0">
                            <span class="size-2 rounded-full bg-primary animate-pulse shrink-0" />
                            <span class="truncate">Autenticado como <strong>{auth.user()?.email}</strong></span>
                        </div>
                        <Badge variant="primary" onClick={handleCancelOAuth} class="cursor-pointer hover:bg-primary/20 transition-colors text-[11px]">
                            Cambiar cuenta / Salir
                        </Badge>
                    </div>
                </Show>

                <div class="mb-4">
                    <h2 class="text-2xl font-bold text-heading">Datos de empresa</h2>
                    <p class="text-muted text-sm mt-1">Configura la información fiscal y comercial de tu negocio</p>
                </div>

                <FormSubmissionContext.Provider value={step2Submitted}>
                    <form onSubmit={(e) => { e.preventDefault(); setStep2Submitted(true); step2Form.handleSubmit(); }} class="flex flex-col gap-4" novalidate>
                        <CompanyFields
                            form={step2Form}
                            stepSubmitted={step2Submitted}
                            onStatusChange={(s) => { step2FieldsStatus = s; }}
                        />

                        <div class="flex items-center gap-3 mt-4 pt-4 border-t border-border">
                            <Show
                                when={!isOAuthUser()}
                                fallback={
                                    <Button variant="outline" type="button" onClick={handleCancelOAuth}>
                                        Cancelar
                                    </Button>
                                }
                            >
                                <Button variant="outline" type="button" onClick={() => setStep(0)}>
                                    Atrás
                                </Button>
                            </Show>
                            <step2Form.Subscribe selector={(s) => ({ isSubmitting: s.isSubmitting })}
                                children={(s) => (
                                    <Button type="submit" fullWidth
                                        disabled={isStep2NextDisabled() || s().isSubmitting}
                                        loading={s().isSubmitting} loadingText="Validando…">
                                        Siguiente
                                    </Button>
                                )} />
                        </div>
                    </form>
                </FormSubmissionContext.Provider>
            </Show>

            {/* ─── STEP 3: Confirmation ─── */}
            <Show when={step() === 2}>
                <div class="mb-4">
                    <h2 class="text-2xl font-bold text-heading">Confirmar registro</h2>
                    <p class="text-muted text-sm mt-1">Revisa los datos antes de crear y activar tu cuenta</p>
                </div>

                <div class="space-y-4">
                    {/* User Summary */}
                    <div class="bg-card-alt border border-border rounded-xl p-4 space-y-2">
                        <h3 class="text-sm font-semibold text-primary flex items-center gap-2">
                            <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" /></svg>
                            Datos del Usuario
                        </h3>
                        <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm pt-1">
                            <span class="text-muted">Nombre:</span><span class="text-text font-medium">{step1Form.state.values.fullName}</span>
                            <span class="text-muted">Usuario:</span><span class="text-text font-medium">{step1Form.state.values.username}</span>
                            <span class="text-muted">Email:</span><span class="text-text font-medium">{step1Form.state.values.email}</span>
                            <Show when={step1Form.state.values.phone}><span class="text-muted">Teléfono:</span><span class="text-text">{step1Form.state.values.phone}</span></Show>
                            <Show when={step1Form.state.values.cedula}><span class="text-muted">Cédula:</span><span class="text-text">{step1Form.state.values.cedula}</span></Show>
                        </div>
                    </div>

                    {/* Company Summary (DRY component) */}
                    <CompanySummaryCard data={step2Form.state.values} />
                </div>

                {/* Cloudflare Turnstile */}
                <Turnstile
                    action="register"
                    ref={(act) => { turnstileActions = act; }}
                    onToken={(token) => setTurnstileToken(token)}
                    onExpire={() => setTurnstileToken(null)}
                    onError={() => setTurnstileToken(null)}
                />

                <div class="flex items-center gap-3 pt-4 border-t border-border mt-4">
                    <Button variant="outline" type="button" onClick={() => setStep(1)} disabled={submitting()}>Atrás</Button>
                    <Button
                        fullWidth
                        disabled={submitting() || !turnstileToken()}
                        loading={submitting() || !turnstileToken()}
                        loadingText={!turnstileToken() ? "Verificando seguridad…" : "Creando cuenta…"}
                        onClick={handleFinalSubmit}
                    >
                        Crear cuenta
                    </Button>
                </div>
            </Show>
        </div>
    );
};

export default Register;
