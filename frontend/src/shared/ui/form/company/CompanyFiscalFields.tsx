import { Component, Show, type Accessor } from 'solid-js';
import TextField, { FieldLabel } from '@form/TextField';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@form/Select';
import {
    SegmentedControl,
    SegmentedControlIndicator,
    SegmentedControlItem,
    SegmentedControlItemInput,
    SegmentedControlItemLabel,
} from '@form/SegmentedControl';
import Switch from '@/shared/ui/form/Switch';
import { taxRegimeSelectOptions, type SelectOption } from '@shared/constants/entity-labels';
import { hasFieldError, getFieldError, type AnyFormApi } from '@shared/ui/form/form.types';

const SRI_ENV_OPTIONS: SelectOption[] = [
    { value: '1', label: 'Pruebas (Ambiente 1)' },
    { value: '2', label: 'Producción (Ambiente 2)' },
];

export interface CompanyFiscalFormValues {
    taxRegimeType?: string;
    obligadoContabilidad?: boolean;
    contribuyenteEspecial?: string;
    agenteRetencion?: string;
    sriEnvironment?: string;
}

export interface CompanyFiscalFieldsProps {
    form: AnyFormApi;
    stepSubmitted?: Accessor<boolean>;
    /** Control style: 'segmented' for onboarding/auth, 'switch' for settings panel */
    obligadoControlType?: 'segmented' | 'switch';
    /** Show SRI environment and Agente de Retención (used in Settings) */
    showAdvancedSri?: boolean;
    /** Whether Contribuyente Especial is always visible or only when General + Obligado */
    alwaysShowContribuyenteEspecial?: boolean;
}

