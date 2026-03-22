import { Component, createSignal, Show, Index, onCleanup, createEffect, on, batch, createMemo } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import { useQueryClient } from '@tanstack/solid-query';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { EntityFormSchema, type EntityFormData, type TaxIdTypeForm, type PersonType, type TaxRegimeType } from '@app/schema/frontend';
import { ApiError } from '@shared/utils/api-errors';
import { api } from '@shared/lib/eden';

import {
    taxIdTypeOptions,
    personTypeOptions,
    taxRegimeTypeOptions,
    roleLabels,
    createDefaultEntityFormValues,
    EMPTY_EMPLOYEE_DETAILS,
    getTaxIdTypeDisabledKeys,
    getTaxIdConfig,
    type SelectOption,
} from './entity-form.utils';

// SRI search types (re-used from suppliers module)
import type { SriSupplierResponse } from '@modules/suppliers/data/suppliers.api';
import { useSriSearchByName } from '@modules/suppliers/data/suppliers.api';

import { useGeoNamesCities, type GeoNameCity } from '@shared/hooks/useGeoNamesCities';
import Button from '@shared/ui/Button';
import TextField from '@shared/ui/TextField';
import Checkbox from '@shared/ui/Checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@shared/ui/Select';
import { Autocomplete } from '@shared/ui/Autocomplete';
import { SearchIcon, PlusIcon, TrashIcon, InfoIcon, UsersIcon, MapPinIcon, BriefcaseIcon } from '@shared/ui/icons';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@shared/ui/Tabs';
import {
    SegmentedControl,
    SegmentedControlIndicator,
    SegmentedControlItem,
    SegmentedControlItemInput,
    SegmentedControlItemLabel
} from '@shared/ui/SegmentedControl';

// =============================================================================
// Sub-components
// =============================================================================

const FieldLabel = (props: { children: string }) => (
    <label class="text-sm font-medium text-muted mb-1 ml-1 block">{props.children}</label>
);

const FormError = (props: { errors: any[] }) => (
    <Show when={props.errors.length > 0}>
        <span class="text-sm font-medium text-danger mt-1.5 block">
            {props.errors.map(err => typeof err === 'string' ? err : err?.message || 'Error de validación').join(', ')}
        </span>
    </Show>
);

// =============================================================================
// AddressRow — Sub-component with city Autocomplete + flag
// =============================================================================
interface AddressRowProps {
    form: any;
    index: number;
    onRemove: () => void;
}

