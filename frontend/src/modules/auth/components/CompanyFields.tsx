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
                const res = await authApi.checkSlug(slug);
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
                const res = await authApi.checkRuc(ruc);
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

    return (
        <div class="flex flex-col gap-4">
            {/* Slug */}
            <props.form.Field name="slug" children={(f: any) => (
                <div>
                    <TextField.Root field={f()}>
                        <TextField.Label>Identificador único del subdominio (slug)</TextField.Label>
                        <TextField.Input
                            type="text"
                            placeholder="mi-empresa"
                            onInput={(e: any) => {
                                const v = e.currentTarget.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                                e.currentTarget.value = v;
                                f().handleChange(v);
                                checkSlug(v);
                            }}
                        />
                        <TextField.ErrorMessage />
                    </TextField.Root>
                    <Show when={f().state.value.length >= 3}>
                        <div class="mt-1.5 flex items-center">
                            <Show when={slugChecking()}>
                                <Badge variant="info" class="text-[11px] px-2 py-0.5">
                                    <span class="size-1.5 rounded-full bg-info animate-pulse" />
                                    Verificando disponibilidad…
                                </Badge>
                            </Show>
                            <Show when={!slugChecking() && slugAvailable() === true}>
                                <Badge variant="success" class="text-[11px] px-2 py-0.5">
                                    ✓ Disponible ({f().state.value}.zelys.app)
                                </Badge>
                            </Show>
                            <Show when={!slugChecking() && slugAvailable() === false}>
                                <Badge variant="danger" class="text-[11px] px-2 py-0.5">
                                    ✗ Este identificador ya está en uso
                                </Badge>
                            </Show>
                        </div>
                    </Show>
                </div>
            )} />

            {/* Business Type */}
            <props.form.Field name="businessType" children={(f: any) => (
                <div class="flex flex-col gap-1.5">
                    <FieldLabel>Tipo de negocio</FieldLabel>
                    <Select
                        value={businessTypeSelectOptions.find(o => o.value === f().state.value)}
                        onChange={(opt) => opt && f().handleChange(opt.value)}
                        options={businessTypeSelectOptions}
                        optionValue="value"
                        optionTextValue="label"
                        placeholder="Seleccione el giro comercial..."
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

            {/* RUC + Business Name */}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <props.form.Field name="ruc" children={(f: any) => (
                    <div>
                        <TextField.Root field={f()}>
                            <TextField.Label>RUC</TextField.Label>
                            <TextField.Input
                                type="text"
                                placeholder="0990123456001"
                                maxLength={13}
                                onInput={(e: any) => {
                                    const v = e.currentTarget.value.replace(/\D/g, '');
                                    e.currentTarget.value = v;
                                    f().handleChange(v);
                                    checkRuc(v);
                                }}
                            />
                            <TextField.ErrorMessage />
                        </TextField.Root>
                        <Show when={f().state.value.length === 13}>
                            <div class="mt-1.5 flex items-center">
                                <Show when={rucChecking()}>
                                    <Badge variant="info" class="text-[11px] px-2 py-0.5">
                                        <span class="size-1.5 rounded-full bg-info animate-pulse" />
                                        Verificando RUC…
                                    </Badge>
                                </Show>
                                <Show when={!rucChecking() && rucAvailable() === true}>
                                    <Badge variant="success" class="text-[11px] px-2 py-0.5">
                                        ✓ RUC disponible
                                    </Badge>
                                </Show>
                                <Show when={!rucChecking() && rucAvailable() === false}>
                                    <Badge variant="danger" class="text-[11px] px-2 py-0.5">
                                        ✗ RUC ya registrado
                                    </Badge>
                                </Show>
                            </div>
                        </Show>
                    </div>
                )} />

                <props.form.Field name="businessName" children={(f: any) => (
                    <TextField.Root field={f()}>
                        <TextField.Label>Razón Social</TextField.Label>
                        <TextField.Input type="text" placeholder="Empresa S.A." />
                        <TextField.ErrorMessage />
                    </TextField.Root>
                )} />
            </div>

            {/* Trade Name */}
            <props.form.Field name="tradeName" children={(f: any) => (
                <TextField.Root field={f()}>
                    <TextField.Label>Nombre Comercial (opcional)</TextField.Label>
                    <TextField.Input type="text" placeholder="Nombre visible al público" />
                </TextField.Root>
            )} />

            {/* Address */}
            <props.form.Field name="mainAddress" children={(f: any) => (
                <TextField.Root field={f()}>
                    <TextField.Label>Dirección Matriz (opcional)</TextField.Label>
                    <TextField.Input type="text" placeholder="Av. Principal y Calle Secundaria" />
                </TextField.Root>
            )} />

            {/* Tax Regime + Contabilidad */}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <props.form.Field name="taxRegime" children={(f: any) => (
                    <div class="flex flex-col gap-1.5">
                        <FieldLabel>Régimen Tributario (opcional)</FieldLabel>
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
                    <div class="flex flex-col gap-1.5">
                        <FieldLabel>¿Obligado a llevar contabilidad?</FieldLabel>
                        <SegmentedControl
                            value={f().state.value ? 'true' : 'false'}
                            onChange={(val) => f().handleChange(val === 'true')}
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

            {/* Contribuyente Especial */}
            <props.form.Field name="contribuyenteEspecial" children={(f: any) => (
                <TextField.Root 
                    field={f()}
                    disabled={taxRegime() === 'RIMPE_NEGOCIO_POPULAR' || taxRegime() === 'RIMPE_EMPRENDEDOR'}
                >
                    <TextField.Label>Contribuyente Especial (opcional)</TextField.Label>
                    <TextField.Input type="text" placeholder="Nro. Resolución SRI" />
                </TextField.Root>
            )} />
        </div>
    );
};

export default CompanyFields;
