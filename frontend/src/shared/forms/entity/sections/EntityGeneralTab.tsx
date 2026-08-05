import { Component, createSignal, Show, Index, onCleanup, createEffect, on, batch, createMemo } from 'solid-js';
import type { EntityFormData, TaxIdTypeForm, PersonType, TaxRegimeType } from '@app/schema/frontend';
import { useQueryClient } from '@tanstack/solid-query';
import { toast } from 'solid-sonner';
import { api } from '@shared/lib/eden';
import type { SriSupplierResponse } from '@modules/sri/sri.types';
import { useSriSearchByName } from '@modules/sri/sri.queries';
import { hasFieldError, getFieldError } from '@shared/ui/form/form.types';

import {
    taxIdTypeOptions,
    personTypeOptions,
    taxRegimeTypeOptions,
    roleLabels,
    getTaxIdTypeDisabledKeys,
    getTaxIdConfig,
    type SelectOption,
} from '../entity-form.utils';

import TextField, { FieldLabel } from '@shared/ui/TextField';
import Checkbox from '@shared/ui/Checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@shared/ui/Select';
import { Autocomplete } from '@shared/ui/Autocomplete';
import { InfoIcon, SearchIcon, BriefcaseIcon } from '@shared/ui/icons';
import { useAuth } from '@modules/auth/store/auth.store';
import Tooltip from '@shared/ui/Tooltip';
import {
    SegmentedControl,
    SegmentedControlIndicator,
    SegmentedControlItem,
    SegmentedControlItemInput,
    SegmentedControlItemLabel
} from '@shared/ui/SegmentedControl';

import type { EntityFormApi } from '../entity-form.types';

export interface EntityGeneralTabProps {
    form: EntityFormApi;
    isEdit: () => boolean;
    lockedRoles?: Partial<Record<'isClient' | 'isSupplier' | 'isEmployee' | 'isCarrier', boolean>>;
}

