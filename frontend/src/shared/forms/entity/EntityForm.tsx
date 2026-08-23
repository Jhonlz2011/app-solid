import { Component, createSignal, Show } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { EntityFormSchema, EntityFormData } from '@app/schema/frontend';
import { ApiError } from '@shared/utils/api-errors';
import { FormSubmissionContext } from '@shared/ui/form/form.types';
import { useTabErrors } from '@shared/forms/useTabErrors';

import { createDefaultEntityFormValues, mapEntityDetailToFormData } from './entity-form.utils';
import { useEntityBusinessRules } from './hooks/useEntityBusinessRules';

import { InfoIcon } from '@icons/InfoIcon';
import { MapPinIcon } from '@icons/MapPinIcon';
import { UsersIcon } from '@icons/UsersIcon';
import { TruckIcon } from '@icons/TruckIcon';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/ui/form/Tabs';

// Subcomponents
import { EntityGeneralTab } from './sections/EntityGeneralTab';
import { EntityContactsArray } from './sections/EntityContactsArray';
import { EntityAddressArray } from './sections/EntityAddressArray';
import { EntityCarrierTab } from './sections/EntityCarrierTab';

import type { EntityDetailType } from '@app/schema/dto';

export interface EntityFormProps {
    entity?: EntityDetailType | null;
    onSubmit: (data: EntityFormData) => Promise<void>;
    isSubmitting: boolean;
    lockedRoles?: Partial<Record<'isClient' | 'isSupplier' | 'isEmployee' | 'isCarrier', boolean>>;
}

export const EntityForm: Component<EntityFormProps> = (props) => {
    const isEdit = () => !!props.entity;
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);

    const initialValues = (): EntityFormData => {
        if (props.entity) {
            return mapEntityDetailToFormData(props.entity, props.lockedRoles);
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

    // Form-wide rules encapsulated in dedicated hook
    useEntityBusinessRules(form);

    // Multi-tab error indicators
    const tabErrors = useTabErrors(form, hasAttemptedSubmit, {
        general: { prefixes: [], isDefault: true },
        contacts: { prefixes: ['contacts'] },
        addresses: { prefixes: ['addresses'] },
        carrier: { prefixes: ['vehicles', 'drivers'] },
    });

    const isEmployeeVal = form.useStore((s) => s.values.isEmployee);
    const isSupplierVal = form.useStore((s) => s.values.isSupplier);
    const isClientVal = form.useStore((s) => s.values.isClient);
    const isCarrierVal = form.useStore((s) => s.values.isCarrier);

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
                        <TabsList class="flex overflow-x-auto shadow-sm rounded-xl">
                            <TabsTrigger value="general" hasError={tabErrors().general}>
                                <InfoIcon /> General
                            </TabsTrigger>
                            <Show when={showContacts()}>
                                <form.Subscribe selector={(state) => state.values.contacts?.length || 0}>
                                    {(count) => (
                                        <TabsTrigger value="contacts" count={count()} hasError={tabErrors().contacts}>
                                            <UsersIcon class="size-4" /> Contactos
                                        </TabsTrigger>
                                    )}
                                </form.Subscribe>
                            </Show>
                            <form.Subscribe selector={(state) => state.values.addresses?.length || 0}>
                                {(count) => (
                                    <TabsTrigger value="addresses" count={count()} hasError={tabErrors().addresses}>
                                        <MapPinIcon class="size-4" /> Direcciones
                                    </TabsTrigger>
                                )}
                            </form.Subscribe>
                            <Show when={isCarrierVal()}>
                                <form.Subscribe selector={(state) => (state.values.vehicles?.length || 0) + (state.values.drivers?.length || 0)}>
                                    {(count) => (
                                        <TabsTrigger value="carrier" count={count()} hasError={tabErrors().carrier}>
                                            <TruckIcon class="size-4" /> Transporte
                                        </TabsTrigger>
                                    )}
                                </form.Subscribe>
                            </Show>
                        </TabsList>
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
