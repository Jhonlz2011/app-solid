import { Component, Show, Index, createMemo } from 'solid-js';
import type { PersonType, TaxRegimeType } from '@app/schema/enums';
import { hasFieldError, getFieldError } from '@shared/ui/form/form.types';

import {
    taxIdTypeOptions,
    personTypeOptions,
    taxRegimeTypeOptions,
    roleLabels,
    getTaxIdTypeDisabledKeys,
    getTaxIdConfig,
    isPersonalTaxId,
} from '../entity-form.utils';

import TextField, { FieldLabel } from '@form/TextField';
import Checkbox from '@form/Checkbox';
import { SelectField } from '@form/Select';
import { SriBusinessNameSelect } from '@shared/ui/selectors';
import { SearchIcon } from '@icons/SearchIcon';
import { useAuth } from '@modules/auth/store/auth.store';
import {
    SegmentedControl,
    SegmentedControlIndicator,
    SegmentedControlItem,
    SegmentedControlItemInput,
    SegmentedControlItemLabel
} from '@form/SegmentedControl';

import { InfoIcon } from '@icons/InfoIcon';
import type { RbacModule } from '@app/schema/enums'
import type { EntityFormApi } from '../entity-form.types';
import { useEntitySmartLookup } from '../hooks/useEntitySmartLookup';

export interface EntityGeneralTabProps {
    form: EntityFormApi;
    isEdit: () => boolean;
    lockedRoles?: Partial<Record<'isClient' | 'isSupplier' | 'isEmployee' | 'isCarrier', boolean>>;
}

export const EntityGeneralTab: Component<EntityGeneralTabProps> = (props) => {
    const auth = useAuth();
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

    // SRI Section: hide if pure employee, or if personal ID without being a supplier
    const showTaxSection = createMemo(() => {
        if (isPureEmployee()) return false;
        if (isPersonalTaxId(taxIdType()) && !isSupplierVal()) return false;
        if (taxIdType() === 'RUC') return true;
        if (isSupplierVal()) return true;
        return false;
    });

    const showTradeName = createMemo(() => {
        if (isPureEmployee()) return false;
        if (isPersonalTaxId(taxIdType()) && !isSupplierVal() && !isClientVal()) return false;
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

    const personTypeLocked = createMemo(() => isPersonalTaxId(taxIdType()) || isEmployeeVal());

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
    // Custom Hooks (SRP Encapsulation)
    // =========================================================================
    const {
        isSearchingRuc,
        sriError,
        setSriError,
        existingEntityNotice,
        triggerRucSearch,
        handleSriSelect,
        handleNameInput,
    } = useEntitySmartLookup(props.form, props.lockedRoles, () => {
        businessNameInputRef?.focus();
        businessNameInputRef?.select();
    });

    return (
        <div class="w-full space-y-4">
            {/* --- Existing Multi-Role Entity Notice Banner --- */}
            <Show when={existingEntityNotice()}>
                {(notice) => (
                    <div class="p-3.5 bg-primary/10 border border-primary/25 rounded-2xl flex items-start gap-3 text-sm text-text animate-fade-in">
                        <div class="p-1 bg-primary/20 text-primary rounded-lg shrink-0 mt-0.5">
                            <InfoIcon class="w-4 h-4" />
                        </div>
                        <div>
                            <p class="font-semibold text-primary">Entidad registrada previamente: {notice().businessName}</p>
                            <p class="text-xs text-text-muted mt-0.5">
                                Esta empresa ya se encuentra registrada con el rol de <span class="font-semibold text-text">{notice().roles.join(', ')}</span>.
                                Al guardar este formulario, se le habilitará el nuevo rol seleccionado conservando sus contactos, direcciones e historial comercial unificado.
                            </p>
                        </div>
                    </div>
                )}
            </Show>

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
                                    const canManage = (module: RbacModule) => {
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
                                );
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
                            <SelectField
                                field={field()}
                                label="Tipo de Identificación"
                                options={computedTaxIdTypeOptions()}
                                disabled={props.isEdit()}
                                placeholder="Seleccionar..."
                            />
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
                                            field().handleChange(val);
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
                                <FieldLabel class="mb-1" tooltip={personTypeTooltip()}>
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
                                <SelectField
                                    field={field()}
                                    label="Régimen Fiscal (Asignado SRI)"
                                    options={taxRegimeTypeOptions}
                                    placeholder="Seleccionar..."
                                />
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
        </div>
    );
};