const AddressRow: Component<AddressRowProps> = (props) => {
    const cities = useGeoNamesCities();
    const [localCountry, setLocalCountry] = createSignal('');
    const [localCountryCode, setLocalCountryCode] = createSignal('');
    const [inputText, setInputText] = createSignal('');
    const [hydrated, setHydrated] = createSignal(false);

    createEffect(() => {
        const addr = props.form.store.state.values.addresses?.[props.index];
        if (!addr) return;
        const city = addr.city || '';
        const country = addr.country || '';
        const code = addr.countryCode || '';
        if (!hydrated() && city) {
            setHydrated(true);
            setLocalCountry(country);
            setLocalCountryCode(code);
            setInputText(city && country ? `${city}, ${country}` : city);
        }
    });

    const handleCitySelect = (city: GeoNameCity | null) => {
        if (!city) return;
        props.form.setFieldValue(`addresses[${props.index}].city`, city.ciudad);
        props.form.setFieldValue(`addresses[${props.index}].country`, city.pais);
        props.form.setFieldValue(`addresses[${props.index}].countryCode`, city.codigo);
        setLocalCountry(city.pais);
        setLocalCountryCode(city.codigo);
        setInputText(`${city.ciudad}, ${city.pais}`);
    };

    const handleInputChange = (val: string) => {
        if (val === inputText()) return;
        setInputText(val);
        setLocalCountryCode('');
        setLocalCountry('');
        const cityPart = val.includes(',') ? val.split(',')[0].trim() : val;
        props.form.setFieldValue(`addresses[${props.index}].city`, cityPart);
        cities.setSearch(cityPart);
    };

    return (
        <div class="relative grid grid-cols-1 md:grid-cols-12 gap-4 p-4 bg-card rounded-xl border border-border/50 shadow-sm animate-in slide-in-from-top-2">
            <div class="col-span-12 md:col-span-5">
                <props.form.Field name={`addresses[${props.index}].addressLine`}>
                    {(subField: any) => (
                        <TextField.Root field={subField()}>
                            <TextField.Label>Dirección Completa</TextField.Label>
                            <TextField.Input type="text" placeholder="Av. Principal y Secundaria..." />
                            <TextField.ErrorMessage />
                        </TextField.Root>
                    )}
                </props.form.Field>
            </div>
            <div class="col-span-12 sm:col-span-6 md:col-span-4">
                <props.form.Field name={`addresses[${props.index}].city`}>
                    {(subField: any) => (
                        <div class="flex flex-col gap-1">
                            <label class="text-sm font-medium text-muted ml-1">Ciudad</label>
                            <Autocomplete<GeoNameCity>
                                value={inputText()}
                                onInputChange={handleInputChange}
                                options={cities.query.data ?? []}
                                optionValue={(c) => `${c.ciudad}, ${c.pais}`}
                                optionLabel={(c) => `${c.ciudad}, ${c.pais}`}
                                onSelect={handleCitySelect}
                                isLoading={cities.query.isFetching}
                                placeholder="Buscar ciudad..."
                                minLength={2}
                                inputPrefix={
                                    localCountryCode() ? (
                                        <img
                                            src={`https://flagcdn.com/${localCountryCode().toLowerCase()}.svg`}
                                            alt={localCountryCode()}
                                            class="size-5 rounded-sm object-cover shadow-sm"
                                            loading="lazy"
                                        />
                                    ) : undefined
                                }
                                itemRenderer={(city) => (
                                    <div class="flex items-center gap-2.5">
                                        <img
                                            src={city.bandera}
                                            alt={city.codigo}
                                            class="size-5 rounded-sm object-cover shadow-sm flex-shrink-0"
                                            loading="lazy"
                                        />
                                        <div class="flex flex-col min-w-0">
                                            <span class="font-medium text-text truncate">{city.ciudad}</span>
                                            <span class="text-xs text-muted truncate">{city.pais}</span>
                                        </div>
                                    </div>
                                )}
                            />
                        </div>
                    )}
                </props.form.Field>
            </div>
            <div class="col-span-12 sm:col-span-6 md:col-span-2">
                <props.form.Field name={`addresses[${props.index}].postalCode`}>
                    {(subField: any) => (
                        <TextField.Root field={subField()}>
                            <TextField.Label>Código Postal</TextField.Label>
                            <TextField.Input type="text" placeholder="Ej: 170515" />
                            <TextField.ErrorMessage />
                        </TextField.Root>
                    )}
                </props.form.Field>
            </div>
            <div class="col-span-12 md:col-span-1 flex items-center justify-end md:justify-center pt-5">
                <button
                    type="button"
                    onClick={props.onRemove}
                    class="p-2 text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                    title="Eliminar Dirección"
                >
                    <TrashIcon class="size-4" />
                </button>
            </div>
        </div>
    );
};

// =============================================================================
// EntityForm Props
// =============================================================================

export interface EntityFormProps {
    /** Existing entity data for edit mode */
    entity?: any;
    /** Submit handler */
    onSubmit: (data: EntityFormData) => Promise<void>;
    /** Whether the form is currently submitting */
    isSubmitting: boolean;
    /** Pre-lock specific roles (e.g., { isSupplier: true } from SupplierNewSheet) */
    lockedRoles?: Partial<Record<'isClient' | 'isSupplier' | 'isEmployee' | 'isCarrier', boolean>>;
}

// =============================================================================
// EntityForm Component
// =============================================================================