export const CompanyFiscalFields: Component<CompanyFiscalFieldsProps> = (props) => {
    const controlType = () => props.obligadoControlType ?? 'segmented';

    // Subscribed once at component level with typed store selector
    const currentRegime = props.form.useStore((s: { values: CompanyFiscalFormValues }) => s.values.taxRegimeType);
    const isObligado = props.form.useStore((s: { values: CompanyFiscalFormValues }) => s.values.obligadoContabilidad);

    const handleRegimeChange = (val: string | undefined, fieldHandleChange: (v: any) => void) => {
        fieldHandleChange(val);
        if (val === 'RIMPE_NEGOCIO_POPULAR') {
            props.form.setFieldValue('obligadoContabilidad', false);
            props.form.setFieldValue('contribuyenteEspecial', '');
        } else if (val === 'RIMPE_EMPRENDEDOR') {
            props.form.setFieldValue('contribuyenteEspecial', '');
        }
    };

    const handleObligadoChange = (val: boolean, fieldHandleChange: (v: any) => void) => {
        fieldHandleChange(val);
        if (!val) {
            props.form.setFieldValue('contribuyenteEspecial', '');
        }
    };

    return (
        <div class="flex flex-col gap-4">
            {/* ─── Fila: Régimen SRI + Obligado a Contabilidad (o SRI Environment si advanced) ─── */}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                {/* Régimen Tributario */}
                <props.form.Field name="taxRegimeType" children={(f: any) => (
                    <div class="flex flex-col gap-1">
                        <FieldLabel>Régimen Tributario</FieldLabel>
                        <Select
                            value={taxRegimeSelectOptions.find(o => o.value === f().state.value)}
                            onChange={(opt) => handleRegimeChange(opt?.value, f().handleChange)}
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
                                    {(state) => state.selectedOption()?.label || 'General / RIMPE'}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent />
                        </Select>
                    </div>
                )} />

                {/* Si no es avanzado, renderizamos Obligado a Contabilidad en columna paralela */}
                <Show when={!props.showAdvancedSri && controlType() === 'segmented'}>
                    <props.form.Field name="obligadoContabilidad" children={(f: any) => (
                        <div class="flex flex-col gap-1">
                            <FieldLabel>¿Obligado a llevar contabilidad?</FieldLabel>
                            <SegmentedControl
                                value={f().state.value ? 'true' : 'false'}
                                onChange={(val) => handleObligadoChange(val === 'true', f().handleChange)}
                                disabled={currentRegime() === 'RIMPE_NEGOCIO_POPULAR'}
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
                            <Show when={props.stepSubmitted?.() && hasFieldError(f())}>
                                <small class="text-xs text-danger font-medium ml-1">{getFieldError(f())}</small>
                            </Show>
                        </div>
                    )} />
                </Show>

                {/* Si es avanzado, renderizamos Ambiente SRI */}
                <Show when={props.showAdvancedSri}>
                    <props.form.Field name="sriEnvironment" children={(f: any) => (
                        <div class="flex flex-col gap-1">
                            <FieldLabel>Ambiente de Emisión SRI *</FieldLabel>
                            <Select
                                value={SRI_ENV_OPTIONS.find(o => o.value === f().state.value)}
                                onChange={(opt) => opt && f().handleChange(opt.value)}
                                options={SRI_ENV_OPTIONS}
                                optionValue="value"
                                optionTextValue="label"
                                placeholder="Seleccionar ambiente..."
                                itemComponent={(itemProps) => (
                                    <SelectItem item={itemProps.item}>
                                        {itemProps.item.rawValue.label}
                                    </SelectItem>
                                )}
                            >
                                <SelectTrigger>
                                    <SelectValue<SelectOption>>
                                        {(state) => state.selectedOption()?.label || 'Producción (Ambiente 2)'}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent />
                            </Select>
                        </div>
                    )} />
                </Show>
            </div>

            {/* ─── Fila Avanzada: Resoluciones Especiales y Retención ─── */}
            <Show when={props.showAdvancedSri}>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <props.form.Field name="contribuyenteEspecial" children={(f: any) => (
                        <TextField.Root field={f()}>
                            <TextField.Label optional tooltip="Número de resolución emitido por el SRI">
                                Resolución Contribuyente Especial
                            </TextField.Label>
                            <TextField.Input type="text" placeholder="Ej: NAC-DNCRASC20-00000001" />
                            <TextField.ErrorMessage />
                        </TextField.Root>
                    )} />

                    <props.form.Field name="agenteRetencion" children={(f: any) => (
                        <TextField.Root field={f()}>
                            <TextField.Label optional tooltip="Número de resolución de designación como agente de retención">
                                Resolución Agente de Retención
                            </TextField.Label>
                            <TextField.Input type="text" placeholder="Resolución SRI nro..." />
                            <TextField.ErrorMessage />
                        </TextField.Root>
                    )} />
                </div>
            </Show>

            {/* ─── Modo Auth: Contribuyente Especial Condicional ─── */}
            <Show when={!props.showAdvancedSri && (props.alwaysShowContribuyenteEspecial || (currentRegime() === 'GENERAL' && isObligado() === true))}>
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
                            <TextField.ErrorMessage />
                        </TextField.Root>
                    )} />
                </div>
            </Show>

            {/* ─── Switch para Modo Settings ─── */}
            <Show when={controlType() === 'switch'}>
                <div class="border-t border-border/40 pt-4">
                    <props.form.Field name="obligadoContabilidad" children={(f: any) => (
                        <div class="flex items-center justify-between p-3 rounded-xl bg-card border border-border">
                            <div>
                                <span class="text-sm font-bold text-heading block">Obligado a Llevar Contabilidad</span>
                                <span class="text-xs text-muted mt-0.5">Activa esta casilla si tu empresa está registrada ante el SRI como obligada a llevar contabilidad.</span>
                            </div>
                            <Switch
                                checked={f().state.value}
                                onChange={(val) => handleObligadoChange(val, f().handleChange)}
                                disabled={currentRegime() === 'RIMPE_NEGOCIO_POPULAR'}
                            />
                        </div>
                    )} />
                </div>
            </Show>
        </div>
    );
};

export default CompanyFiscalFields;
