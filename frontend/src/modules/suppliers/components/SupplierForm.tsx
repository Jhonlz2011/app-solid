import { Component, Show, For, createSignal, createEffect } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import { useQueryClient } from '@tanstack/solid-query';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { SupplierFormSchema, type SupplierFormData } from '@app/schema/frontend';
import type { Supplier, SupplierPayload, TaxIdType, PersonType, TaxRegimeType } from '../models/supplier.types';
import { taxIdTypeLabels, personTypeLabels, taxRegimeTypeLabels } from '../models/supplier.types';
import { useSriSearchByName, type SriSupplierResponse } from '../data/suppliers.api';
import { api } from '@shared/lib/eden';
import Button from '@shared/ui/Button';
import TextField from '@shared/ui/TextField';
import Checkbox from '@shared/ui/Checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@shared/ui/Select';
import { Autocomplete } from '@shared/ui/Autocomplete';
import { SearchIcon } from '@shared/ui/icons';


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

const taxRegimeTypeOptions: SelectOption<TaxRegimeType>[] = Object.entries(taxRegimeTypeLabels).map(
    ([value, label]) => ({ value: value as TaxRegimeType, label })
);

// Simple label component for Select fields
const FieldLabel = (props: { children: string }) => (
    <label class="text-sm font-medium text-muted mb-1 ml-1 block">{props.children}</label>
);

// Reusable Error Render component to fix Valibot's object output
const FormError = (props: { errors: any[] }) => (
    <Show when={props.errors.length > 0}>
        <span class="text-sm font-medium text-danger mt-1.5 block">
            {props.errors.map(err => typeof err === 'string' ? err : err?.message || 'Error de validación').join(', ')}
        </span>
    </Show>
);

interface SupplierFormProps {
    supplier?: Supplier;
    onSubmit: (data: SupplierFormData) => void;
    isSubmitting: boolean;
    onCancel: () => void;
}

