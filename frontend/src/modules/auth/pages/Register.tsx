import { Component, createSignal, Show, For, onCleanup } from 'solid-js';
import { toast } from 'solid-sonner';
import { useNavigate } from '@tanstack/solid-router';
import { createForm } from '@tanstack/solid-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { RegisterStep1Schema, RegisterStep2Schema, type RegisterStep1Data } from '@app/schema/frontend';
import { BUSINESS_TYPES, TAX_REGIME_TYPES } from '@app/schema/enums';
import { authApi } from '@modules/auth/api/auth.api';
import { actions } from '@modules/auth/store/auth.store';
import TextField from '@shared/ui/TextField';
import { FieldLabel } from '@shared/ui/TextField';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@shared/ui/Select';
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem, SegmentedControlItemInput, SegmentedControlItemLabel } from '@shared/ui/SegmentedControl';
import Button from '@shared/ui/Button';
import { FormSubmissionContext, hasFieldError, getFieldError } from '@shared/ui/form/form.types';

// ─── Option types for Select ───
interface SelectOption { value: string; label: string }

const businessTypeOptions: SelectOption[] = [...BUSINESS_TYPES].map(bt => ({
    value: bt, label: bt.charAt(0) + bt.slice(1).toLowerCase(),
}));

const taxRegimeOptions: SelectOption[] = [
    { value: 'GENERAL', label: 'Régimen General' },
    { value: 'RIMPE_NEGOCIO_POPULAR', label: 'RIMPE - Negocio Popular' },
    { value: 'RIMPE_EMPRENDEDOR', label: 'RIMPE - Emprendedor' },
];

// ─── Step Indicator ───
const Stepper: Component<{ current: number }> = (props) => {
    const steps = ['Usuario', 'Empresa', 'Confirmar'];
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
                            <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>
                        </Show>
                    </div>
                    <span class={`text-xs font-medium hidden sm:inline ${i() <= props.current ? 'text-text' : 'text-muted'}`}>{label}</span>
                    <Show when={i() < steps.length - 1}>
                        <div class={`w-8 h-0.5 ${i() < props.current ? 'bg-primary' : 'bg-border'} transition-colors duration-300`} />
                    </Show>
                </div>
            )}</For>
        </div>
    );
};

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
                    <For each={[0,1,2,3]}>{(i) => (
                        <div class={`h-1 flex-1 rounded-full transition-colors duration-300 ${i < strength() ? color() : 'bg-border'}`} />
                    )}</For>
                </div>
                <span class="text-xs text-muted">{label()}</span>
            </div>
        </Show>
    );
};

