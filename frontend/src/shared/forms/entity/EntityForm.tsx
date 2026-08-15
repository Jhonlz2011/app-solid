import { Component, createSignal, Show, createEffect, on } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { EntityFormSchema, type EntityFormData, type TaxIdTypeForm, type PersonType, type TaxRegimeType } from '@app/schema/frontend';
import { ApiError } from '@shared/utils/api-errors';
import { FormSubmissionContext } from '@shared/ui/form/form.types';
import { createTabErrorSelector, resolveTabFlags } from '@shared/forms/useTabErrors';

import { createDefaultEntityFormValues, EMPTY_EMPLOYEE_DETAILS } from './entity-form.utils';

import { InfoIcon, MapPinIcon, UsersIcon, TruckIcon } from '@shared/ui/icons';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@shared/ui/Tabs';

// Subcomponents
import { EntityGeneralTab } from './sections/EntityGeneralTab';
import { EntityContactsArray } from './sections/EntityContactsArray';
import { EntityAddressArray } from './sections/EntityAddressArray';
import { EntityCarrierTab } from './sections/EntityCarrierTab';

import type { EntityDetailDto } from '@app/schema/dto';

export interface EntityFormProps {
    entity?: EntityDetailDto | null;
    onSubmit: (data: EntityFormData) => Promise<void>;
    isSubmitting: boolean;
    lockedRoles?: Partial<Record<'isClient' | 'isSupplier' | 'isEmployee' | 'isCarrier', boolean>>;
}

export const EntityForm: Component<EntityFormProps> = (props) => {
    const isEdit = () => !!props.entity;
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);

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
                contacts: e.contacts?.map((c) => ({
                    name: c.name, position: c.position ?? '', email: c.email ?? '', phone: c.phone ?? '', isPrimary: c.is_primary ?? false
                })) ?? [],
                addresses: e.addresses?.map((a) => ({
                    addressLine: a.address_line ?? '',
                    city: a.city ?? '',
                    country: a.country ?? 'Ecuador',
                    countryCode: a.country_code ?? 'EC',
                    postalCode: a.postal_code ?? '',
                    isMain: a.is_main ?? false
                })) ?? [],
                vehicles: e.vehicles?.map((v) => ({
                    licensePlate: v.license_plate ?? '',
                    description: v.description ?? '',
                    isActive: v.is_active ?? true,
                })) ?? [],
                drivers: e.drivers?.map((d) => ({
                    identificationNumber: d.identification_number ?? '',
                    fullName: d.full_name ?? '',
                    phone: d.phone ?? '',
                    isActive: d.is_active ?? true,
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
                            // @ts-expect-error - Dynamic field strings from backend cannot be statically typed
                            form.setFieldMeta(fieldErr.field, (prev) => ({
                                ...prev,
                                errorMap: { ...prev.errorMap, onSubmit: fieldErr.message },
                            }));
                        } catch { /* ignore */ }
                    }
                }
            }
        },
    }));

    // Form-wide rules
    const taxIdType = form.useStore((s) => s.values.taxIdType);
    const personType = form.useStore((s) => s.values.personType);
    const isEmployeeVal = form.useStore((s) => s.values.isEmployee);
    const isSupplierVal = form.useStore((s) => s.values.isSupplier);
    const isClientVal = form.useStore((s) => s.values.isClient);
    const isCarrierVal = form.useStore((s) => s.values.isCarrier);
    const hasEmployeeDetails = form.useStore((s) => !!s.values.employeeDetails);

    createEffect(on(taxIdType, (type) => {
        if ((type === 'CEDULA' || type === 'PASAPORTE') && personType() !== 'NATURAL') {
            form.setFieldValue('personType', 'NATURAL');
        }
    }, { defer: true }));

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

    const showContacts = () => isEmployeeVal() || isSupplierVal() || isClientVal() || isCarrierVal();

    return (
        <FormSubmissionContext.Provider value={hasAttemptedSubmit}>
            <form
                id="entity-form"
                onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setHasAttemptedSubmit(true);
                    form.handleSubmit();
                }}
                class="flex flex-col"
            >
                <Tabs defaultValue="general" class="w-full h-full flex flex-col">
                    <div class="sticky top-0 z-20 max-w-full bg-card pt-4 pb-2">
                        <form.Subscribe 
                            selector={createTabErrorSelector(hasAttemptedSubmit, {
                                general: { prefixes: [], isDefault: true },
                                contacts: { prefixes: ['contacts'] },
                                addresses: { prefixes: ['addresses'] },
                                carrier: { prefixes: ['vehicles', 'drivers'] },
                            })}
                        >
                            {(flagsAccessor) => {
                                const getFlags = () => resolveTabFlags(flagsAccessor as any);
                                
                                return (
                                    <TabsList class="flex overflow-x-auto shadow-sm rounded-xl">
                                        <TabsTrigger value="general" hasError={getFlags().general}><InfoIcon /> General</TabsTrigger>
                                        <Show when={showContacts()}>
                                            <form.Subscribe selector={(state) => state.values.contacts?.length || 0}>
                                                {(count) => (
                                                <TabsTrigger value="contacts" count={count()} hasError={getFlags().contacts}>
                                                        <UsersIcon class="size-4" /> Contactos
                                                    </TabsTrigger>
                                                )}
                                            </form.Subscribe>
                                        </Show>
                                        <form.Subscribe selector={(state) => state.values.addresses?.length || 0}>
                                            {(count) => (
                                                <TabsTrigger value="addresses" count={count()} hasError={getFlags().addresses}>
                                                    <MapPinIcon class="size-4" /> Direcciones
                                                </TabsTrigger>
                                            )}
                                        </form.Subscribe>
                                        <Show when={isCarrierVal()}>
                                            <form.Subscribe selector={(state) => (state.values.vehicles?.length || 0) + (state.values.drivers?.length || 0)}>
                                                {(count) => (
                                                    <TabsTrigger value="carrier" count={count()} hasError={getFlags().carrier}>
                                                        <TruckIcon class="size-4" /> Transporte
                                                    </TabsTrigger>
                                                )}
                                            </form.Subscribe>
                                        </Show>
                                    </TabsList>
                                );
                            }}
                        </form.Subscribe>
                    </div>

                    <div class="pt-3">
                        <TabsContent value="general">
                            <EntityGeneralTab form={form} isEdit={isEdit} lockedRoles={props.lockedRoles} />
                        </TabsContent>

                        <Show when={showContacts()}>
                            <TabsContent value="contacts" forceMount={false} class="w-full max-w-5xl">
                                <EntityContactsArray form={form} />
                            </TabsContent>
                        </Show>

                        <TabsContent value="addresses" forceMount={false} class="w-full max-w-5xl">
                            <EntityAddressArray form={form} />
                        </TabsContent>

                        <Show when={isCarrierVal()}>
                            <TabsContent value="carrier" forceMount={false} class="w-full max-w-5xl">
                                <EntityCarrierTab form={form} />
                            </TabsContent>
                        </Show>
                    </div>
                </Tabs>
            </form>
        </FormSubmissionContext.Provider>
    );
};