export const SupplierForm: Component<SupplierFormProps> = (props) => {
    const isEdit = () => !!props.supplier;
    
    // Signals for SRI search
    // Signals for SRI search
    const [isSearchingRuc, setIsSearchingRuc] = createSignal(false);
    const [sriError, setSriError] = createSignal('');
    const [sriNameQuery, setSriNameQuery] = createSignal(props.supplier?.business_name ?? '');

    const nameSearch = useSriSearchByName(sriNameQuery);
    const queryClient = useQueryClient();

    const form = createForm(() => ({
        defaultValues: {
            taxId: props.supplier?.tax_id ?? '',
            taxIdType: (props.supplier?.tax_id_type ?? 'RUC') as 'RUC' | 'CEDULA' | 'PASAPORTE' | 'CONSUMIDOR_FINAL' | 'EXTERIOR',
            personType: (props.supplier?.person_type ?? 'JURIDICA') as 'NATURAL' | 'JURIDICA',
            businessName: props.supplier?.business_name ?? '',
            tradeName: props.supplier?.trade_name ?? '',
            emailBilling: props.supplier?.email_billing ?? '',
            phone: props.supplier?.phone ?? '',
            addressLine: '', // For creation only in this form version
            taxRegimeType: (props.supplier?.tax_regime_type ?? undefined) as 'RIMPE_NEGOCIO_POPULAR' | 'RIMPE_EMPRENDEDOR' | 'GENERAL' | undefined,
            obligadoContabilidad: props.supplier?.obligado_contabilidad ?? false,
            isRetentionAgent: props.supplier?.is_retention_agent ?? false,
            isSpecialContributor: props.supplier?.is_special_contributor ?? false,
        },
        validatorAdapter: valibotValidator(),
        validators: {
            onSubmit: SupplierFormSchema,
        },
        onSubmit: async ({ value }) => {
            props.onSubmit(value as SupplierFormData);
        },
    }));

    // Debounced input handlers
    let nameDebounce: ReturnType<typeof setTimeout>;

    const triggerRucSearch = async () => {
        const val = form.getFieldValue('taxId');
        if (val.length === 13) {
            try {
                setSriError('');
                setIsSearchingRuc(true);
                const data = await queryClient.fetchQuery({
                    queryKey: ['sri', 'by-ruc', val],
                    queryFn: async () => {
                        const { data: resData, error } = await api.api.sri['by-ruc'].get({
                            query: { q: val }
                        });
                        if (error) throw new Error(String(error.value));
                        return resData as SriSupplierResponse[];
                    },
                    staleTime: 1000 * 60 * 60 * 24, // Cache for 24h
                });

                if (data && data.length > 0) {
                    handleSriSelect('RUC')(data[0]);
                } else {
                    setSriError('No se encontró información para este RUC en el SRI.');
                }
            } catch (err) {
                setSriError('Error consultando al SRI. Intente más tarde.');
            } finally {
                setIsSearchingRuc(false);
            }
        } else {
            setSriError('El RUC debe tener exactamente 13 dígitos para buscar.');
        }
    };

    const handleRucInput = (value: string) => {
        setSriError('');
        form.setFieldValue('taxId', value);
    };

    const handleNameInput = (value: string) => {
        if (form.getFieldValue('businessName') === value) return;

        form.setFieldValue('businessName', value);

        clearTimeout(nameDebounce);
        nameDebounce = setTimeout(() => setSriNameQuery(value), 400); 
    };

    const handleSriSelect = (source: 'RUC' | 'NAME' | 'TRADENAME') => (supplierResult: SriSupplierResponse | null) => {
        if (!supplierResult) return;
        
        // Cancel any pending search triggered by typing
        clearTimeout(nameDebounce);

        // Populate form with SRI data
        form.setFieldValue('taxId', supplierResult.ruc);
        form.setFieldValue('businessName', supplierResult.razonSocial);
        form.setFieldValue('tradeName', supplierResult.nombreComercial ?? '');
        
        // Update ONLY the query of the source to prevent refetching the other endpoints
        if (source === 'NAME') {
            // Seed the query cache with exactly what we just matched to avoid hitting the network again
            queryClient.setQueryData(['sri', 'by-name', supplierResult.razonSocial], [supplierResult]);
            setSriNameQuery(supplierResult.razonSocial);
        }

        form.setFieldValue('taxIdType', 'RUC');
        form.setFieldValue('personType', supplierResult.isSociedad ? 'JURIDICA' : 'NATURAL');
        form.setFieldValue('obligadoContabilidad', !!supplierResult.obligadoContabilidad);
        form.setFieldValue('isRetentionAgent', !!supplierResult.agenteRetencion);
        form.setFieldValue('isSpecialContributor', !!supplierResult.contribuyenteEspecial);

        // Explicit Tax Regime assignment as requested
        if (supplierResult.isRimpe) {
            form.setFieldValue('taxRegimeType', 'RIMPE_EMPRENDEDOR');
        } else {
            form.setFieldValue('taxRegimeType', 'GENERAL');
        }
    };

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

                    {/* Número ID - TextField Búsqueda Manual RUC */}
                    <form.Field name="taxId">
                        {(field) => (
                            <TextField.Root field={field()}>
                                <TextField.Label>Número ID (RUC)</TextField.Label>
                                <div class="relative flex items-center w-full">
                                    <TextField.Input 
                                        type="text" 
                                        placeholder="Ingrese RUC (13 dígitos)" 
                                        maxLength={13} 
                                        disabled={isEdit()}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                triggerRucSearch();
                                            }
                                        }}
                                        class="pr-10" // Leave room for lookup icon
                                    />
                                    <Show when={!isEdit()}>
                                        <button 
                                            type="button"
                                            onClick={triggerRucSearch}
                                            disabled={isSearchingRuc() || field().state.value.length !== 13}
                                            class="absolute right-2 p-1.5 text-muted hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="Buscar RUC en el SRI"
                                        >
                                            <Show when={isSearchingRuc()} fallback={<SearchIcon class="size-4" />}>
                                                <svg class="animate-spin size-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                            </Show>
                                        </button>
                                    </Show>
                                </div>
                                <TextField.ErrorMessage />
                                <Show when={field().state.meta.errors.length > 0}>
                                     <FormError errors={field().state.meta.errors} />
                                </Show>
                                <Show when={sriError()}>
                                    <span class="text-sm font-medium text-danger mt-1.5 block">{sriError()}</span>
                                </Show>
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
                            <div class="space-y-1.5 flex flex-col">
                                <FieldLabel>Razón Social (Búsqueda SRI)</FieldLabel>
                                <Autocomplete<SriSupplierResponse>
                                    value={field().state.value}
                                    onInputChange={handleNameInput}
                                    options={field().state.value.length >= 3 ? (nameSearch.data ?? []) : []}
                                    optionValue={(opt) => opt.razonSocial}
                                    optionLabel={(opt) => opt.razonSocial}
                                    optionDescription={(opt) => `RUC: ${opt.ruc}`}
                                    onSelect={handleSriSelect('NAME')}
                                    isLoading={nameSearch.isFetching}
                                    disabled={isEdit()}
                                    placeholder="Ej: Empresa S.A."
                                />
                                <FormError errors={field().state.meta.errors} />
                            </div>
                        )}
                </form.Field>

                <form.Field name="tradeName">
                    {(field) => (
                        <TextField.Root field={field()}>
                            <TextField.Label>Nombre Comercial</TextField.Label>
                            <TextField.Input type="text" placeholder="Marca comercial (opcional)" />
                            <TextField.ErrorMessage />
                            <TextField.Description>Opcional - Nombre comercial o marca</TextField.Description>
                        </TextField.Root>
                    )}
                </form.Field>

                <form.Field name="addressLine">
                    {(field) => (
                        <TextField.Root field={field()}>
                            <TextField.Label>Dirección Fiscal</TextField.Label>
                            <TextField.Input type="text" placeholder="Dirección principal (opcional)" disabled={isEdit()} />
                            <TextField.ErrorMessage />
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
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Tipo Contribuyente - Kobalte Select */}
                    <form.Field name="taxRegimeType">
                        {(field) => (
                            <div class="space-y-1.5">
                                <FieldLabel>Tipo Contribuyente</FieldLabel>
                                <Select
                                    value={taxRegimeTypeOptions.find(o => o.value === field().state.value)}
                                    onChange={(opt) => field().handleChange(opt?.value)}
                                    options={taxRegimeTypeOptions}
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
                                        <SelectValue<SelectOption<TaxRegimeType>>>
                                            {(state) => state.selectedOption()?.label ?? 'Seleccionar...'}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent />
                                </Select>
                            </div>
                        )}
                    </form.Field>

                    {/* Checkboxes with field prop */}
                    <form.Field name="obligadoContabilidad">
                        {(field) => (
                            <div class="flex items-center h-full pt-6">
                                <Checkbox field={field()}>
                                    Obligado a llevar contabilidad
                                </Checkbox>
                            </div>
                        )}
                    </form.Field>

                    <form.Field name="isRetentionAgent">
                        {(field) => (
                            <div class="flex items-center h-full pt-6">
                                <Checkbox field={field()}>
                                    Agente de Retención
                                </Checkbox>
                            </div>
                        )}
                    </form.Field>

                    <form.Field name="isSpecialContributor">
                        {(field) => (
                            <div class="flex items-center h-full pt-6">
                                <Checkbox field={field()}>
                                    Contribuyente Especial
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