// ─── Main Component ───
const Register: Component = () => {
    const navigate = useNavigate();
    const [step, setStep] = createSignal(0);
    const [step1Submitted, setStep1Submitted] = createSignal(false);
    const [step2Submitted, setStep2Submitted] = createSignal(false);

    // Slug availability
    const [slugAvailable, setSlugAvailable] = createSignal<boolean | null>(null);
    const [slugChecking, setSlugChecking] = createSignal(false);
    // RUC availability
    const [rucAvailable, setRucAvailable] = createSignal<boolean | null>(null);
    const [rucChecking, setRucChecking] = createSignal(false);

    const [submitting, setSubmitting] = createSignal(false);

    // ─── STEP 1 FORM ───
    const step1Form = createForm(() => ({
        defaultValues: {
            fullName: '', email: '', password: '',
            phone: undefined as string | undefined,
            cedula: undefined as string | undefined,
        },
        validatorAdapter: valibotValidator(),
        validators: { onSubmit: RegisterStep1Schema },
        onSubmit: async () => {
            setStep(1);
        },
    }));

    // ─── STEP 2 FORM ───
    const step2Form = createForm(() => ({
        defaultValues: {
            slug: '', ruc: '', businessName: '',
            tradeName: undefined as string | undefined,
            businessType: '',
            mainAddress: undefined as string | undefined,
            taxRegime: 'GENERAL' as typeof TAX_REGIME_TYPES[number] | undefined,
            obligadoContabilidad: false,
            contribuyenteEspecial: undefined as string | undefined,
        },
        validatorAdapter: valibotValidator(),
        validators: { onSubmit: RegisterStep2Schema },
        onSubmit: async () => {
            setStep(2);
        },
    }));

    // ─── Slug debounce ───
    let slugTimer: ReturnType<typeof setTimeout>;
    onCleanup(() => clearTimeout(slugTimer));
    const checkSlug = (slug: string) => {
        clearTimeout(slugTimer);
        setSlugAvailable(null);
        if (slug.length < 3) return;
        setSlugChecking(true);
        slugTimer = setTimeout(async () => {
            try {
                const res = await authApi.checkSlug(slug);
                setSlugAvailable(res.available);
            } catch { setSlugAvailable(null); }
            finally { setSlugChecking(false); }
        }, 500);
    };

    // ─── RUC debounce ───
    let rucTimer: ReturnType<typeof setTimeout>;
    onCleanup(() => clearTimeout(rucTimer));
    const checkRuc = (ruc: string) => {
        clearTimeout(rucTimer);
        setRucAvailable(null);
        if (ruc.length !== 13) return;
        setRucChecking(true);
        rucTimer = setTimeout(async () => {
            try {
                const res = await authApi.checkRuc(ruc);
                setRucAvailable(res.available);
            } catch { setRucAvailable(null); }
            finally { setRucChecking(false); }
        }, 500);
    };

    // ─── Final Submit ───
    const handleFinalSubmit = async () => {
        const s1 = step1Form.state.values;
        const s2 = step2Form.state.values;
        setSubmitting(true);
        try {
            const result = await authApi.register({
                fullName: s1.fullName, email: s1.email, password: s1.password,
                phone: s1.phone || undefined, cedula: s1.cedula || undefined,
                slug: s2.slug, ruc: s2.ruc, businessName: s2.businessName,
                tradeName: s2.tradeName || undefined, businessType: s2.businessType || undefined,
                mainAddress: s2.mainAddress || undefined,
                obligadoContabilidad: s2.obligadoContabilidad || undefined,
                contribuyenteEspecial: s2.contribuyenteEspecial || undefined,
                taxRegime: s2.taxRegime || undefined,
            });
            // Direct session injection — no redundant GET /me
            const registerSuccess = result as { user: any; sessionId: string };
            actions.setSession(
                { ...registerSuccess.user, sessionId: registerSuccess.sessionId },
                registerSuccess.sessionId,
            );
            toast.success('¡Cuenta creada exitosamente!');
            navigate({ to: '/dashboard', replace: true });
        } catch (err: any) {
            toast.error(err?.message || 'Error al registrar');
        } finally { setSubmitting(false); }
    };

    return (
        <div class="w-full p-8 bg-card border border-border rounded-2xl shadow-lg">
            <Stepper current={step()} />

            {/* ─── STEP 1: User ─── */}
            <Show when={step() === 0}>
                <h2 class="text-2xl font-bold mb-1 text-dark">Crear cuenta</h2>
                <p class="text-muted text-sm mb-5">Ingresa tus datos personales</p>
                <FormSubmissionContext.Provider value={step1Submitted}>
                <form onSubmit={(e) => { e.preventDefault(); setStep1Submitted(true); step1Form.handleSubmit(); }} class="flex flex-col gap-4" novalidate>
                    <step1Form.Field name="fullName" children={(f) => (
                        <TextField.Root field={f()}>
                            <TextField.Label>Nombre completo</TextField.Label>
                            <TextField.Input type="text" placeholder="Ej: Juan Pérez" autocomplete="name" />
                            <TextField.ErrorMessage />
                        </TextField.Root>
                    )} />
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <step1Form.Field name="phone" children={(f) => (
                            <TextField.Root field={f()}>
                                <TextField.Label>Teléfono (opcional)</TextField.Label>
                                <TextField.Input type="tel" placeholder="0999999999" />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )} />
                        <step1Form.Field name="cedula" children={(f) => (
                            <TextField.Root field={f()}>
                                <TextField.Label>Cédula (opcional)</TextField.Label>
                                <TextField.Input type="text" placeholder="0912345678" />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )} />
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <step1Form.Field name="email" children={(f) => (
                            <TextField.Root field={f()}>
                                <TextField.Label>Correo electrónico</TextField.Label>
                                <TextField.Input type="email" placeholder="correo@ejemplo.com" autocomplete="email" />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )} />
                          <step1Form.Field name="password" children={(f) => (
                            <div class="flex flex-col gap-1">
                                <TextField.Root field={f()}>
                                    <TextField.Label>Contraseña</TextField.Label>
                                    <TextField.PasswordInput placeholder="Mínimo 8 caracteres" autocomplete="new-password" />
                                    <TextField.ErrorMessage />
                                </TextField.Root>
                                <PasswordStrength password={f().state.value} />
                            </div>
                        )} />
                    </div>
                    <step1Form.Subscribe selector={(s) => ({ isSubmitting: s.isSubmitting, isDirty: s.isDirty })}
                        children={(s) => (
                            <Button class="mt-1" type="submit" fullWidth disabled={!s().isDirty || s().isSubmitting}
                                loading={s().isSubmitting} loadingText="Validando…">
                                Siguiente
                            </Button>
                        )} />
                    <div class="text-sm text-muted mt-1 text-center">
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
                <h2 class="text-2xl font-bold mb-1 text-dark">Datos de empresa</h2>
                <p class="text-muted text-sm mb-5">Configuración de tu negocio</p>
                <FormSubmissionContext.Provider value={step2Submitted}>
                <form onSubmit={(e) => { e.preventDefault(); setStep2Submitted(true); step2Form.handleSubmit(); }} class="flex flex-col gap-4" novalidate>
                    {/* Slug */}
                    <step2Form.Field name="slug" children={(f) => (
                        <div>
                            <TextField.Root field={f()}>
                                <TextField.Label>Identificador único (slug)</TextField.Label>
                                <TextField.Input type="text" placeholder="mi-empresa"
                                    onInput={(e) => {
                                        const v = e.currentTarget.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                                        e.currentTarget.value = v;
                                        f().handleChange(v);
                                        checkSlug(v);
                                    }} />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                            <Show when={f().state.value.length >= 3}>
                                <div class="text-xs ml-1 mt-1">
                                    <Show when={slugChecking()}>
                                        <span class="text-muted">Verificando…</span>
                                    </Show>
                                    <Show when={!slugChecking() && slugAvailable() === true}>
                                        <span class="text-success">✓ Disponible</span>
                                    </Show>
                                    <Show when={!slugChecking() && slugAvailable() === false}>
                                        <span class="text-danger">✗ No disponible</span>
                                    </Show>
                                </div>
                            </Show>
                        </div>
                    )} />

                    {/* Business Type — Kobalte Select */}
                    <step2Form.Field name="businessType" children={(f) => (
                        <div class="flex flex-col gap-1.5">
                            <FieldLabel>Tipo de negocio</FieldLabel>
                            <Select
                                value={businessTypeOptions.find(o => o.value === f().state.value)}
                                onChange={(opt) => opt && f().handleChange(opt.value)}
                                options={businessTypeOptions}
                                optionValue="value"
                                optionTextValue="label"
                                placeholder="Seleccione..."
                                itemComponent={(itemProps) => (
                                    <SelectItem item={itemProps.item}>
                                        {itemProps.item.rawValue.label}
                                    </SelectItem>
                                )}
                            >
                                <SelectTrigger>
                                    <SelectValue<SelectOption>>
                                        {(state) => state.selectedOption()?.label}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent />
                            </Select>
                            <Show when={step2Submitted() && hasFieldError(f())}>
                                <small class="text-xs text-danger font-medium ml-1">{getFieldError(f())}</small>
                            </Show>
                        </div>
                    )} />

                    {/* RUC + Business Name */}
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <step2Form.Field name="ruc" children={(f) => (
                            <div>
                                <TextField.Root field={f()}>
                                    <TextField.Label>RUC</TextField.Label>
                                    <TextField.Input type="text" placeholder="0990123456001" maxLength={13}
                                        onInput={(e) => {
                                            const v = e.currentTarget.value.replace(/\D/g, '');
                                            e.currentTarget.value = v;
                                            f().handleChange(v);
                                            checkRuc(v);
                                        }} />
                                    <TextField.ErrorMessage />
                                </TextField.Root>
                                <Show when={f().state.value.length === 13}>
                                    <div class="text-xs ml-1 mt-1">
                                        <Show when={rucChecking()}>
                                            <span class="text-muted">Verificando…</span>
                                        </Show>
                                        <Show when={!rucChecking() && rucAvailable() === true}>
                                            <span class="text-success">✓ RUC disponible</span>
                                        </Show>
                                        <Show when={!rucChecking() && rucAvailable() === false}>
                                            <span class="text-danger">✗ RUC ya registrado</span>
                                        </Show>
                                    </div>
                                </Show>
                            </div>
                        )} />
                        <step2Form.Field name="businessName" children={(f) => (
                            <TextField.Root field={f()}>
                                <TextField.Label>Razón Social</TextField.Label>
                                <TextField.Input type="text" placeholder="Empresa S.A." />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )} />
                    </div>

                    {/* Trade Name */}
                    <step2Form.Field name="tradeName" children={(f) => (
                        <TextField.Root field={f()}>
                            <TextField.Label>Nombre Comercial (opcional)</TextField.Label>
                            <TextField.Input type="text" placeholder="Nombre visible al público" />
                        </TextField.Root>
                    )} />

                    {/* Address */}
                    <step2Form.Field name="mainAddress" children={(f) => (
                        <TextField.Root field={f()}>
                            <TextField.Label>Dirección Matriz (opcional)</TextField.Label>
                            <TextField.Input type="text" placeholder="Av. Principal y Calle Secundaria" />
                        </TextField.Root>
                    )} />

                    {/* Tax Regime + Contabilidad */}
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <step2Form.Field name="taxRegime" children={(f) => (
                            <div class="flex flex-col gap-1.5">
                                <FieldLabel>Régimen Tributario (opcional)</FieldLabel>
                                <Select
                                    value={taxRegimeOptions.find(o => o.value === f().state.value)}
                                    onChange={(opt) => {
                                        const val = opt?.value;
                                        f().handleChange(val as any);
                                        if (val === 'RIMPE_NEGOCIO_POPULAR') {
                                            step2Form.setFieldValue('obligadoContabilidad', false);
                                            step2Form.setFieldValue('contribuyenteEspecial', '');
                                        } else if (val === 'RIMPE_EMPRENDEDOR') {
                                            step2Form.setFieldValue('contribuyenteEspecial', '');
                                        }
                                    }}
                                    options={taxRegimeOptions}
                                    optionValue="value"
                                    optionTextValue="label"
                                    placeholder="Seleccione..."
                                    itemComponent={(itemProps) => (
                                        <SelectItem item={itemProps.item}>
                                            {itemProps.item.rawValue.label}
                                        </SelectItem>
                                    )}
                                >
                                    <SelectTrigger>
                                        <SelectValue<SelectOption>>
                                            {(state) => state.selectedOption()?.label}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent />
                                </Select>
                            </div>
                        )} />
                        <step2Form.Field name="obligadoContabilidad" children={(f) => (
                            <div class="flex flex-col gap-1.5">
                                <FieldLabel>¿Lleva contabilidad?</FieldLabel>
                                <SegmentedControl
                                    value={f().state.value ? 'true' : 'false'}
                                    onChange={(val) => f().handleChange(val === 'true')}
                                    disabled={step2Form.state.values.taxRegime === 'RIMPE_NEGOCIO_POPULAR'}
                                >
                                    <SegmentedControlIndicator />
                                    <SegmentedControlItem value="false">
                                        <SegmentedControlItemInput />
                                        <SegmentedControlItemLabel>No</SegmentedControlItemLabel>
                                    </SegmentedControlItem>
                                    <SegmentedControlItem value="true">
                                        <SegmentedControlItemInput />
                                        <SegmentedControlItemLabel>Sí</SegmentedControlItemLabel>
                                    </SegmentedControlItem>
                                </SegmentedControl>
                                <Show when={step2Submitted() && hasFieldError(f())}>
                                    <small class="text-xs text-danger font-medium ml-1">{getFieldError(f())}</small>
                                </Show>
                            </div>
                        )} />
                    </div>

                    {/* Contribuyente Especial */}
                    <step2Form.Field name="contribuyenteEspecial" children={(f) => (
                        <TextField.Root 
                            field={f()}
                            disabled={step2Form.state.values.taxRegime === 'RIMPE_NEGOCIO_POPULAR' || step2Form.state.values.taxRegime === 'RIMPE_EMPRENDEDOR'}
                        >
                            <TextField.Label>Contribuyente Especial (opcional)</TextField.Label>
                            <TextField.Input type="text" placeholder="Nro. Resolución" />
                        </TextField.Root>
                    )} />

                    <div class="flex gap-3 mt-1">
                        <Button variant="outline" type="button" onClick={() => setStep(0)}>Atrás</Button>
                        <step2Form.Subscribe selector={(s) => ({ isSubmitting: s.isSubmitting })}
                            children={(s) => (
                                <Button type="submit" fullWidth
                                    disabled={slugAvailable() === false || rucAvailable() === false || s().isSubmitting}
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
                <h2 class="text-2xl font-bold mb-1 text-dark">Confirmar registro</h2>
                <p class="text-muted text-sm mb-5">Revisa los datos antes de crear tu cuenta</p>
                <div class="space-y-4">
                    {/* User Summary */}
                    <div class="bg-card-alt border border-border rounded-xl p-4 space-y-2">
                        <h3 class="text-sm font-semibold text-primary flex items-center gap-2">
                            <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" /></svg>
                            Datos del Usuario
                        </h3>
                        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                            <span class="text-muted">Nombre:</span><span class="text-text font-medium">{step1Form.state.values.fullName}</span>
                            <span class="text-muted">Email:</span><span class="text-text font-medium">{step1Form.state.values.email}</span>
                            <Show when={step1Form.state.values.phone}><span class="text-muted">Teléfono:</span><span class="text-text">{step1Form.state.values.phone}</span></Show>
                            <Show when={step1Form.state.values.cedula}><span class="text-muted">Cédula:</span><span class="text-text">{step1Form.state.values.cedula}</span></Show>
                        </div>
                    </div>
                    {/* Company Summary */}
                    <div class="bg-card-alt border border-border rounded-xl p-4 space-y-2">
                        <h3 class="text-sm font-semibold text-primary flex items-center gap-2">
                            <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clip-rule="evenodd" /></svg>
                            Datos de la Empresa
                        </h3>
                        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                            <span class="text-muted">Slug:</span><span class="text-text font-medium">{step2Form.state.values.slug}</span>
                            <span class="text-muted">RUC:</span><span class="text-text font-medium">{step2Form.state.values.ruc}</span>
                            <span class="text-muted">Razón Social:</span><span class="text-text font-medium">{step2Form.state.values.businessName}</span>
                            <Show when={step2Form.state.values.tradeName}><span class="text-muted">Nombre Comercial:</span><span class="text-text">{step2Form.state.values.tradeName}</span></Show>
                            <Show when={step2Form.state.values.businessType}><span class="text-muted">Tipo:</span><span class="text-text">{step2Form.state.values.businessType}</span></Show>
                            <Show when={step2Form.state.values.taxRegime}>
                                <span class="text-muted">Régimen:</span>
                                <span class="text-text">{taxRegimeOptions.find(o => o.value === step2Form.state.values.taxRegime)?.label ?? step2Form.state.values.taxRegime}</span>
                            </Show>
                            <span class="text-muted">Contabilidad:</span><span class="text-text">{step2Form.state.values.obligadoContabilidad ? 'Sí' : 'No'}</span>
                        </div>
                    </div>
                </div>
                <div class="flex gap-3 mt-5">
                    <Button variant="outline" type="button" onClick={() => setStep(1)}>Atrás</Button>
                    <Button fullWidth loading={submitting()} loadingText="Creando cuenta…"
                        onClick={handleFinalSubmit} disabled={submitting()}>
                        Crear cuenta
                    </Button>
                </div>
            </Show>
        </div>
    );
};

export default Register;
