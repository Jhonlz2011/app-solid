import { Component, Show, type Accessor } from 'solid-js';
import TextField, { FieldLabel } from '@form/TextField';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@form/Select';
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem, SegmentedControlItemInput, SegmentedControlItemLabel } from '@form/SegmentedControl';
import { businessTypeSelectOptions, taxRegimeSelectOptions, type SelectOption } from '@shared/constants/entity-labels';
import { hasFieldError, getFieldError } from '@shared/ui/form/form.types';
import { useAvailabilityCheck } from '@shared/hooks/useAvailabilityCheck';
import { AvailabilityBadge } from '@shared/ui/form/AvailabilityBadge';

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
    const slugCheck = useAvailabilityCheck({
        type: 'slug',
        value: () => props.form.useStore((s: any) => s.values.slug)(),
    });

    const rucCheck = useAvailabilityCheck({
        type: 'ruc',
        value: () => props.form.useStore((s: any) => s.values.ruc)(),
    });

    const isValidForSubmit = () =>
        slugCheck.status() !== 'taken' &&
        rucCheck.status() !== 'taken' &&
        !slugCheck.isChecking() &&
        !rucCheck.isChecking();

    // Expose status to parent if callback provided
    if (props.onStatusChange) {
        props.onStatusChange({
            slugAvailable: slugCheck.isAvailable,
            slugChecking: slugCheck.isChecking,
            rucAvailable: rucCheck.isAvailable,
            rucChecking: rucCheck.isChecking,
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
                            <AvailabilityBadge
                                status={slugCheck.status}
                                availableLabel="Disponible"
                                takenLabel="En uso"
                                checkingLabel="Comprobando..."
                            />
                        </div>
                        <TextField.Input
                            type="text"
                            placeholder="mi-empresa"
                            loading={slugCheck.isChecking()}
                            onInput={(e: any) => {
                                const v = e.currentTarget.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                                e.currentTarget.value = v;
                                f().handleChange(v);
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
                            <AvailabilityBadge
                                status={rucCheck.status}
                                availableLabel="Válido"
                                takenLabel="Registrado"
                                checkingLabel="Comprobando..."
                            />
                        </div>
                        <TextField.Input
                            type="text"
                            placeholder="0990123456001"
                            maxLength={13}
                            loading={rucCheck.isChecking()}
                            onInput={(e: any) => {
                                const v = e.currentTarget.value.replace(/\D/g, '');
                                e.currentTarget.value = v;
                                f().handleChange(v);
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
