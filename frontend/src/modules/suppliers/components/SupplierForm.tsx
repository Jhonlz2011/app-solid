import { Component, createSignal, Show, Index, onCleanup, createEffect } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import { useQueryClient } from '@tanstack/solid-query';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { SupplierFormSchema, type SupplierFormData } from '@app/schema/frontend';
import { ApiError } from '@shared/utils/api-errors';

import type { Supplier, SupplierPayload, TaxIdType, PersonType, TaxRegimeType } from '../models/supplier.types';
import { taxIdTypeLabels, personTypeLabels, taxRegimeTypeLabels } from '../models/supplier.types';
import { useSriSearchByName, type SriSupplierResponse } from '../data/suppliers.api';
import { api } from '@shared/lib/eden';
import { useGeoNamesCities, type GeoNameCity } from '@shared/hooks/useGeoNamesCities';
import Button from '@shared/ui/Button';
import TextField from '@shared/ui/TextField';
import Checkbox from '@shared/ui/Checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@shared/ui/Select';
import { Autocomplete } from '@shared/ui/Autocomplete';
import { SearchIcon, PlusIcon, TrashIcon, InfoIcon, UsersIcon, MapPinIcon, FileTextIcon, ScalesIcon } from '@shared/ui/icons';
import { CounterBadge } from '@shared/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@shared/ui/Tabs';
import { 
  SegmentedControl, 
  SegmentedControlIndicator, 
  SegmentedControlItem, 
  SegmentedControlItemInput, 
  SegmentedControlItemLabel 
} from '@shared/ui/SegmentedControl';
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
    onSubmit: (data: SupplierFormData) => Promise<void>;
    isSubmitting: boolean;
}

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

    // Local signals for reactive UI
    const [localCountry, setLocalCountry] = createSignal('');
    const [localCountryCode, setLocalCountryCode] = createSignal('');
    const [inputText, setInputText] = createSignal('');

    // Track whether initial hydration has occurred to avoid overwriting user edits.
    const [hydrated, setHydrated] = createSignal(false);

    // Sync local signals from the form store reactively.
    // This handles: initial mount, edit-mode rehydration, and tab re-activation (forceMount).
    createEffect(() => {
        const addr = props.form.store.state.values.addresses?.[props.index];
        if (!addr) return;
        const city = addr.city || '';
        const country = addr.country || '';
        const code = addr.countryCode || '';

        // Only hydrate once from the form store (on mount / rehydration).
        // After the first sync, user interactions drive the local signals.
        if (!hydrated() && city) {
            setHydrated(true);
            setLocalCountry(country);
            setLocalCountryCode(code);
            setInputText(city && country ? `${city}, ${country}` : city);
        }
    });

    /** When a city is selected from the dropdown */
    const handleCitySelect = (city: GeoNameCity | null) => {
        if (!city) return;
        // Update form fields for submission
        props.form.setFieldValue(`addresses[${props.index}].city`, city.ciudad);
        props.form.setFieldValue(`addresses[${props.index}].country`, city.pais);
        props.form.setFieldValue(`addresses[${props.index}].countryCode`, city.codigo);
        // Update local signals
        setLocalCountry(city.pais);
        setLocalCountryCode(city.codigo);
        setInputText(`${city.ciudad}, ${city.pais}`);
    };

    /** When user types freely in the input */
    const handleInputChange = (val: string) => {
        // Guard: skip if Kobalte is re-syncing the same value (prevents clearing countryCode)
        if (val === inputText()) return;
        setInputText(val);
        // User is typing freely → clear the country selection so the flag hides
        setLocalCountryCode('');
        setLocalCountry('');
        // Extract city part (before comma if any)
        const cityPart = val.includes(',') ? val.split(',')[0].trim() : val;
        props.form.setFieldValue(`addresses[${props.index}].city`, cityPart);
        cities.setSearch(cityPart);
    };

    return (
        <div class="relative grid grid-cols-1 md:grid-cols-12 gap-4 p-4 bg-card rounded-xl border border-border/50 shadow-sm animate-in slide-in-from-top-2">
            {/* Dirección */}
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

            {/* Ciudad — Autocomplete with flag + "City, Country" display */}
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

            {/* Código Postal */}
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

            {/* Eliminar */}
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

export const SupplierForm: Component<SupplierFormProps> = (props) => {
    const isEdit = () => !!props.supplier;
    
    // Signals for SRI search
    // Signals for SRI search
    const [isSearchingRuc, setIsSearchingRuc] = createSignal(false);
    const [sriError, setSriError] = createSignal('');
    const [sriNameQuery, setSriNameQuery] = createSignal(props.supplier?.business_name ?? '');

    const nameSearch = useSriSearchByName(sriNameQuery);
    const queryClient = useQueryClient();

    // Server error signal for form-level errors (non-field)

    const form = createForm(() => ({
        defaultValues: {
            taxId: props.supplier?.tax_id ?? '',
            taxIdType: (props.supplier?.tax_id_type ?? 'RUC') as 'RUC' | 'CEDULA' | 'PASAPORTE' | 'CONSUMIDOR_FINAL' | 'EXTERIOR',
            personType: (props.supplier?.person_type ?? 'JURIDICA') as 'NATURAL' | 'JURIDICA',
            businessName: props.supplier?.business_name ?? '',
            tradeName: props.supplier?.trade_name ?? '',
            emailBilling: props.supplier?.email_billing ?? '',
            phone: props.supplier?.phone ?? '',
            taxRegimeType: (props.supplier?.tax_regime_type ?? undefined) as 'RIMPE_NEGOCIO_POPULAR' | 'RIMPE_EMPRENDEDOR' | 'GENERAL' | undefined,
            obligadoContabilidad: props.supplier?.obligado_contabilidad ?? false,
            isRetentionAgent: props.supplier?.is_retention_agent ?? false,
            isSpecialContributor: props.supplier?.is_special_contributor ?? false,
            contacts: props.supplier?.contacts?.map(c => ({
                name: c.name, position: c.position ?? '', email: c.email ?? '', phone: c.phone ?? '', isPrimary: c.is_primary ?? false
            })) ?? [],
            addresses: props.supplier?.addresses?.map(a => ({
                addressLine: a.address_line, city: a.city ?? '', country: a.country ?? 'Ecuador', countryCode: a.country_code ?? 'EC', postalCode: a.postal_code ?? '', isMain: a.is_main ?? false
            })) ?? []
        },
        validatorAdapter: valibotValidator(),
        validators: {
            onChange: SupplierFormSchema,
            onSubmit: SupplierFormSchema,
        },
        onSubmit: async ({ value }) => {
            try {
                await props.onSubmit(value as SupplierFormData);
            } catch (err) {
                // Map server field errors to form fields
                if (err instanceof ApiError && err.errors?.length) {
                    for (const fieldErr of err.errors) {
                        try {
                            form.setFieldMeta(fieldErr.field as any, (prev) => ({
                                ...prev,
                                errorMap: {
                                    ...prev.errorMap,
                                    onSubmit: fieldErr.message,
                                },
                            }));
                        } catch {
                            // Field not found in form — show as form-level error
                           
                        }
                    }
                }
                // Set form-level error for non-field errors
                const msg = err instanceof ApiError ? err.message : (err instanceof Error ? err.message : 'Error del servidor');
            }
        },
    }));

    // Debounced input handlers
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
            setSriError('El RUC debe tener 13 dígitos.');
        }
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

        // Auto-fill address from SRI canton (city)
        if (supplierResult.city) {
            const addresses = form.getFieldValue('addresses');
            if (addresses.length === 0) {
                form.pushFieldValue('addresses', {
                    addressLine: '',
                    city: supplierResult.city,
                    country: 'Ecuador',
                    countryCode: 'EC',
                    postalCode: '',
                    isMain: true,
                });
            }
        }
    };

    return (
        <form
            id="supplier-form"
            onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                form.handleSubmit();
            }}
            class="flex flex-col"
        >
                <Tabs defaultValue="general" class="w-full h-full flex flex-col ">
                    {/* Tabs Header Sticky */}
                    <div class="sticky top-0 z-20 max-w-full bg-card pt-4">
                        <TabsList class="flex overflow-x-auto shadow-sm rounded-xl ">
                            <TabsTrigger value="general"><InfoIcon/> General</TabsTrigger>
                            <form.Subscribe selector={(state) => state.values.contacts?.length || 0}>
                                {(count) => (
                                    <TabsTrigger value="contacts" count={count()}>
                                        <UsersIcon class="size-4"/> Contactos
                                    </TabsTrigger>
                                )}
                            </form.Subscribe>
                            <form.Subscribe selector={(state) => state.values.addresses?.length || 0}>
                                {(count) => (
                                    <TabsTrigger value="addresses" count={count()}>
                                        <MapPinIcon class="size-4"/> Direcciones
                                    </TabsTrigger>
                                )}
                            </form.Subscribe>
                            {/* <TabsTrigger value="fiscal"><ScalesIcon class="size-4" /> Datos Fiscales</TabsTrigger> */}
                        </TabsList>
                    </div>

                    <div class="pt-3">
                        {/* 1. General Tab */}
                        <TabsContent value="general" class="w-full space-y-6">
                            {/* Identificación */}
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
                                                            setSriError('');
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                triggerRucSearch();
                                                            }
                                                        }}
                                                        class="pr-10"
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
                                                {/* <Show when={field().state.meta.errors.length > 0}>
                                                    <FormError errors={field().state.meta.errors} />
                                                </Show> */}
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
                                                onChange={(val) => field().handleChange(val as 'NATURAL' | 'JURIDICA')} 
                                                disabled={isEdit()}
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
                                            <FormError errors={field().state.meta.errors} />
                                        </div>
                                    )}
                                </form.Field>
                            </fieldset>

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
                                                <div class="flex items-start">
                                                    <Checkbox field={field()} class="font-medium">
                                                        Obligado a llevar contabilidad
                                                    </Checkbox>
                                                </div>
                                            )}
                                        </form.Field>

                                        <form.Field name="isRetentionAgent">
                                            {(field) => (
                                                <div class="flex items-start">
                                                    <Checkbox field={field()} class="font-medium">
                                                        Agente de Retención
                                                    </Checkbox>
                                                </div>
                                            )}
                                        </form.Field>

                                        <form.Field name="isSpecialContributor">
                                            {(field) => (
                                                <div class="flex items-start">
                                                    <Checkbox field={field()} class="font-medium text-danger">
                                                        Contribuyente Especial
                                                    </Checkbox>
                                                </div>
                                            )}
                                        </form.Field>
                                    </div>
                                </div>
                            </fieldset>
                        </TabsContent>

                        {/* 2. Contacts Tab */}
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
                                                    No hay contactos adicionales configurados.<br/> Click en "Añadir Contacto" para empezar.
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

                        {/* 3. Addresses Tab */}
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

                        {/* 4. Fiscal Tab */}
                        {/* <TabsContent value="fiscal" class="w-full max-w-3xl ">
                            <fieldset class="space-y-4 bg-surface/30 p-4 rounded-2xl border border-border/40">
                                <div class="flex items-center gap-2 mb-2">
                                    <div class="w-1.5 h-4 bg-info rounded-full"></div>
                                    <h3 class="font-semibold text-text uppercase tracking-wide text-sm">Clasificación SRI</h3>
                                </div>

                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-5 place-items-start">
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
                                                <div class="flex items-start">
                                                    <Checkbox field={field()} class="font-medium">
                                                        Obligado a llevar contabilidad
                                                    </Checkbox>
                                                </div>
                                            )}
                                        </form.Field>

                                        <form.Field name="isRetentionAgent">
                                            {(field) => (
                                                <div class="flex items-start">
                                                    <Checkbox field={field()} class="font-medium">
                                                        Agente de Retención
                                                    </Checkbox>
                                                </div>
                                            )}
                                        </form.Field>

                                        <form.Field name="isSpecialContributor">
                                            {(field) => (
                                                <div class="flex items-start">
                                                    <Checkbox field={field()} class="font-medium text-danger">
                                                        Contribuyente Especial
                                                    </Checkbox>
                                                </div>
                                            )}
                                        </form.Field>
                                    </div>
                                </div>
                            </fieldset>
                        </TabsContent> */}
                    </div>
                </Tabs>
        </form>
    );
};
