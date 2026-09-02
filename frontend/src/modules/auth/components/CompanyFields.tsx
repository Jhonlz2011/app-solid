import { Component, Show, onCleanup, createSignal, type Accessor } from 'solid-js';
import TextField, { FieldLabel } from '@form/TextField';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@form/Select';
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem, SegmentedControlItemInput, SegmentedControlItemLabel } from '@form/SegmentedControl';
import { businessTypeSelectOptions, taxRegimeSelectOptions, type SelectOption } from '@shared/constants/entity-labels';
import { hasFieldError, getFieldError } from '@shared/ui/form/form.types';
import { authApi } from '@modules/auth/api/auth.api';
import { Badge } from '@shared/ui/display/Badge';

export interface CompanyFieldsStatus {
    slugAvailable: Accessor<boolean | null>;
    slugChecking: Accessor<boolean>;
    rucAvailable: Accessor<boolean | null>;
    rucChecking: Accessor<boolean>;
    isValidForSubmit: Accessor<boolean>;
}

interface CompanyFieldsProps {
    form: any;
    stepSubmitted: Accessor<boolean>;
    onStatusChange?: (status: CompanyFieldsStatus) => void;
}

export const CompanyFields: Component<CompanyFieldsProps> = (props) => {
    const [slugAvailable, setSlugAvailable] = createSignal<boolean | null>(null);
    const [slugChecking, setSlugChecking] = createSignal(false);
    const [rucAvailable, setRucAvailable] = createSignal<boolean | null>(null);
    const [rucChecking, setRucChecking] = createSignal(false);

    // AbortControllers to prevent memory leaks and stale in-flight responses
    let slugAbortController: AbortController | null = null;
    let rucAbortController: AbortController | null = null;
    let slugTimer: ReturnType<typeof setTimeout> | null = null;
    let rucTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanupSlug = () => {
        if (slugTimer) {
            clearTimeout(slugTimer);
            slugTimer = null;
        }
        if (slugAbortController) {
            slugAbortController.abort();
            slugAbortController = null;
        }
    };

    const cleanupRuc = () => {
        if (rucTimer) {
            clearTimeout(rucTimer);
            rucTimer = null;
        }
        if (rucAbortController) {
            rucAbortController.abort();
            rucAbortController = null;
        }
    };

    onCleanup(() => {
        cleanupSlug();
        cleanupRuc();
    });

    const checkSlug = (slug: string) => {
        cleanupSlug();
        setSlugAvailable(null);
        if (slug.length < 3) {
            setSlugChecking(false);
            return;
        }
        setSlugChecking(true);
        slugTimer = setTimeout(async () => {
            slugAbortController = new AbortController();
            try {
                const res = await authApi.checkSlug(slug, slugAbortController.signal);
                setSlugAvailable(res.available);
            } catch (err: any) {
                if (err?.name !== 'AbortError') {
                    setSlugAvailable(null);
                }
            } finally {
                setSlugChecking(false);
                slugAbortController = null;
            }
        }, 400);
    };

    const checkRuc = (ruc: string) => {
        cleanupRuc();
        setRucAvailable(null);
        if (ruc.length !== 13) {
            setRucChecking(false);
            return;
        }
        setRucChecking(true);
        rucTimer = setTimeout(async () => {
            rucAbortController = new AbortController();
            try {
                const res = await authApi.checkRuc(ruc, rucAbortController.signal);
                setRucAvailable(res.available);
            } catch (err: any) {
                if (err?.name !== 'AbortError') {
                    setRucAvailable(null);
                }
            } finally {
                setRucChecking(false);
                rucAbortController = null;
            }
        }, 400);
    };

    const isValidForSubmit = () => slugAvailable() !== false && rucAvailable() !== false && !slugChecking() && !rucChecking();

    // Expose status to parent if callback provided
    if (props.onStatusChange) {
        props.onStatusChange({
            slugAvailable,
            slugChecking,
            rucAvailable,
            rucChecking,
            isValidForSubmit,
        });
    }

    const taxRegime = props.form.useStore((s: any) => s.values.taxRegime);
    const isObligado = props.form.useStore((s: any) => s.values.obligadoContabilidad);

    return (
        <div class="flex flex-col gap-4">
            {/* ─── FILA 1: Slug (Media columna) + Tipo de Negocio (Media columna) ─── */}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Slug */}
                <props.form.Field name="slug" children={(f: any) => (
                    <TextField.Root field={f()}>
                        <div class="flex items-center justify-between gap-2">
                            <TextField.Label>Subdominio (slug) *</TextField.Label>
                            <Show when={!slugChecking() && f().state.value.length >= 3 && slugAvailable() === true}>
                                <Badge variant="success" class="text-[11px] px-1.5 py-0 animate-in fade-in">
                                    ✓ Disponible
                                </Badge>
                            </Show>
                            <Show when={!slugChecking() && f().state.value.length >= 3 && slugAvailable() === false}>
                                <Badge variant="danger" class="text-[11px] px-1.5 py-0 animate-in fade-in">
                                    ✗ En uso
                                </Badge>
                            </Show>
                        </div>
                        <TextField.Input
                            type="text"
                            placeholder="mi-empresa"
                            loading={slugChecking()}
                            onInput={(e: any) => {
                                const v = e.currentTarget.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                                e.currentTarget.value = v;
                                f().handleChange(v);
                                checkSlug(v);
                            }}
                        />
                        <TextField.ErrorMessage />
                    </TextField.Root>
                )} />

                {/* Tipo de Negocio */}
                <props.form.Field name="businessType" children={(f: any) => (
                    <div class="flex flex-col gap-1">
                        <FieldLabel>Tipo de negocio</FieldLabel>
                        <Select
                            value={businessTypeSelectOptions.find(o => o.value === f().state.value)}
                            onChange={(opt) => opt && f().handleChange(opt.value)}
                            options={businessTypeSelectOptions}
                            optionValue="value"
                            optionTextValue="label"
                            placeholder="Seleccione giro..."
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
                        <Show when={props.stepSubmitted() && hasFieldError(f())}>
                            <small class="text-xs text-danger font-medium ml-1">{getFieldError(f())}</small>
                        </Show>
                    </div>
                )} />
            </div>

            {/* ─── FILA 2: RUC (Media columna) + Nombre Comercial (Media columna) ─── */}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* RUC */}
                <props.form.Field name="ruc" children={(f: any) => (
                    <TextField.Root field={f()}>
                        <div class="flex items-center justify-between gap-2">
                            <TextField.Label>RUC *</TextField.Label>
                            <Show when={!rucChecking() && f().state.value.length === 13 && rucAvailable() === true}>
                                <Badge variant="success" class="text-[10px] px-1.5 py-0 animate-in fade-in">
                                    ✓ Válido
                                </Badge>
                            </Show>
                            <Show when={!rucChecking() && f().state.value.length === 13 && rucAvailable() === false}>
                                <Badge variant="danger" class="text-[10px] px-1.5 py-0 animate-in fade-in">
                                    ✗ Registrado
                                </Badge>
                            </Show>
                        </div>
                        <TextField.Input
                            type="text"
                            placeholder="0990123456001"
                            maxLength={13}
                            loading={rucChecking()}
                            onInput={(e: any) => {
                                const v = e.currentTarget.value.replace(/\D/g, '');
                                e.currentTarget.value = v;
                                f().handleChange(v);
                                checkRuc(v);
                            }}
                        />
                        <TextField.ErrorMessage />
                    </TextField.Root>
                )} />

                {/* Nombre Comercial */}
                <props.form.Field name="tradeName" children={(f: any) => (
                    <TextField.Root field={f()}>
                        <TextField.Label optional>Nombre Comercial</TextField.Label>
                        <TextField.Input type="text" placeholder="Nombre visible al público" />
                    </TextField.Root>
                )} />
            </div>

            {/* ─── FILA 3: Razón Social (Columna Completa) ─── */}
            <props.form.Field name="businessName" children={(f: any) => (
                <TextField.Root field={f()}>
                    <TextField.Label>Razón Social *</TextField.Label>
                    <TextField.Input type="text" placeholder="Ej: CORPORACION EJEMPLO CIA. LTDA." />
                    <TextField.ErrorMessage />
                </TextField.Root>
            )} />

            {/* ─── FILA 4: Dirección Matriz (Columna Completa) ─── */}
            <props.form.Field name="mainAddress" children={(f: any) => (
                <TextField.Root field={f()}>
                    <TextField.Label optional>Dirección Matriz</TextField.Label>
                    <TextField.Input type="text" placeholder="Av. Principal y Calle Secundaria, Edificio / Local" />
                </TextField.Root>
            )} />

            {/* ─── FILA 5: Régimen Tributario (Media) + Contabilidad (Media) ─── */}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <props.form.Field name="taxRegime" children={(f: any) => (
                    <div class="flex flex-col gap-1">
                        <FieldLabel>Régimen Tributario</FieldLabel>
                        <Select
                            value={taxRegimeSelectOptions.find(o => o.value === f().state.value)}
                            onChange={(opt) => {
                                const val = opt?.value;
                                f().handleChange(val as any);
                                if (val === 'RIMPE_NEGOCIO_POPULAR') {
                                    props.form.setFieldValue('obligadoContabilidad', false);
                                    props.form.setFieldValue('contribuyenteEspecial', '');
                                } else if (val === 'RIMPE_EMPRENDEDOR') {
                                    props.form.setFieldValue('contribuyenteEspecial', '');
                                }
                            }}
                            options={taxRegimeSelectOptions}
                            optionValue="value"
                            optionTextValue="label"
                            placeholder="Seleccione régimen..."
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

                <props.form.Field name="obligadoContabilidad" children={(f: any) => (
                    <div class="flex flex-col gap-1">
                        <FieldLabel>¿Obligado a llevar contabilidad?</FieldLabel>
                        <SegmentedControl
                            value={f().state.value ? 'true' : 'false'}
                            onChange={(val) => {
                                const isTrue = val === 'true';
                                f().handleChange(isTrue);
                                if (!isTrue) {
                                    props.form.setFieldValue('contribuyenteEspecial', '');
                                }
                            }}
                            disabled={taxRegime() === 'RIMPE_NEGOCIO_POPULAR'}
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
                        <Show when={props.stepSubmitted() && hasFieldError(f())}>
                            <small class="text-xs text-danger font-medium ml-1">{getFieldError(f())}</small>
                        </Show>
                    </div>
                )} />
            </div>

            {/* ─── FILA 6: Contribuyente Especial (Solo visible si Régimen General Y Obligado a Contabilidad = Sí) ─── */}
            <Show when={taxRegime() === 'GENERAL' && isObligado() === true}>
                <div class="animate-in fade-in duration-200">
                    <props.form.Field name="contribuyenteEspecial" children={(f: any) => (
                        <TextField.Root field={f()}>
                            <TextField.Label
                                optional
                                tooltip="Número de resolución emitido por el SRI si tu empresa ha sido designada como Contribuyente Especial"
                            >
                                Contribuyente Especial
                            </TextField.Label>
                            <TextField.Input type="text" placeholder="Ej: NAC-DNCRASC20-00000001" />
                        </TextField.Root>
                    )} />
                </div>
            </Show>
        </div>
    );
};

export default CompanyFields;
