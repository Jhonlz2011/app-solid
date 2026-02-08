import { Component, Show, For } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { SupplierFormSchema, type SupplierFormData } from '@app/schema/frontend';
import type { Supplier, SupplierPayload, TaxIdType, PersonType, SriContributorType } from '../models/supplier.types';
import { taxIdTypeLabels, personTypeLabels, sriContributorLabels } from '../models/supplier.types';
import Button from '@shared/ui/Button';
import TextField from '@shared/ui/TextField';
import Checkbox from '@shared/ui/Checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@shared/ui/Select';

// Select option types
interface SelectOption<T extends string> {
    value: T;
    label: string;
}

const taxIdTypeOptions: SelectOption<TaxIdType>[] = Object.entries(taxIdTypeLabels).map(
    ([value, label]) => ({ value: value as TaxIdType, label })
);

const personTypeOptions: SelectOption<PersonType>[] = Object.entries(personTypeLabels).map(
    ([value, label]) => ({ value: value as PersonType, label })
);

const sriContributorOptions: SelectOption<SriContributorType>[] = Object.entries(sriContributorLabels).map(
    ([value, label]) => ({ value: value as SriContributorType, label })
);

// Simple label component for Select fields
const FieldLabel = (props: { children: string }) => (
    <label class="text-sm font-medium text-muted mb-1 ml-1 block">{props.children}</label>
);

interface SupplierFormProps {
    supplier?: Supplier;
    onSubmit: (data: SupplierPayload) => void;
    isSubmitting: boolean;
    onCancel: () => void;
}