export const EntityGeneralTab: Component<EntityGeneralTabProps> = (props) => {
    const auth = useAuth();
    const queryClient = useQueryClient();

    // =========================================================================
    // REACTIVE SELECTORS
    // =========================================================================
    const taxIdType = props.form.useStore((s) => s.values.taxIdType);
    const personType = props.form.useStore((s) => s.values.personType);
    const isEmployeeVal = props.form.useStore((s) => s.values.isEmployee);
    const isSupplierVal = props.form.useStore((s) => s.values.isSupplier);
    const isClientVal = props.form.useStore((s) => s.values.isClient);
    const isCarrierVal = props.form.useStore((s) => s.values.isCarrier);

    // =========================================================================
    // Derived reactive states
    // =========================================================================
    const showTaxSection = createMemo(() => {
        if (taxIdType() === 'RUC') return true;
        if (isSupplierVal() || isClientVal() || isCarrierVal()) return true;
        if (isEmployeeVal() && isSupplierVal()) return true;
        if (isEmployeeVal() && !isSupplierVal() && !isClientVal() && !isCarrierVal()) return false;
        return false;
    });
    const showEmployeeSection = createMemo(() => isEmployeeVal());
    const personTypeLocked = createMemo(() => taxIdType() === 'CEDULA' || isEmployeeVal());
    const taxIdConfig = createMemo(() => getTaxIdConfig(taxIdType()));

    const computedTaxIdTypeOptions = createMemo(() => {
        const disabledKeys = getTaxIdTypeDisabledKeys(personType());
        return taxIdTypeOptions.map(opt => ({
            ...opt,
            disabled: disabledKeys.includes(opt.value),
        }));
    });

    // =========================================================================
    // SRI Integration
    // =========================================================================
    const [isSearchingRuc, setIsSearchingRuc] = createSignal(false);
    const [sriError, setSriError] = createSignal('');
    const [sriNameQuery, setSriNameQuery] = createSignal(props.form.store.state.values.businessName ?? '');
    const nameSearch = useSriSearchByName(sriNameQuery);
    
    let nameDebounce: ReturnType<typeof setTimeout>;
    onCleanup(() => clearTimeout(nameDebounce));

    const [isPristineEdit, setIsPristineEdit] = createSignal(props.isEdit());

    const triggerRucSearch = async () => {
        const val = props.form.getFieldValue('taxId');
        if (val.length === 13) {
            try {
                setSriError('');
                setIsSearchingRuc(true);
                const data = await queryClient.fetchQuery({
                    queryKey: ['sri', 'by-ruc', val],
                    queryFn: async () => {
                        const { data: resData, error } = await api.api.sri['by-ruc'].get({ query: { q: val } });
                        if (error) throw new Error(String(error.value));
                        return resData as SriSupplierResponse[];
                    },
                    staleTime: 1000 * 60 * 60 * 24,
                });
                if (data && data.length > 0) {
                    handleSriSelect('RUC')(data[0]);
                    toast.success('Datos del SRI obtenidos correctamente');
                } else {
                    setSriError('No se encontró información para este RUC en el SRI.');
                    toast.error('RUC no encontrado. Ingrese los detalles manualmente.');
                    batch(() => {
                        props.form.setFieldValue('businessName', '');
                        props.form.setFieldValue('tradeName', '');
                        props.form.setFieldValue('taxRegimeType', undefined);
                        props.form.setFieldValue('obligadoContabilidad', false);
                        props.form.setFieldValue('isSpecialContributor', false);
                        props.form.setFieldValue('isRetentionAgent', false);
                    });
                    setTimeout(() => {
                        const input = document.getElementById('businessName-input') as HTMLInputElement | null;
                        if (input) {
                            input.focus();
                            input.select();
                        }
                    }, 50);
                }
            } catch {
                toast.error('Error de conexión con el SRI.');
            } finally {
                setIsSearchingRuc(false);
            }
        } else {
            setSriError('');
            toast.error('El RUC debe tener 13 dígitos.');
        }
    };

    const handleNameInput = (value: string) => {
        if (isPristineEdit()) {
            if (value === props.form.getFieldValue('businessName')) return;
            setIsPristineEdit(false);
        }
        if (props.form.getFieldValue('businessName') === value) return;
        props.form.setFieldValue('businessName', value);
        clearTimeout(nameDebounce);
        nameDebounce = setTimeout(() => setSriNameQuery(value), 400);
    };

    const handleSriSelect = (source: 'RUC' | 'NAME') => (supplierResult: SriSupplierResponse | null) => {
        if (!supplierResult) return;
        clearTimeout(nameDebounce);

        batch(() => {
            props.form.setFieldValue('taxId', supplierResult.ruc);
            props.form.setFieldValue('businessName', supplierResult.razonSocial);
            props.form.setFieldValue('tradeName', supplierResult.nombreComercial ?? '');
            props.form.setFieldValue('taxIdType', 'RUC');
            props.form.setFieldValue('personType', supplierResult.isSociedad ? 'JURIDICA' : 'NATURAL');
            props.form.setFieldValue('obligadoContabilidad', !!supplierResult.obligadoContabilidad);
            props.form.setFieldValue('isRetentionAgent', !!supplierResult.agenteRetencion);
            props.form.setFieldValue('isSpecialContributor', !!supplierResult.contribuyenteEspecial);
            props.form.setFieldValue('taxRegimeType', supplierResult.isRimpe ? 'RIMPE_EMPRENDEDOR' : 'GENERAL');
        });

        if (source === 'NAME') {
            queryClient.setQueryData(['sri', 'by-name', supplierResult.razonSocial], [supplierResult]);
            setSriNameQuery(supplierResult.razonSocial);
        }

        if (supplierResult.city) {
            const addresses = props.form.getFieldValue('addresses');
            if (addresses.length === 0) {
                props.form.pushFieldValue('addresses', {
                    addressLine: '', city: supplierResult.city, country: 'Ecuador', countryCode: 'EC', postalCode: '', isMain: true,
                });
            }
        }
    };

    let lastToastedQuery = '';
    createEffect(() => {
        if (isPristineEdit()) return;
        if (!nameSearch.isFetching && nameSearch.isSuccess && nameSearch.data && nameSearch.data.length === 0 && sriNameQuery().length >= 3) {
            if (lastToastedQuery !== sriNameQuery()) {
                toast.error(`No se encontraron resultados en el SRI para "${sriNameQuery()}".`);
                lastToastedQuery = sriNameQuery();
            }
        }
    });

    return (
        <div class="w-full space-y-6">
            {/* --- Roles Section --- */}
            <fieldset class="space-y-4 bg-surface/30 p-4 rounded-2xl border border-border/40">
                <div class="flex items-center gap-2 mb-2">
                    <div class="w-1.5 h-4 bg-warning rounded-full"></div>
                    <h3 class="font-semibold text-text uppercase tracking-wide text-sm">Tipo de Entidad</h3>
                </div>
                <div class="flex flex-wrap gap-x-6 gap-y-3">
                    {(Object.entries(roleLabels) as [keyof typeof roleLabels, string][]).map(([key, label]) => (
                        <props.form.Field name={key}>
                            {(field) => {
                                const isRoleDisabledByAuth = (roleKey: string) => {
                                    if (auth?.isAdmin && auth.isAdmin()) return false;
                                    const canManage = (module: any) => {
                                        if (!auth) return false;
                                        return props.isEdit() ? (auth.canEdit && auth.canEdit(module)) : (auth.canAdd && auth.canAdd(module));
                                    };
                                    switch(roleKey) {
                                        case 'isClient': return !canManage('clients');
                                        case 'isSupplier': return !canManage('suppliers');
                                        case 'isEmployee': return !(canManage('hr') || canManage('employees'));
                                        case 'isCarrier': return false; 
                                        default: return false;
                                    }
                                };
                                
                                const isDisabled = !!props.lockedRoles?.[key as keyof typeof roleLabels] || isRoleDisabledByAuth(key);

                                return (
                                    <Checkbox
                                        field={field()}
                                        class="font-medium"
                                        disabled={isDisabled}
                                    >
                                        {label}
                                    </Checkbox>
                                )
                            }}
                        </props.form.Field>
                    ))}
                </div>
            </fieldset>

            {/* --- Identification Section --- */}
            <fieldset class="space-y-4 bg-surface/30 p-4 rounded-2xl border border-border/40">
                <div class="flex items-center gap-2 mb-2">
                    <div class="w-1.5 h-4 bg-primary rounded-full"></div>
                    <h3 class="font-semibold text-text uppercase tracking-wide text-sm">Identificación Principal</h3>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <props.form.Field name="taxIdType">
                        {(field) => (
                            <div class="space-y-1.5">
                                <FieldLabel>Tipo de Identificación</FieldLabel>
                                <Select
                                    value={computedTaxIdTypeOptions().find(o => o.value === field().state.value)}
                                    onChange={(opt) => opt && field().handleChange(opt.value)}
                                    options={computedTaxIdTypeOptions()}
                                    optionValue="value"
                                    optionTextValue="label"
                                    optionDisabled="disabled"
                                    disabled={props.isEdit()}
                                    placeholder="Seleccionar..."
                                    itemComponent={(itemProps) => (
                                        <SelectItem item={itemProps.item}>
                                            {itemProps.item.rawValue.label}
                                        </SelectItem>
                                    )}
                                >
                                    <SelectTrigger>
                                        <SelectValue<SelectOption<TaxIdTypeForm>>>
                                            {(state) => state.selectedOption()?.label}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent />
                                </Select>
                            </div>
                        )}
                    </props.form.Field>

                    <props.form.Field name="taxId">
                        {(field) => (
                            <TextField.Root field={field()}>
                                <TextField.Label>Número de Identificación</TextField.Label>
                                <div class="relative flex items-center w-full">
                                    <TextField.Input
                                        type="text"
                                        inputMode={(taxIdType() === 'CEDULA' || taxIdType() === 'RUC') ? 'numeric' : 'text'}
                                        placeholder={taxIdConfig().placeholder}
                                        maxLength={taxIdConfig().maxLength}
                                        disabled={props.isEdit()}
                                        onInput={(e) => {
                                            let val = e.currentTarget.value;
                                            if (taxIdType() === 'CEDULA' || taxIdType() === 'RUC') {
                                                const numeric = val.replace(/\\D/g, '');
                                                if (val !== numeric) {
                                                    val = numeric;
                                                    e.currentTarget.value = val;
                                                }
                                            }
                                            field().handleChange(val as any);
                                        }}
                                        onKeyDown={(e) => {
                                            setSriError('');
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                triggerRucSearch();
                                            }
                                        }}
                                        class="pr-10"
                                    />
                                    <Show when={!props.isEdit() && taxIdType() === 'RUC'}>
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
                                <Show when={sriError()}>
                                    <small class="text-xs font-medium text-danger ml-0.5 block">{sriError()}</small>
                                </Show>
                            </TextField.Root>
                        )}
                    </props.form.Field>
                </div>

                <props.form.Field name="personType">
                    {(field) => (
                        <div class="space-y-1.5 w-full sm:w-1/2 pr-2.5">
                            <div class="flex items-center gap-1.5 mb-1 ml-1">
                                <FieldLabel>Tipo Persona</FieldLabel>
                                <Show when={personTypeLocked() && !props.isEdit()}>
                                    <Tooltip
                                        content={
                                            taxIdType() === 'CEDULA' || taxIdType() === 'PASAPORTE'
                                                ? `${taxIdType() === 'CEDULA' ? 'Cédula' : 'Pasaporte'} solo aplica a Persona Natural`
                                                : 'Un empleado debe registrarse obligatoriamente como Persona Natural'
                                        }
                                        placement="right"
                                        delay={0}
                                    >
                                        <InfoIcon class="size-4 text-primary-strong hover:primary-strong/80 cursor-help transition-colors" />
                                    </Tooltip>
                                </Show>
                            </div>
                            <SegmentedControl
                                value={field().state.value}
                                onChange={(val) => field().handleChange(val as PersonType)}
                                disabled={personTypeLocked() || props.isEdit()}
                            >
                                <SegmentedControlIndicator />
                                <Index each={personTypeOptions}>
                                    {(opt) => (
                                        <SegmentedControlItem value={opt().value}>
                                            <SegmentedControlItemInput />
                                            <SegmentedControlItemLabel>{opt().label}</SegmentedControlItemLabel>
                                        </SegmentedControlItem>
                                    )}
                                </Index>
                            </SegmentedControl>
                            <Show when={hasFieldError(field())}>
                                <span class="text-xs font-medium text-danger mt-1 block">
                                    {getFieldError(field()) || 'Error de validación'}
                                </span>
                            </Show>
                        </div>
                    )}
                </props.form.Field>
            </fieldset>

            {/* --- Business Info Section --- */}
            <fieldset class="space-y-4 bg-surface/30 p-4 rounded-2xl border border-border/40">
                <div class="flex items-center gap-2 mb-2">
                    <div class="w-1.5 h-4 bg-success rounded-full"></div>
                    <h3 class="font-semibold text-text uppercase tracking-wide text-sm">Empresa / Titular</h3>
                </div>

                <props.form.Field name="businessName">
                    {(field) => (
                        <Autocomplete.Root field={field()}>
                            <Autocomplete.Label>Razón Social (Búsqueda SRI)</Autocomplete.Label>
                            <Autocomplete.Input<SriSupplierResponse>
                                inputId="businessName-input"
                                value={field().state.value}
                                onInputChange={handleNameInput}
                                options={field().state.value.length >= 3 ? (nameSearch.data ?? []) : []}
                                optionValue={(opt) => opt.razonSocial}
                                optionLabel={(opt) => opt.razonSocial}
                                itemRenderer={(opt) => (
                                    <div class="flex flex-col w-full gap-1 min-w-0">
                                        <div class="flex w-full items-center justify-between gap-1 min-w-0">
                                            <span class="font-medium text-text truncate max-w-[70%] flex-1 min-w-0">{opt.razonSocial}</span>
                                            <span class={`shrink-0 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${opt.isActive ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>
                                                {opt.isActive ? 'Activo' : 'Suspendido'}
                                            </span>
                                        </div>
                                        <div class="flex w-full items-center gap-2 text-xs text-muted min-w-0">
                                            <span class="font-mono bg-surface-alt px-1.5 py-0.5 rounded border border-border shrink-0">{opt.ruc}</span>
                                            <Show when={opt.nombreComercial && opt.nombreComercial !== opt.razonSocial}>
                                                <span class="truncate flex-1 min-w-0">({opt.nombreComercial})</span>
                                            </Show>
                                        </div>
                                    </div>
                                )}
                                onSelect={handleSriSelect('NAME')}
                                isLoading={nameSearch.isFetching}
                                hideEmptyState={true}
                                placeholder="Ej: Ingrese 3 letras o más para Autocompletar SRI"
                            />
                            <Autocomplete.ErrorMessage />
                        </Autocomplete.Root>
                    )}
                </props.form.Field>

                <props.form.Field name="tradeName">
                    {(field) => (
                        <TextField.Root field={field()}>
                            <TextField.Label>Nombre Comercial</TextField.Label>
                            <TextField.Input type="text" placeholder="Marca (opcional)" />
                            <TextField.ErrorMessage />
                            <TextField.Description>Nombre con el que es conocida comúnmente en el mercado</TextField.Description>
                        </TextField.Root>
                    )}
                </props.form.Field>
            </fieldset>

            {/* --- Contact Section (email, phone) --- */}
            <fieldset class="space-y-4 bg-surface/30 p-4 rounded-2xl border border-border/40">
                <div class="flex items-center gap-2 mb-2">
                    <div class="w-1.5 h-4 bg-info rounded-full"></div>
                    <h3 class="font-semibold text-text uppercase tracking-wide text-sm">Contacto Predeterminado</h3>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <props.form.Field name="emailBilling">
                        {(field) => (
                            <TextField.Root field={field()}>
                                <TextField.Label>Email Facturación</TextField.Label>
                                <TextField.Input type="email" placeholder="facturacion@empresa.com" />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )}
                    </props.form.Field>
                    <props.form.Field name="phone">
                        {(field) => (
                            <TextField.Root field={field()}>
                                <TextField.Label>Teléfono Principal</TextField.Label>
                                <TextField.Input type="tel" placeholder="(02) 299 9999" />
                            </TextField.Root>
                        )}
                    </props.form.Field>
                </div>
            </fieldset>

            {/* --- Tax Section (conditionally visible) --- */}
            <Show when={showTaxSection()}>
                <fieldset class="space-y-4 bg-surface/30 p-4 rounded-2xl border border-border/40">
                    <div class="flex items-center gap-2 mb-2">
                        <div class="w-1.5 h-4 bg-blue-800 rounded-full"></div>
                        <h3 class="font-semibold text-text uppercase tracking-wide text-sm">Clasificación SRI</h3>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-0 sm:gap-4 place-items-start">
                        <props.form.Field name="taxRegimeType">
                            {(field) => (
                                <div class="space-y-1.5 w-full">
                                    <FieldLabel>Régimen Fiscal (Asignado SRI)</FieldLabel>
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
                        </props.form.Field>

                        <div class="flex flex-col gap-3 pt-6 h-full justify-center pl-2">
                            <props.form.Field name="obligadoContabilidad">
                                {(field) => (
                                    <Checkbox
                                        field={field()}
                                        class="font-medium"
                                        disabled={personType() === 'JURIDICA'}
                                    >
                                        Obligado a llevar contabilidad
                                    </Checkbox>
                                )}
                            </props.form.Field>
                            <props.form.Field name="isRetentionAgent">
                                {(field) => (
                                    <Checkbox field={field()} class="font-medium">
                                        Agente de Retención
                                    </Checkbox>
                                )}
                            </props.form.Field>
                            <props.form.Field name="isSpecialContributor">
                                {(field) => (
                                    <Checkbox field={field()} class="font-medium text-danger">
                                        Contribuyente Especial
                                    </Checkbox>
                                )}
                            </props.form.Field>
                        </div>
                    </div>
                    <Show when={personType() === 'JURIDICA'}>
                        <small class="text-xs text-muted ml-1 block">
                            Persona Jurídica siempre está obligada a llevar contabilidad
                        </small>
                    </Show>
                </fieldset>
            </Show>

            {/* --- Employee Details Section (conditionally visible) --- */}
            <Show when={showEmployeeSection()}>
                <fieldset class="space-y-4 bg-surface/30 p-4 rounded-2xl border border-border/40 animate-in slide-in-from-top-2">
                    <div class="flex items-center gap-2 mb-2">
                        <div class="w-1.5 h-4 bg-secondary rounded-full"></div>
                        <h3 class="font-semibold text-text uppercase tracking-wide text-sm">
                            <BriefcaseIcon class="size-4 inline-block mr-1 -mt-0.5 mb-0.5" />
                            Detalles de Empleado
                        </h3>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        <props.form.Field name="employeeDetails.department">
                            {(field) => (
                                <TextField.Root field={field()}>
                                    <TextField.Label>Departamento</TextField.Label>
                                    <TextField.Input type="text" placeholder="Ej: Producción" />
                                </TextField.Root>
                            )}
                        </props.form.Field>
                        <props.form.Field name="employeeDetails.jobTitle">
                            {(field) => (
                                <TextField.Root field={field()}>
                                    <TextField.Label>Cargo</TextField.Label>
                                    <TextField.Input type="text" placeholder="Ej: Operador CNC" />
                                </TextField.Root>
                            )}
                        </props.form.Field>
                        <props.form.Field name="employeeDetails.hireDate">
                            {(field) => (
                                <TextField.Root field={field()}>
                                    <TextField.Label>Fecha de Contratación</TextField.Label>
                                    <TextField.Input type="date" />
                                </TextField.Root>
                            )}
                        </props.form.Field>
                        <props.form.Field name="employeeDetails.salaryBase">
                            {(field) => (
                                <TextField.Root field={field()}>
                                    <TextField.Label>Salario Base ($)</TextField.Label>
                                    <TextField.Input type="number" placeholder="0.00" step="0.01" />
                                </TextField.Root>
                            )}
                        </props.form.Field>
                        <props.form.Field name="employeeDetails.costPerHour">
                            {(field) => (
                                <TextField.Root field={field()}>
                                    <TextField.Label>Costo por Hora ($)</TextField.Label>
                                    <TextField.Input type="number" placeholder="0.00" step="0.01" />
                                </TextField.Root>
                            )}
                        </props.form.Field>
                    </div>
                </fieldset>
            </Show>
        </div>
    );
};
