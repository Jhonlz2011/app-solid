import { Component, createSignal, Show, Index, batch, createMemo } from 'solid-js';
import type { EntityFormData, TaxIdTypeForm, PersonType, TaxRegimeType } from '@app/schema/frontend';
import { useQueryClient, createQuery, createMutation } from '@tanstack/solid-query';
import { toast } from 'solid-sonner';
import { api } from '@shared/lib/eden';
import type { SriSearchResult } from '@modules/sri/sri.types';
import { fetchSriByRuc, sriKeys } from '@modules/sri/sri.queries';
import { STALE_TIME } from '@shared/constants/cache.constants';
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

import TextField, { FieldLabel } from '@form/TextField';
import Checkbox from '@form/Checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@form/Select';
import { SriBusinessNameSelect } from '@shared/ui/selectors';
import { SearchIcon } from '@icons/SearchIcon';
import { BriefcaseIcon } from '@icons/BriefcaseIcon';
import { PlusIcon } from '@icons/PlusIcon';
import { useAuth } from '@modules/auth/store/auth.store';
import {
    SegmentedControl,
    SegmentedControlIndicator,
    SegmentedControlItem,
    SegmentedControlItemInput,
    SegmentedControlItemLabel
} from '@form/SegmentedControl';

import type { EntityFormApi } from '../entity-form.types';

export interface EntityGeneralTabProps {
    form: EntityFormApi;
    isEdit: () => boolean;
    lockedRoles?: Partial<Record<'isClient' | 'isSupplier' | 'isEmployee' | 'isCarrier', boolean>>;
}