export const EntityForm: Component<EntityFormProps> = (props) => {
    const isEdit = () => !!props.entity;
    const queryClient = useQueryClient();

    // SRI search signals
    const [isSearchingRuc, setIsSearchingRuc] = createSignal(false);
    const [sriError, setSriError] = createSignal('');
    const [sriNameQuery, setSriNameQuery] = createSignal(props.entity?.business_name ?? '');
    const nameSearch = useSriSearchByName(sriNameQuery);

    // Build initial default values from entity (edit) or factory (create)
    const initialValues = (): EntityFormData => {
        if (props.entity) {
            const e = props.entity;
            return {
                taxId: e.tax_id ?? '',
                taxIdType: (e.tax_id_type ?? 'RUC') as TaxIdTypeForm,
                personType: (e.person_type ?? 'NATURAL') as PersonType,
                businessName: e.business_name ?? '',
                tradeName: e.trade_name ?? '',
                emailBilling: e.email_billing ?? '',
                phone: e.phone ?? '',
                isClient: e.is_client ?? false,
                isSupplier: e.is_supplier ?? false,
                isEmployee: e.is_employee ?? false,
                isCarrier: e.is_carrier ?? false,
                taxRegimeType: (e.tax_regime_type ?? undefined) as TaxRegimeType | undefined,
                obligadoContabilidad: e.obligado_contabilidad ?? false,
                isRetentionAgent: e.is_retention_agent ?? false,
                isSpecialContributor: e.is_special_contributor ?? false,
                employeeDetails: e.employeeDetails ? {
                    department: e.employeeDetails.department ?? '',
                    jobTitle: e.employeeDetails.job_title ?? '',
                    salaryBase: e.employeeDetails.salary_base ? Number(e.employeeDetails.salary_base) : undefined,
                    hireDate: e.employeeDetails.hire_date ?? '',
                    costPerHour: e.employeeDetails.cost_per_hour ? Number(e.employeeDetails.cost_per_hour) : undefined,
                } : undefined,
                contacts: e.contacts?.map((c: any) => ({
                    name: c.name, position: c.position ?? '', email: c.email ?? '', phone: c.phone ?? '', isPrimary: c.is_primary ?? false
                })) ?? [],
                addresses: e.addresses?.map((a: any) => ({
                    addressLine: a.address_line, city: a.city ?? '', country: a.country ?? 'Ecuador', countryCode: a.country_code ?? 'EC', postalCode: a.postal_code ?? '', isMain: a.is_main ?? false
                })) ?? [],
            };
        }
        return createDefaultEntityFormValues(props.lockedRoles);
    };

    const form = createForm(() => ({
        defaultValues: initialValues(),
        validatorAdapter: valibotValidator(),
        validators: {
            onChange: EntityFormSchema,
            onSubmit: EntityFormSchema,
        },
        onSubmit: async ({ value }) => {
            try {
                await props.onSubmit(value as EntityFormData);
            } catch (err) {
                if (err instanceof ApiError && err.errors?.length) {
                    for (const fieldErr of err.errors) {
                        try {
                            form.setFieldMeta(fieldErr.field as any, (prev) => ({
                                ...prev,
                                errorMap: { ...prev.errorMap, onSubmit: fieldErr.message },
                            }));
                        } catch { /* field not in form */ }
                    }
                }
            }
        },
    }));

    // =========================================================================
    // REACTIVE SELECTORS — form.useStore() creates SolidJS-tracked accessors
    // (form.store.state.values.xxx is NOT reactive in SolidJS!)
    // =========================================================================

    const taxIdType = form.useStore((s) => s.values.taxIdType);
    const personType = form.useStore((s) => s.values.personType);
    const isEmployeeVal = form.useStore((s) => s.values.isEmployee);
    const isSupplierVal = form.useStore((s) => s.values.isSupplier);
    const isClientVal = form.useStore((s) => s.values.isClient);
    const isCarrierVal = form.useStore((s) => s.values.isCarrier);
    const hasEmployeeDetails = form.useStore((s) => !!s.values.employeeDetails);

    // =========================================================================
    // REACTIVE EFFECTS — Business Rules
    // Guards: ALWAYS check current value before calling setFieldValue to prevent
    // infinite recursion (setFieldValue triggers store update → effects re-run)
    // =========================================================================

    // 1. taxIdType CEDULA → force personType to NATURAL
    createEffect(on(taxIdType, (type) => {
        if (type === 'CEDULA' && personType() !== 'NATURAL') {
            form.setFieldValue('personType', 'NATURAL');
        }
    }, { defer: true }));

    // 2. personType JURIDICA → force obligadoContabilidad, constrain taxIdType
    createEffect(on(personType, (pt) => {
        if (pt === 'JURIDICA') {
            const obligado = form.getFieldValue('obligadoContabilidad');
            if (!obligado) form.setFieldValue('obligadoContabilidad', true);
            const curr = taxIdType();
            if (curr === 'CEDULA' || curr === 'PASAPORTE') {
                form.setFieldValue('taxIdType', 'RUC');
            }
        }
    }, { defer: true }));

    // 3. isEmployee → force personType to NATURAL, initialize/clear employeeDetails
    createEffect(on(isEmployeeVal, (isEmp) => {
        if (isEmp) {
            if (personType() !== 'NATURAL') form.setFieldValue('personType', 'NATURAL');
            if (!hasEmployeeDetails()) {
                form.setFieldValue('employeeDetails', { ...EMPTY_EMPLOYEE_DETAILS });
            }
        } else {
            if (hasEmployeeDetails()) {
                form.setFieldValue('employeeDetails', undefined);
            }
        }
    }, { defer: true }));

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
    const showContacts = createMemo(() => isEmployeeVal() || isSupplierVal() || isClientVal());
    const personTypeLocked = createMemo(() => taxIdType() === 'CEDULA' || isEmployeeVal());
    const taxIdConfig = createMemo(() => getTaxIdConfig(taxIdType()));
    // Compute taxIdType options with disabled flag for JURIDICA
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

    let nameDebounce: ReturnType<typeof setTimeout>;
    onCleanup(() => clearTimeout(nameDebounce));

    const triggerRucSearch = async () => {
        const val = form.getFieldValue('taxId');
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
                } else {
                    setSriError('No se encontró información para este RUC en el SRI.');
                }
            } catch {
                setSriError('Error consultando al SRI. Intente más tarde.');
            } finally {
                setIsSearchingRuc(false);
            }
        } else {
            setSriError('El RUC debe tener 13 dígitos.');
        }
    };

    const handleNameInput = (value: string) => {
        if (form.getFieldValue('businessName') === value) return;
        form.setFieldValue('businessName', value);
        clearTimeout(nameDebounce);
        nameDebounce = setTimeout(() => setSriNameQuery(value), 400);
    };

    const handleSriSelect = (source: 'RUC' | 'NAME') => (supplierResult: SriSupplierResponse | null) => {
        if (!supplierResult) return;
        clearTimeout(nameDebounce);

        batch(() => {
            form.setFieldValue('taxId', supplierResult.ruc);
            form.setFieldValue('businessName', supplierResult.razonSocial);
            form.setFieldValue('tradeName', supplierResult.nombreComercial ?? '');
            form.setFieldValue('taxIdType', 'RUC');
            form.setFieldValue('personType', supplierResult.isSociedad ? 'JURIDICA' : 'NATURAL');
            form.setFieldValue('obligadoContabilidad', !!supplierResult.obligadoContabilidad);
            form.setFieldValue('isRetentionAgent', !!supplierResult.agenteRetencion);
            form.setFieldValue('isSpecialContributor', !!supplierResult.contribuyenteEspecial);
            form.setFieldValue('taxRegimeType', supplierResult.isRimpe ? 'RIMPE_EMPRENDEDOR' : 'GENERAL');
        });

        if (source === 'NAME') {
            queryClient.setQueryData(['sri', 'by-name', supplierResult.razonSocial], [supplierResult]);
            setSriNameQuery(supplierResult.razonSocial);
        }

        if (supplierResult.city) {
            const addresses = form.getFieldValue('addresses');
            if (addresses.length === 0) {
                form.pushFieldValue('addresses', {
                    addressLine: '', city: supplierResult.city, country: 'Ecuador', countryCode: 'EC', postalCode: '', isMain: true,
                });
            }
        }
    };

    // =========================================================================
    // Render
    // =========================================================================

    return (
        <form
            id="entity-form"
            onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                form.handleSubmit();
            }}
            class="flex flex-col"
        >
            <Tabs defaultValue="general" class="w-full h-full flex flex-col">
                {/* Tabs Header Sticky */}
                <div class="sticky top-0 z-20 max-w-full bg-card pt-4">
                    <TabsList class="flex overflow-x-auto shadow-sm rounded-xl">
                        <TabsTrigger value="general"><InfoIcon /> General</TabsTrigger>
                        <Show when={showContacts()}>
                            <form.Subscribe selector={(state) => state.values.contacts?.length || 0}>
                                {(count) => (
                                    <TabsTrigger value="contacts" count={count()}>
                                        <UsersIcon class="size-4" /> Contactos
                                    </TabsTrigger>
                                )}
                            </form.Subscribe>
                        </Show>
                        <form.Subscribe selector={(state) => state.values.addresses?.length || 0}>
                            {(count) => (
                                <TabsTrigger value="addresses" count={count()}>
                                    <MapPinIcon class="size-4" /> Direcciones
                                </TabsTrigger>
                            )}
                        </form.Subscribe>
                    </TabsList>
                </div>

                <div class="pt-3">
                    {/* ===== GENERAL TAB ===== */}
                    <TabsContent value="general" class="w-full space-y-6">

                        {/* --- Roles Section --- */}
                        <fieldset class="space-y-4 bg-surface/30 p-4 rounded-2xl border border-border/40">
                            <div class="flex items-center gap-2 mb-2">
                                <div class="w-1.5 h-4 bg-warning rounded-full"></div>
                                <h3 class="font-semibold text-text uppercase tracking-wide text-sm">Tipo de Entidad</h3>
                            </div>
                            <div class="flex flex-wrap gap-x-6 gap-y-3">
                                {(Object.entries(roleLabels) as [keyof typeof roleLabels, string][]).map(([key, label]) => (
                                    <form.Field name={key}>
                                        {(field) => (
                                            <Checkbox
                                                field={field()}
                                                class="font-medium"
                                                disabled={!!props.lockedRoles?.[key]}
                                            >
                                                {label}
                                            </Checkbox>
                                        )}
                                    </form.Field>
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
                                <form.Field name="taxIdType">
                                    {(field) => (
                                        <div class="space-y-1.5">
                                            <FieldLabel>Tipo ID</FieldLabel>
                                            <Select
                                                value={computedTaxIdTypeOptions().find(o => o.value === field().state.value)}
                                                onChange={(opt) => opt && field().handleChange(opt.value)}
                                                options={computedTaxIdTypeOptions()}
                                                optionValue="value"
                                                optionTextValue="label"
                                                optionDisabled="disabled"
                                                disabled={isEdit()}
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
                                </form.Field>

                                <form.Field name="taxId">
                                    {(field) => (
                                        <TextField.Root field={field()}>
                                            <TextField.Label>Número de Identificación</TextField.Label>
                                            <div class="relative flex items-center w-full">
                                                <TextField.Input
                                                    type="text"
                                                    placeholder={taxIdConfig().placeholder}
                                                    maxLength={taxIdConfig().maxLength}
                                                    disabled={isEdit()}
                                                    onKeyDown={(e) => {
                                                        setSriError('');
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            triggerRucSearch();
                                                        }
                                                    }}
                                                    class="pr-10"
                                                />
                                                <Show when={!isEdit() && taxIdType() === 'RUC'}>
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
                                </form.Field>
                            </div>

                            <form.Field name="personType">
                                {(field) => (
                                    <div class="space-y-1.5 w-full sm:w-1/2 pr-2.5">
                                        <FieldLabel>Tipo Persona</FieldLabel>
                                        <SegmentedControl
                                            value={field().state.value}
                                            onChange={(val) => field().handleChange(val as PersonType)}
                                            disabled={personTypeLocked() || isEdit()}
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
                                        <Show when={personTypeLocked() && !isEdit()}>
                                            <small class="text-xs text-muted ml-1">
                                                {taxIdType() === 'CEDULA'
                                                    ? 'Cédula solo aplica a Persona Natural'
                                                    : 'Empleado siempre es Persona Natural'}
                                            </small>
                                        </Show>
                                        <FormError errors={field().state.meta.errors} />
                                    </div>
                                )}
                            </form.Field>
                        </fieldset>

                        {/* --- Business Info Section --- */}
                        <fieldset class="space-y-4 bg-surface/30 p-4 rounded-2xl border border-border/40">
                            <div class="flex items-center gap-2 mb-2">
                                <div class="w-1.5 h-4 bg-success rounded-full"></div>
                                <h3 class="font-semibold text-text uppercase tracking-wide text-sm">Empresa / Titular</h3>
                            </div>

                            <form.Field name="businessName">
                                {(field) => (
                                    <div class="space-y-1.5 flex flex-col">
                                        <FieldLabel>Razón Social (Búsqueda Autónoma SRI)</FieldLabel>
                                        <Autocomplete<SriSupplierResponse>
                                            value={field().state.value}
                                            onInputChange={handleNameInput}
                                            options={field().state.value.length >= 3 ? (nameSearch.data ?? []) : []}
                                            optionValue={(opt) => opt.razonSocial}
                                            optionLabel={(opt) => opt.razonSocial}
                                            itemRenderer={(opt) => (
                                                <div class="flex flex-col w-full gap-1">
                                                    <div class="flex w-full items-center justify-between">
                                                        <span class="font-medium text-text truncate max-w-[70%]">{opt.razonSocial}</span>
                                                        <span class={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${opt.isActive ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>
                                                            {opt.isActive ? 'Activo' : 'Suspendido'}
                                                        </span>
                                                    </div>
                                                    <div class="flex w-full items-center gap-2 text-xs text-muted">
                                                        <span class="font-mono bg-surface-alt px-1.5 py-0.5 rounded border border-border">{opt.ruc}</span>
                                                        <Show when={opt.nombreComercial && opt.nombreComercial !== opt.razonSocial}>
                                                            <span class="truncate">({opt.nombreComercial})</span>
                                                        </Show>
                                                    </div>
                                                </div>
                                            )}
                                            onSelect={handleSriSelect('NAME')}
                                            isLoading={nameSearch.isFetching}
                                            disabled={isEdit()}
                                            placeholder="Ej: Ingrese 3 letras o más para Autocompletar SRI"
                                        />
                                        <FormError errors={field().state.meta.errors} />
                                    </div>
                                )}
                            </form.Field>

                            <form.Field name="tradeName">
                                {(field) => (
                                    <TextField.Root field={field()}>
                                        <TextField.Label>Nombre Comercial</TextField.Label>
                                        <TextField.Input type="text" placeholder="Marca (opcional)" />
                                        <TextField.ErrorMessage />
                                        <TextField.Description>Nombre con el que es conocida comúnmente en el mercado</TextField.Description>
                                    </TextField.Root>
                                )}
                            </form.Field>
                        </fieldset>

                        {/* --- Contact Section (email, phone) --- */}
                        <fieldset class="space-y-4 bg-surface/30 p-4 rounded-2xl border border-border/40">
                            <div class="flex items-center gap-2 mb-2">
                                <div class="w-1.5 h-4 bg-info rounded-full"></div>
                                <h3 class="font-semibold text-text uppercase tracking-wide text-sm">Contacto Predeterminado</h3>
                            </div>
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
                                            <TextField.Label>Teléfono Principal</TextField.Label>
                                            <TextField.Input type="tel" placeholder="(02) 299 9999" />
                                        </TextField.Root>
                                    )}
                                </form.Field>
                            </div>
                        </fieldset>

                        {/* --- Tax Section (conditionally visible) --- */}
                        <Show when={showTaxSection()}>
                            <fieldset class="space-y-4 bg-surface/30 p-4 rounded-2xl border border-border/40">
                                <div class="flex items-center gap-2 mb-2">
                                    <div class="w-1.5 h-4 bg-info rounded-full"></div>
                                    <h3 class="font-semibold text-text uppercase tracking-wide text-sm">Clasificación SRI</h3>
                                </div>
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-0 sm:gap-4 place-items-start">
                                    <form.Field name="taxRegimeType">
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
                                    </form.Field>

                                    <div class="flex flex-col gap-3 pt-6 h-full justify-center pl-2">
                                        <form.Field name="obligadoContabilidad">
                                            {(field) => (
                                                <Checkbox
                                                    field={field()}
                                                    class="font-medium"
                                                    disabled={personType() === 'JURIDICA'}
                                                >
                                                    Obligado a llevar contabilidad
                                                </Checkbox>
                                            )}
                                        </form.Field>
                                        <form.Field name="isRetentionAgent">
                                            {(field) => (
                                                <Checkbox field={field()} class="font-medium">
                                                    Agente de Retención
                                                </Checkbox>
                                            )}
                                        </form.Field>
                                        <form.Field name="isSpecialContributor">
                                            {(field) => (
                                                <Checkbox field={field()} class="font-medium text-danger">
                                                    Contribuyente Especial
                                                </Checkbox>
                                            )}
                                        </form.Field>
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
                                    <form.Field name="employeeDetails.department">
                                        {(field) => (
                                            <TextField.Root field={field()}>
                                                <TextField.Label>Departamento</TextField.Label>
                                                <TextField.Input type="text" placeholder="Ej: Producción" />
                                            </TextField.Root>
                                        )}
                                    </form.Field>
                                    <form.Field name="employeeDetails.jobTitle">
                                        {(field) => (
                                            <TextField.Root field={field()}>
                                                <TextField.Label>Cargo</TextField.Label>
                                                <TextField.Input type="text" placeholder="Ej: Operador CNC" />
                                            </TextField.Root>
                                        )}
                                    </form.Field>
                                    <form.Field name="employeeDetails.hireDate">
                                        {(field) => (
                                            <TextField.Root field={field()}>
                                                <TextField.Label>Fecha de Contratación</TextField.Label>
                                                <TextField.Input type="date" />
                                            </TextField.Root>
                                        )}
                                    </form.Field>
                                    <form.Field name="employeeDetails.salaryBase">
                                        {(field) => (
                                            <TextField.Root field={field()}>
                                                <TextField.Label>Salario Base ($)</TextField.Label>
                                                <TextField.Input type="number" placeholder="0.00" step="0.01" />
                                            </TextField.Root>
                                        )}
                                    </form.Field>
                                    <form.Field name="employeeDetails.costPerHour">
                                        {(field) => (
                                            <TextField.Root field={field()}>
                                                <TextField.Label>Costo por Hora ($)</TextField.Label>
                                                <TextField.Input type="number" placeholder="0.00" step="0.01" />
                                            </TextField.Root>
                                        )}
                                    </form.Field>
                                </div>
                            </fieldset>
                        </Show>

                    </TabsContent>

                    {/* ===== CONTACTS TAB ===== */}
                    <Show when={showContacts()}>
                        <TabsContent value="contacts" forceMount={false} class="w-full max-w-5xl">
                            <form.Field name="contacts" mode="array">
                                {(field) => (
                                    <div class="bg-surface/30 p-4 rounded-2xl border border-border/40">
                                        <div class="flex items-center justify-between flex-wrap gap-3 mb-4 pb-3 border-b border-border/50">
                                            <div class="flex items-center gap-2">
                                                <div class="w-1.5 h-4 bg-primary rounded-full"></div>
                                                <h3 class="font-semibold text-text uppercase tracking-wide text-sm">Lista de Contactos (Opcional)</h3>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                class="gap-1.5"
                                                onClick={() => field().pushValue({ name: '', position: '', email: '', phone: '', isPrimary: false })}
                                            >
                                                <PlusIcon class="size-4" /> Añadir Contacto
                                            </Button>
                                        </div>
                                        <div class="space-y-4">
                                            <Show when={field().state.value.length === 0}>
                                                <div class="text-center py-6 text-muted bg-surface/50 rounded-lg border border-dashed border-border/60">
                                                    No hay contactos adicionales configurados.<br />Click en "Añadir Contacto" para empezar.
                                                </div>
                                            </Show>
                                            <Index each={field().state.value}>
                                                {(_, i) => (
                                                    <div class="relative grid grid-cols-1 md:grid-cols-12 gap-4 p-4 bg-card rounded-xl border border-border/50 shadow-sm animate-in slide-in-from-top-2">
                                                        <div class="col-span-12 md:col-span-3">
                                                            <form.Field name={`contacts[${i}].name`}>
                                                                {(subField) => (
                                                                    <TextField.Root field={subField()}>
                                                                        <TextField.Label>Nombre Completo</TextField.Label>
                                                                        <TextField.Input type="text" placeholder="Ej: Juan Pérez" />
                                                                        <TextField.ErrorMessage />
                                                                    </TextField.Root>
                                                                )}
                                                            </form.Field>
                                                        </div>
                                                        <div class="col-span-12 md:col-span-3">
                                                            <form.Field name={`contacts[${i}].position`}>
                                                                {(subField) => (
                                                                    <TextField.Root field={subField()}>
                                                                        <TextField.Label>Cargo/Área</TextField.Label>
                                                                        <TextField.Input type="text" placeholder="Ej: Ventas" />
                                                                        <TextField.ErrorMessage />
                                                                    </TextField.Root>
                                                                )}
                                                            </form.Field>
                                                        </div>
                                                        <div class="col-span-12 md:col-span-3">
                                                            <form.Field name={`contacts[${i}].email`}>
                                                                {(subField) => (
                                                                    <TextField.Root field={subField()}>
                                                                        <TextField.Label>Email</TextField.Label>
                                                                        <TextField.Input type="email" placeholder="@" />
                                                                        <TextField.ErrorMessage />
                                                                    </TextField.Root>
                                                                )}
                                                            </form.Field>
                                                        </div>
                                                        <div class="col-span-12 md:col-span-2">
                                                            <form.Field name={`contacts[${i}].phone`}>
                                                                {(subField) => (
                                                                    <TextField.Root field={subField()}>
                                                                        <TextField.Label>Teléfono</TextField.Label>
                                                                        <TextField.Input type="text" placeholder="099..." />
                                                                        <TextField.ErrorMessage />
                                                                    </TextField.Root>
                                                                )}
                                                            </form.Field>
                                                        </div>
                                                        <div class="col-span-12 md:col-span-1 flex items-center justify-end md:justify-center pt-5">
                                                            <button
                                                                type="button"
                                                                onClick={() => field().removeValue(i)}
                                                                class="p-2 text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                                                                title="Eliminar Contacto"
                                                            >
                                                                <TrashIcon class="size-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </Index>
                                        </div>
                                    </div>
                                )}
                            </form.Field>
                        </TabsContent>
                    </Show>

                    {/* ===== ADDRESSES TAB ===== */}
                    <TabsContent value="addresses" forceMount={false} class="w-full max-w-5xl">
                        <form.Field name="addresses" mode="array">
                            {(field) => (
                                <div class="bg-surface/30 p-4 rounded-2xl border border-border/40">
                                    <div class="flex items-center justify-between flex-wrap gap-3 mb-4 pb-3 border-b border-border/50">
                                        <div class="flex items-center gap-2">
                                            <div class="w-1.5 h-4 bg-primary rounded-full"></div>
                                            <h3 class="font-semibold text-text uppercase tracking-wide text-sm">Direcciones &amp; Sucursales</h3>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            class="gap-1.5"
                                            onClick={() => field().pushValue({ addressLine: '', city: '', country: 'Ecuador', countryCode: 'EC', postalCode: '', isMain: field().state.value.length === 0 })}
                                        >
                                            <PlusIcon class="size-4" /> Añadir Ubicación
                                        </Button>
                                    </div>
                                    <div class="space-y-4">
                                        <Show when={field().state.value.length === 0}>
                                            <div class="text-center py-6 text-muted bg-surface/50 rounded-lg border border-dashed border-border/60">
                                                No hay direcciones asignadas. Click en "Añadir Ubicación" para empezar.
                                            </div>
                                        </Show>
                                        <Index each={field().state.value}>
                                            {(_, i) => (
                                                <AddressRow form={form} index={i} onRemove={() => field().removeValue(i)} />
                                            )}
                                        </Index>
                                    </div>
                                </div>
                            )}
                        </form.Field>
                    </TabsContent>
                </div>
            </Tabs>
        </form>
    );
};
