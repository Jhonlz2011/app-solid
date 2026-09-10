import { Component, Show, createEffect, type Accessor } from 'solid-js';
import TextField, { FieldLabel } from '@form/TextField';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@form/Select';
import { businessTypeSelectOptions, type SelectOption } from '@shared/constants/entity-labels';
import { hasFieldError, getFieldError, type AnyFormApi } from '@shared/ui/form/form.types';
import { useAvailabilityCheck } from '@shared/hooks/useAvailabilityCheck';
import { AvailabilityBadge } from '@shared/ui/form/AvailabilityBadge';

export interface CompanyGeneralFieldsStatus {
    slugAvailable?: Accessor<boolean | null>;
    slugChecking?: Accessor<boolean>;
    rucAvailable?: Accessor<boolean | null>;
    rucChecking?: Accessor<boolean>;
    isValidForSubmit: Accessor<boolean>;
}

export interface CompanyGeneralFormValues {
    slug?: string;
    ruc?: string;
    businessName?: string;
    tradeName?: string;
    businessType?: string;
    email?: string;
    phone?: string;
    mainAddress?: string;
}

export interface CompanyGeneralFieldsProps {
    form: AnyFormApi;
    stepSubmitted?: Accessor<boolean>;
    showSlug?: boolean;
    showContact?: boolean;
    checkSlugAvailability?: boolean;
    checkRucAvailability?: boolean;
    isMatrizRequired?: boolean;
    onStatusChange?: (status: CompanyGeneralFieldsStatus) => void;
}

export const CompanyGeneralFields: Component<CompanyGeneralFieldsProps> = (props) => {
    // Single-instance store accessors at component level with typed selectors
    const slugValue = props.form.useStore((s: { values?: CompanyGeneralFormValues }) => s.values?.slug ?? '');
    const rucValue = props.form.useStore((s: { values?: CompanyGeneralFormValues }) => s.values?.ruc ?? '');

    // Availability checks (conditionally enabled via props)
    const slugCheck = useAvailabilityCheck({
        type: 'slug',
        value: slugValue,
        enabled: () => !!props.showSlug && (props.checkSlugAvailability ?? true),
    });

    const rucCheck = useAvailabilityCheck({
        type: 'ruc',
        value: rucValue,
        enabled: () => props.checkRucAvailability ?? false,
    });

    const isValidForSubmit = () => {
        if (props.showSlug && (props.checkSlugAvailability ?? true)) {
            if (slugCheck.status() === 'taken' || slugCheck.isChecking()) return false;
        }
        if (props.checkRucAvailability) {
            if (rucCheck.status() === 'taken' || rucCheck.isChecking()) return false;
        }
        return true;
    };

    // Propagate status asynchronously to avoid mutating parent state during child render
    createEffect(() => {
        props.onStatusChange?.({
            slugAvailable: slugCheck.isAvailable,
            slugChecking: slugCheck.isChecking,
            rucAvailable: rucCheck.isAvailable,
            rucChecking: rucCheck.isChecking,
            isValidForSubmit,
        });
    });

    return (
        <div class="flex flex-col gap-4">
            {/* ─── Fila Opcional: Slug (Subdominio) ─── */}
            <Show when={props.showSlug}>
                <props.form.Field name="slug" children={(f: any) => (
                    <TextField.Root field={f}>
                        <TextField.Label
                            badge={
                                <Show when={props.checkSlugAvailability ?? true}>
                                    <AvailabilityBadge
                                        status={slugCheck.status}
                                        availableLabel="Disponible"
                                        takenLabel="En uso"
                                    />
                                </Show>
                            }
                        >
                            Subdominio (slug) *
                        </TextField.Label>
                        <TextField.Input
                            type="text"
                            placeholder="mi-empresa"
                            loading={slugCheck.isChecking}
                            onInput={(e) => {
                                const raw = e.currentTarget.value;
                                const v = raw.toLowerCase().replace(/[^a-z0-9-]/g, '');
                                if (v !== raw) {
                                    e.currentTarget.value = v;
                                    f().handleChange(v);
                                }
                            }}
                        />
                        <TextField.ErrorMessage />
                    </TextField.Root>
                )} />
            </Show>

            {/* ─── Fila: RUC + Tipo de Negocio ─── */}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* RUC */}
                <props.form.Field name="ruc" children={(f: any) => (
                    <TextField.Root field={f}>
                        <TextField.Label
                            badge={
                                <Show when={props.checkRucAvailability}>
                                    <AvailabilityBadge
                                        status={rucCheck.status}
                                        availableLabel="Válido"
                                        takenLabel="Registrado"
                                    />
                                </Show>
                            }
                        >
                            RUC (13 dígitos) *
                        </TextField.Label>
                        <TextField.Input
                            type="text"
                            placeholder="1792345678001"
                            maxLength={13}
                            loading={rucCheck.isChecking}
                            onInput={(e) => {
                                const raw = e.currentTarget.value;
                                const v = raw.replace(/\D/g, '');
                                if (v !== raw) {
                                    e.currentTarget.value = v;
                                    f().handleChange(v);
                                }
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
                        <Show when={props.stepSubmitted?.() && hasFieldError(f())}>
                            <small class="text-xs text-danger font-medium ml-1">{getFieldError(f())}</small>
                        </Show>
                    </div>
                )} />
            </div>

            {/* ─── Fila: Razón Social + Nombre Comercial ─── */}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <props.form.Field name="businessName" children={(f: any) => (
                    <TextField.Root field={f}>
                        <TextField.Label>Razón Social *</TextField.Label>
                        <TextField.Input type="text" placeholder="Ej: CORPORACION EJEMPLO CIA. LTDA." />
                        <TextField.ErrorMessage />
                    </TextField.Root>
                )} />

                <props.form.Field name="tradeName" children={(f: any) => (
                    <TextField.Root field={f}>
                        <TextField.Label optional>Nombre Comercial</TextField.Label>
                        <TextField.Input type="text" placeholder="Nombre visible al público" />
                        <TextField.ErrorMessage />
                    </TextField.Root>
                )} />
            </div>

            {/* ─── Fila Opcional: Teléfono + Email (Para Perfil en Configuración) ─── */}
            <Show when={props.showContact}>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <props.form.Field name="phone" children={(f: any) => (
                        <TextField.Root field={f}>
                            <TextField.Label optional>Teléfono de Contacto</TextField.Label>
                            <TextField.Input type="text" placeholder="0987654321" />
                            <TextField.ErrorMessage />
                        </TextField.Root>
                    )} />

                    <props.form.Field name="email" children={(f: any) => (
                        <TextField.Root field={f}>
                            <TextField.Label optional>Correo Electrónico</TextField.Label>
                            <TextField.Input type="text" placeholder="contacto@empresa.com" />
                            <TextField.ErrorMessage />
                        </TextField.Root>
                    )} />
                </div>
            </Show>

            {/* ─── Fila: Dirección Matriz ─── */}
            <props.form.Field name="mainAddress" children={(f: any) => (
                <TextField.Root field={f}>
                    <TextField.Label optional={!props.isMatrizRequired}>Dirección Matriz {props.isMatrizRequired ? '*' : ''}</TextField.Label>
                    <TextField.Input type="text" placeholder="Av. Principal y Calle Secundaria, Edificio / Local" />
                    <TextField.ErrorMessage />
                </TextField.Root>
            )} />
        </div>
    );
};

export default CompanyGeneralFields;