export const EntityGeneralTab: Component<EntityGeneralTabProps> = (props) => {
    const auth = useAuth();
    const queryClient = useQueryClient();
    let businessNameInputRef: HTMLInputElement | undefined;

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
    const isPureEmployee = createMemo(() => isEmployeeVal() && !isSupplierVal() && !isClientVal() && !isCarrierVal());

    // SRI Section: hide if pure employee, or if CEDULA/PASAPORTE without being a supplier
    const showTaxSection = createMemo(() => {
        if (isPureEmployee()) return false;
        if ((taxIdType() === 'CEDULA' || taxIdType() === 'PASAPORTE') && !isSupplierVal()) return false;
        if (taxIdType() === 'RUC') return true;
        if (isSupplierVal()) return true;
        return false;
    });

    const showEmployeeSection = createMemo(() => isEmployeeVal());

    const showTradeName = createMemo(() => {
        if (isPureEmployee()) return false;
        if ((taxIdType() === 'CEDULA' || taxIdType() === 'PASAPORTE') && !isSupplierVal() && !isClientVal()) return false;
        return true;
    });

    const businessNameLabel = createMemo(() => {
        if (isPureEmployee() || (taxIdType() === 'CEDULA' && !isSupplierVal())) {
            return 'Nombres y Apellidos';
        }
        return taxIdType() === 'RUC' ? 'Razón Social (Búsqueda SRI)' : 'Razón Social';
    });

    const businessNamePlaceholder = createMemo(() => {
        if (isPureEmployee() || taxIdType() === 'CEDULA') {
            return 'Ej: Juan Carlos Pérez González';
        }
        return 'Ej: Corporación Favorita C.A.';
    });

    const personTypeLocked = createMemo(() => taxIdType() === 'CEDULA' || taxIdType() === 'PASAPORTE' || isEmployeeVal());

    const personTypeTooltip = createMemo(() => {
        if (props.isEdit()) return undefined;
        if (taxIdType() === 'CEDULA') return 'La Cédula de Identidad solo aplica a Persona Natural';
        if (taxIdType() === 'PASAPORTE') return 'El Pasaporte solo aplica a Persona Natural';
        if (isEmployeeVal()) return 'Un empleado debe registrarse obligatoriamente como Persona Natural';
        return undefined;
    });

    const taxIdConfig = createMemo(() => getTaxIdConfig(taxIdType()));

    const computedTaxIdTypeOptions = createMemo(() => {
        const disabledKeys = getTaxIdTypeDisabledKeys(personType());
        return taxIdTypeOptions.map(opt => ({
            ...opt,
            disabled: disabledKeys.includes(opt.value),
        }));
    });

    // =========================================================================
    // Departments & Job Titles (HR / Employees)
    // =========================================================================
    const departmentsQuery = createQuery(() => ({
        queryKey: ['entities', 'departments'],
        queryFn: async () => {
            const { data, error } = await api.api.entities.departments.get();
            if (error) throw error;
            return (data || []) as Array<{ id: number; name: string; code?: string | null; is_active: boolean }>;
        },
        staleTime: STALE_TIME.MEDIUM,
        enabled: showEmployeeSection(),
    }));

    const jobTitlesQuery = createQuery(() => ({
        queryKey: ['entities', 'job-titles'],
        queryFn: async () => {
            const { data, error } = await api.api.entities['job-titles'].get({ query: {} });
            if (error) throw error;
            return (data || []) as Array<{ id: number; name: string; department_id?: number | null; is_active: boolean }>;
        },
        staleTime: STALE_TIME.MEDIUM,
        enabled: showEmployeeSection(),
    }));

    const createDeptMutation = createMutation(() => ({
        mutationFn: async (name: string) => {
            const { data, error } = await api.api.entities.departments.post({ name });
            if (error) throw error;
            return data!;
        },
        onSuccess: (newDept) => {
            queryClient.invalidateQueries({ queryKey: ['entities', 'departments'] });
            props.form.setFieldValue('employeeDetails.departmentId', newDept.id);
            toast.success(`Departamento "${newDept.name}" creado`);
        },
    }));

    const createJobTitleMutation = createMutation(() => ({
        mutationFn: async (name: string) => {
            const deptId = props.form.getFieldValue('employeeDetails.departmentId');
            const { data, error } = await api.api.entities['job-titles'].post({ name, departmentId: deptId ?? undefined });
            if (error) throw error;
            return data!;
        },
        onSuccess: (newJob) => {
            queryClient.invalidateQueries({ queryKey: ['entities', 'job-titles'] });
            props.form.setFieldValue('employeeDetails.jobTitleId', newJob.id);
            toast.success(`Cargo "${newJob.name}" creado`);
        },
    }));

    const handleCreateDepartment = () => {
        const name = prompt('Nombre del nuevo departamento:');
        if (name && name.trim()) {
            createDeptMutation.mutate(name.trim());
        }
    };

    const handleCreateJobTitle = () => {
        const name = prompt('Nombre del nuevo cargo:');
        if (name && name.trim()) {
            createJobTitleMutation.mutate(name.trim());
        }
    };

    // =========================================================================
    // SRI Integration
    // =========================================================================
    const [isSearchingRuc, setIsSearchingRuc] = createSignal(false);
    const [sriError, setSriError] = createSignal('');

    const triggerRucSearch = async () => {
        const val = props.form.getFieldValue('taxId');
        if (val.length === 13) {
            try {
                setSriError('');
                setIsSearchingRuc(true);
                const data = await queryClient.fetchQuery({
                    queryKey: sriKeys.byRuc(val),
                    queryFn: () => fetchSriByRuc(val),
                    staleTime: STALE_TIME.DAY,
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
                    queueMicrotask(() => {
                        businessNameInputRef?.focus();
                        businessNameInputRef?.select();
                    });
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
        if (props.form.getFieldValue('businessName') === value) return;
        props.form.setFieldValue('businessName', value);
    };

    const handleSriSelect = (source: 'RUC' | 'NAME') => (supplierResult: SriSearchResult | null) => {
        if (!supplierResult) return;

        props.form.setFieldValue('taxId', supplierResult.ruc);
        props.form.setFieldValue('businessName', supplierResult.razonSocial);
        props.form.setFieldValue('tradeName', supplierResult.nombreComercial ?? '');
        props.form.setFieldValue('taxIdType', 'RUC');
        props.form.setFieldValue('personType', supplierResult.isSociedad ? 'JURIDICA' : 'NATURAL');
        props.form.setFieldValue('obligadoContabilidad', !!supplierResult.obligadoContabilidad);
        props.form.setFieldValue('isRetentionAgent', !!supplierResult.agenteRetencion);
        props.form.setFieldValue('isSpecialContributor', !!supplierResult.contribuyenteEspecial);
        props.form.setFieldValue('taxRegimeType', supplierResult.isRimpe ? 'RIMPE_EMPRENDEDOR' : 'GENERAL');

        if (source === 'NAME') {
            queryClient.setQueryData(sriKeys.byName(supplierResult.razonSocial), [supplierResult]);
        }

        if (supplierResult.city) {
            const addresses = props.form.getFieldValue('addresses');
            if (addresses.length === 0) {
                props.form.pushFieldValue('addresses', {
                    addressLine: '', city: supplierResult.city, country: 'Ecuador', countryCode: 'EC', postalCode: '', isMain: true,
                });
            } else {
                props.form.setFieldValue('addresses[0].city', supplierResult.city);
                props.form.setFieldValue('addresses[0].country', 'Ecuador');
                props.form.setFieldValue('addresses[0].countryCode', 'EC');
            }
        }
    };



    return (
        <div class="w-full space-y-4">
            {/* --- Roles Section --- */}
            <fieldset class="bg-surface/30 p-4 rounded-2xl border border-border/40">
                <div class="flex items-center gap-2 mb-2">
                    <div class="w-1.5 h-4 bg-warning rounded-full"></div>
                    <h3 class="font-semibold text-text uppercase tracking-wide text-sm">Tipo de Entidad</h3>
                </div>
                <div class="flex flex-wrap gap-x-6 gap-y-3">
                    {(Object.entries(roleLabels) as [keyof typeof roleLabels, string][]).map(([key, label]) => (
                        <props.form.Field name={key}>
                            {(field) => {
                                const isRoleDisabledByAuth = (roleKey: string) => {
                                    if (roleKey === 'isEmployee' && personType() === 'JURIDICA') return true;
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

            {/* --- Unified Identification & Main Data Section --- */}
            <fieldset class="space-y-4 bg-surface/30 p-4 rounded-2xl border border-border/40">
                <div class="flex items-center gap-2 mb-2">
                    <div class="w-1.5 h-4 bg-primary rounded-full"></div>
                    <h3 class="font-semibold text-text uppercase tracking-wide text-sm">
                        {isPureEmployee() ? 'Identificación y Datos Personales' : 'Identificación y Titular'}
                    </h3>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                                const numeric = val.replace(/\D/g, '');
                                                if (val !== numeric) {
                                                    val = numeric;
                                                    e.currentTarget.value = val;
                                                }
                                            }
                                            field().handleChange(val as any);
                                        }}
                                        onKeyDown={(e) => {
                                            setSriError('');
                                            if (e.key === 'Enter' && taxIdType() === 'RUC') {
                                                e.preventDefault();
                                                triggerRucSearch();
                                            }
                                        }}
                                        class={taxIdType() === 'RUC' ? 'pr-10' : ''}
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

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <props.form.Field name="personType">
                        {(field) => (
                            <div class="space-y-1.5">
                                <FieldLabel tooltip={personTypeTooltip()}>
                                    Tipo Persona
                                </FieldLabel>
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

                    <props.form.Field name="businessName">
                        {(field) => (
                            <Show
                                when={taxIdType() === 'RUC' && !isPureEmployee()}
                                fallback={
                                    <TextField.Root field={field()}>
                                        <TextField.Label>{businessNameLabel()}</TextField.Label>
                                        <TextField.Input
                                            ref={businessNameInputRef}
                                            type="text"
                                            placeholder={businessNamePlaceholder()}
                                            value={field().state.value}
                                            onInput={(e) => field().handleChange(e.currentTarget.value)}
                                        />
                                        <TextField.ErrorMessage />
                                    </TextField.Root>
                                }
                            >
                                <SriBusinessNameSelect
                                    value={field().state.value}
                                    onInputChange={handleNameInput}
                                    onSelect={handleSriSelect('NAME')}
                                    field={field()}
                                    label="Razón Social (Búsqueda SRI)"
                                />
                            </Show>
                        )}
                    </props.form.Field>
                </div>

                <Show when={showTradeName()}>
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
                </Show>
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
                                <TextField.Label>Email Principal</TextField.Label>
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
                                        disabled={personType() === 'JURIDICA' || props.form.getFieldValue('taxRegimeType') === 'RIMPE_NEGOCIO_POPULAR'}
                                    >
                                        Obligado a llevar contabilidad
                                    </Checkbox>
                                )}
                            </props.form.Field>
                            <props.form.Field name="isRetentionAgent">
                                {(field) => (
                                    <Checkbox
                                        field={field()}
                                        class="font-medium"
                                        disabled={props.form.getFieldValue('taxRegimeType') === 'RIMPE_NEGOCIO_POPULAR'}
                                    >
                                        Agente de Retención
                                    </Checkbox>
                                )}
                            </props.form.Field>
                            <props.form.Field name="isSpecialContributor">
                                {(field) => (
                                    <Checkbox
                                        field={field()}
                                        class="font-medium text-danger"
                                        disabled={props.form.getFieldValue('taxRegimeType') === 'RIMPE_NEGOCIO_POPULAR'}
                                    >
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
                        <props.form.Field name="employeeDetails.departmentId">
                            {(field) => {
                                const opts = () => (departmentsQuery.data || []).map(d => ({ value: d.id, label: d.name }));
                                return (
                                    <div class="space-y-1.5">
                                        <div class="flex items-center justify-between">
                                            <FieldLabel>Departamento</FieldLabel>
                                            <button
                                                type="button"
                                                onClick={handleCreateDepartment}
                                                class="text-xs text-primary hover:underline flex items-center gap-0.5"
                                            >
                                                <PlusIcon class="size-3" /> Nuevo
                                            </button>
                                        </div>
                                        <Select
                                            value={opts().find(o => o.value === field().state.value)}
                                            onChange={(opt) => field().handleChange(opt?.value ?? null)}
                                            options={opts()}
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
                                                <SelectValue<{ value: number; label: string }>>
                                                    {(state) => state.selectedOption()?.label ?? 'Seleccionar...'}
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent />
                                        </Select>
                                    </div>
                                );
                            }}
                        </props.form.Field>

                        <props.form.Field name="employeeDetails.jobTitleId">
                            {(field) => {
                                const deptId = props.form.getFieldValue('employeeDetails.departmentId');
                                const opts = () => {
                                    const all = jobTitlesQuery.data || [];
                                    const filtered = deptId ? all.filter(j => !j.department_id || j.department_id === deptId) : all;
                                    return filtered.map(j => ({ value: j.id, label: j.name }));
                                };
                                return (
                                    <div class="space-y-1.5">
                                        <div class="flex items-center justify-between">
                                            <FieldLabel>Cargo</FieldLabel>
                                            <button
                                                type="button"
                                                onClick={handleCreateJobTitle}
                                                class="text-xs text-primary hover:underline flex items-center gap-0.5"
                                            >
                                                <PlusIcon class="size-3" /> Nuevo
                                            </button>
                                        </div>
                                        <Select
                                            value={opts().find(o => o.value === field().state.value)}
                                            onChange={(opt) => field().handleChange(opt?.value ?? null)}
                                            options={opts()}
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
                                                <SelectValue<{ value: number; label: string }>>
                                                    {(state) => state.selectedOption()?.label ?? 'Seleccionar...'}
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent />
                                        </Select>
                                    </div>
                                );
                            }}
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