export const SupplierForm: Component<SupplierFormProps> = (props) => {
    const isEdit = () => !!props.supplier;

    const form = createForm(() => ({
        defaultValues: {
            taxId: props.supplier?.tax_id ?? '',
            taxIdType: (props.supplier?.tax_id_type ?? 'RUC') as 'RUC' | 'CEDULA' | 'PASAPORTE',
            personType: (props.supplier?.person_type ?? 'JURIDICA') as 'NATURAL' | 'JURIDICA',
            businessName: props.supplier?.business_name ?? '',
            tradeName: props.supplier?.trade_name ?? '',
            emailBilling: props.supplier?.email_billing ?? '',
            phone: props.supplier?.phone ?? '',
            addressFiscal: props.supplier?.address_fiscal ?? '',
            sriContributorType: (props.supplier?.sri_contributor_type ?? undefined) as 'RIMPE_POPULAR' | 'RIMPE_EMPRENDEDOR' | 'GENERAL' | 'ESP_AGENT' | undefined,
            obligadoContabilidad: props.supplier?.obligado_contabilidad ?? false,
        },
        validatorAdapter: valibotValidator(),
        validators: {
            onChange: SupplierFormSchema,
        },
        onSubmit: async ({ value }) => {
            props.onSubmit(value as SupplierPayload);
        },
    }));

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                form.handleSubmit();
            }}
            class="space-y-6"
        >
            {/* Identificación */}
            <fieldset class="space-y-4">
                <legend class="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Identificación</legend>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Tipo ID - Kobalte Select */}
                    <form.Field name="taxIdType">
                        {(field) => (
                            <div class="space-y-1.5">
                                <FieldLabel>Tipo ID</FieldLabel>
                                <Select
                                    value={taxIdTypeOptions.find(o => o.value === field().state.value)}
                                    onChange={(opt) => opt && field().handleChange(opt.value)}
                                    options={taxIdTypeOptions}
                                    optionValue="value"
                                    optionTextValue="label"
                                    disabled={isEdit()}
                                    placeholder="Seleccionar..."
                                    itemComponent={(itemProps) => (
                                        <SelectItem item={itemProps.item}>
                                            {itemProps.item.rawValue.label}
                                        </SelectItem>
                                    )}
                                >
                                    <SelectTrigger>
                                        <SelectValue<SelectOption<TaxIdType>>>
                                            {(state) => state.selectedOption()?.label}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent />
                                </Select>
                            </div>
                        )}
                    </form.Field>

                    {/* Número ID - TextField with field prop */}
                    <form.Field name="taxId">
                        {(field) => (
                            <TextField.Root field={field()} disabled={isEdit()}>
                                <TextField.Label>Número ID</TextField.Label>
                                <TextField.Input placeholder="0999999999001" />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )}
                    </form.Field>
                </div>

                {/* Tipo Persona - Kobalte Select */}
                <form.Field name="personType">
                    {(field) => (
                        <div class="space-y-1.5">
                            <FieldLabel>Tipo Persona</FieldLabel>
                            <Select
                                value={personTypeOptions.find(o => o.value === field().state.value)}
                                onChange={(opt) => opt && field().handleChange(opt.value)}
                                options={personTypeOptions}
                                optionValue="value"
                                optionTextValue="label"
                                disabled={isEdit()}
                                placeholder="Seleccionar..."
                                itemComponent={(itemProps) => (
                                    <SelectItem item={itemProps.item}>
                                        {itemProps.item.rawValue.label}
                                    </SelectItem>
                                )}
                            >
                                <SelectTrigger>
                                    <SelectValue<SelectOption<PersonType>>>
                                        {(state) => state.selectedOption()?.label}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent />
                            </Select>
                        </div>
                    )}
                </form.Field>
            </fieldset>

            {/* Información General */}
            <fieldset class="space-y-4">
                <legend class="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Información General</legend>

                <form.Field name="businessName">
                    {(field) => (
                        <TextField.Root field={field()}>
                            <TextField.Label>Razón Social</TextField.Label>
                            <TextField.Input placeholder="Empresa S.A." />
                            <TextField.ErrorMessage />
                        </TextField.Root>
                    )}
                </form.Field>

                <form.Field name="tradeName">
                    {(field) => (
                        <TextField.Root field={field()}>
                            <TextField.Label>Nombre Comercial</TextField.Label>
                            <TextField.Input placeholder="Marca comercial (opcional)" />
                            <TextField.Description>Opcional - Nombre comercial o marca</TextField.Description>
                        </TextField.Root>
                    )}
                </form.Field>
            </fieldset>

            {/* Contacto */}
            <fieldset class="space-y-4">
                <legend class="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Contacto</legend>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <form.Field name="emailBilling">
                        {(field) => (
                            <TextField.Root field={field()}>
                                <TextField.Label>Email Facturación</TextField.Label>
                                <TextField.Input type="email" placeholder="facturacion@empresa.com" />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )}
                    </form.Field>

                    <form.Field name="phone">
                        {(field) => (
                            <TextField.Root field={field()}>
                                <TextField.Label>Teléfono</TextField.Label>
                                <TextField.Input type="tel" placeholder="099 999 9999" />
                            </TextField.Root>
                        )}
                    </form.Field>
                </div>
            </fieldset>

            {/* Fiscal */}
            <fieldset class="space-y-4">
                <legend class="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Información Fiscal</legend>

                <form.Field name="addressFiscal">
                    {(field) => (
                        <TextField.Root field={field()}>
                            <TextField.Label>Dirección Fiscal</TextField.Label>
                            <TextField.Input placeholder="Av. Principal 123, Ciudad" />
                            <TextField.ErrorMessage />
                        </TextField.Root>
                    )}
                </form.Field>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Tipo Contribuyente - Kobalte Select */}
                    <form.Field name="sriContributorType">
                        {(field) => (
                            <div class="space-y-1.5">
                                <FieldLabel>Tipo Contribuyente</FieldLabel>
                                <Select
                                    value={sriContributorOptions.find(o => o.value === field().state.value)}
                                    onChange={(opt) => field().handleChange(opt?.value)}
                                    options={sriContributorOptions}
                                    optionValue="value"
                                    optionTextValue="label"
                                    placeholder="Seleccionar..."
                                    itemComponent={(itemProps) => (
                                        <SelectItem item={itemProps.item}>
                                            {itemProps.item.rawValue.label}
                                        </SelectItem>
                                    )}
                                >
                                    <SelectTrigger>
                                        <SelectValue<SelectOption<SriContributorType>>>
                                            {(state) => state.selectedOption()?.label ?? 'Seleccionar...'}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent />
                                </Select>
                            </div>
                        )}
                    </form.Field>

                    {/* Checkbox with field prop */}
                    <form.Field name="obligadoContabilidad">
                        {(field) => (
                            <div class="flex items-center h-full pt-6">
                                <Checkbox field={field()}>
                                    Obligado a llevar contabilidad
                                </Checkbox>
                            </div>
                        )}
                    </form.Field>
                </div>
            </fieldset>

            {/* Actions */}
            <div class="flex justify-end gap-3 pt-4 border-t border-border/50">
                <Button variant="outline" type="button" onClick={props.onCancel} disabled={props.isSubmitting}>
                    Cancelar
                </Button>
                <form.Subscribe selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}>
                    {(state) => (
                        <Button
                            type="submit"
                            disabled={!state().canSubmit || props.isSubmitting}
                            loading={props.isSubmitting}
                        >
                            {isEdit() ? 'Actualizar' : 'Crear'} Proveedor
                        </Button>
                    )}
                </form.Subscribe>
            </div>
        </form>
    );
};
