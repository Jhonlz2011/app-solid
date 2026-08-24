import { Component, createMemo } from 'solid-js';
import TextField from '@form/TextField';
import Checkbox from '@form/Checkbox';
import Switch from '@form/Switch';
import { FieldLabel } from '@form/TextField';
import { SelectField } from '@form/Select';
import { EntitySelect } from '@shared/ui/selectors';
import { PlusIcon } from '@icons/PlusIcon';
import { BriefcaseIcon } from '@icons/BriefcaseIcon';
import { BuildingIcon } from '@icons/BuildingIcon';
import { UsersIcon } from '@icons/UsersIcon';
import { IdCardIcon } from '@icons/IdCardIcon';
import { FileTextIcon } from '@icons/FileTextIcon';
import type { EntityFormApi } from '../entity-form.types';
import { useEntityQueries } from '../hooks/useEntityQueries';
import type { EntityDetailType } from '@app/schema/dto';
import { DEFAULT_SBU, MONTHLY_WORK_HOURS } from '@app/schema/enums';
import {
    contractTypeOptions,
    bankAccountTypeOptions,
} from '../entity-form.utils';

export interface EntityEmployeeTabProps {
    form: EntityFormApi;
    isEdit: () => boolean;
    entity?: EntityDetailType | null;
}

export const EntityEmployeeTab: Component<EntityEmployeeTabProps> = (props) => {
    // Reactive store subscriptions for TanStack Form in SolidJS
    const isEmployee = props.form.useStore((s) => s.values.isEmployee);
    const selectedDeptId = props.form.useStore((s) => s.values.employeeDetails?.departmentId);
    const salaryType = props.form.useStore((s) => s.values.employeeDetails?.salaryType);

    const isSbu = createMemo(() => (salaryType() ?? 'SBU') === 'SBU');

    const queries = useEntityQueries(props.form, isEmployee);

    // Derived reactive options for Job Titles based on selected Department
    const jobTitleOptions = createMemo(() => queries.getJobTitleOptions(selectedDeptId()));

    const promptCreateDepartment = () => {
        const name = prompt('Ingrese el nombre del nuevo departamento:');
        if (name) queries.handleCreateDepartment(name);
    };

    const promptCreateJobTitle = () => {
        const name = prompt('Ingrese el nombre del nuevo cargo:');
        if (name) queries.handleCreateJobTitle(name);
    };

    const handleToggleSbu = (checked: boolean) => {
        if (checked) {
            props.form.setFieldValue('employeeDetails.salaryType', 'SBU');
            props.form.setFieldValue('employeeDetails.salaryBase', DEFAULT_SBU);
            props.form.setFieldValue(
                'employeeDetails.costPerHour',
                Number((DEFAULT_SBU / MONTHLY_WORK_HOURS).toFixed(2))
            );
        } else {
            props.form.setFieldValue('employeeDetails.salaryType', 'CUSTOM');
        }
    };

    return (
        <div class="space-y-6 animate-fade-in">
            {/* ================================================================= */}
            {/* 1. ESTRUCTURA ORGANIZACIONAL Y CONTRATACIÓN                      */}
            {/* ================================================================= */}
            <fieldset class="space-y-4 bg-surface/30 p-5 rounded-2xl border border-border/40">
                <div class="flex items-center gap-2 mb-1">
                    <div class="w-1.5 h-4 bg-primary rounded-full"></div>
                    <h3 class="font-semibold text-text uppercase tracking-wide text-sm flex items-center gap-2">
                        <BuildingIcon class="size-4 text-primary" />
                        Estructura Organizacional y Contrato
                    </h3>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Departamento */}
                    <props.form.Field name="employeeDetails.departmentId">
                        {(field) => (
                            <div class="space-y-1.5">
                                <div class="flex items-center justify-between">
                                    <FieldLabel>Departamento</FieldLabel>
                                    <button
                                        type="button"
                                        onClick={promptCreateDepartment}
                                        class="text-xs text-primary hover:underline flex items-center gap-0.5"
                                    >
                                        <PlusIcon class="size-3" /> Nuevo
                                    </button>
                                </div>
                                <SelectField
                                    field={field()}
                                    options={queries.departmentOptions()}
                                    placeholder="Seleccionar departamento..."
                                />
                            </div>
                        )}
                    </props.form.Field>

                    {/* Cargo */}
                    <props.form.Field name="employeeDetails.jobTitleId">
                        {(field) => (
                            <div class="space-y-1.5">
                                <div class="flex items-center justify-between">
                                    <FieldLabel>Cargo</FieldLabel>
                                    <button
                                        type="button"
                                        onClick={promptCreateJobTitle}
                                        class="text-xs text-primary hover:underline flex items-center gap-0.5"
                                    >
                                        <PlusIcon class="size-3" /> Nuevo
                                    </button>
                                </div>
                                <SelectField
                                    field={field()}
                                    options={jobTitleOptions()}
                                    placeholder="Seleccionar cargo..."
                                />
                            </div>
                        )}
                    </props.form.Field>

                    {/* Supervisor Directo (Organigrama) */}
                    <props.form.Field name="employeeDetails.reportsTo">
                        {(field) => (
                            <EntitySelect
                                value={field().state.value}
                                onChange={(id) => field().handleChange(id)}
                                label="Jefe Directo"
                                placeholder="Buscar supervisor por nombre o identificación..."
                                isEmployee={true}
                                excludeEntityId={props.entity?.id}
                                initialEntity={
                                    props.entity?.employeeDetails?.reports_to
                                        ? {
                                              id: props.entity.employeeDetails.reports_to,
                                              businessName: props.entity.employeeDetails.reports_to_name ?? 'Supervisor asignado',
                                              taxId: '',
                                          }
                                        : null
                                }
                                disabled={props.form.state.isSubmitting}
                                field={field()}
                            />
                        )}
                    </props.form.Field>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
                    {/* Tipo de Contrato */}
                    <props.form.Field name="employeeDetails.contractType">
                        {(field) => (
                            <SelectField
                                field={field()}
                                label="Tipo de Contrato"
                                options={contractTypeOptions}
                                placeholder="Seleccionar..."
                            />
                        )}
                    </props.form.Field>

                    {/* Fecha de Contratación */}
                    <props.form.Field name="employeeDetails.hireDate">
                        {(field) => (
                            <TextField.Root field={field()}>
                                <TextField.Label>Fecha de Contratación</TextField.Label>
                                <TextField.Input type="date" />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )}
                    </props.form.Field>

                    {/* Fecha de Salida */}
                    <props.form.Field name="employeeDetails.terminationDate">
                        {(field) => (
                            <TextField.Root field={field()}>
                                <TextField.Label>Fecha de Salida (Opcional)</TextField.Label>
                                <TextField.Input type="date" />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )}
                    </props.form.Field>
                </div>
            </fieldset>

            {/* ================================================================= */}
            {/* 2. COMPENSACIÓN Y COSTEO LABORAL                                 */}
            {/* ================================================================= */}
            <fieldset class="space-y-4 bg-surface/30 p-5 rounded-2xl border border-border/40">
                <div class="flex items-center justify-between mb-1">
                    <div class="flex items-center gap-2">
                        <div class="w-1.5 h-4 bg-primary rounded-full"></div>
                        <h3 class="font-semibold text-text uppercase tracking-wide text-sm flex items-center gap-2">
                            <BriefcaseIcon class="size-4 text-primary" />
                            Compensación y Costeo Laboral
                        </h3>
                    </div>
                    <span class="text-xs text-muted font-normal hidden sm:inline">
                        Base cálculo: 240h/mes (30 días × 8h)
                    </span>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Salario Base con Switch SBU */}
                    <props.form.Field name="employeeDetails.salaryBase">
                        {(field) => (
                            <TextField.Root field={field()}>
                                <div class="flex items-center justify-between">
                                    <TextField.Label>Salario Base Mensual ($)</TextField.Label>
                                    <div class="flex items-center gap-2">
                                        <span class="text-xs font-medium text-muted">
                                            SBU (${DEFAULT_SBU.toFixed(2)})
                                        </span>
                                        <Switch
                                            checked={isSbu()}
                                            onChange={handleToggleSbu}
                                        />
                                    </div>
                                </div>
                                <TextField.Input
                                    type="number"
                                    placeholder={DEFAULT_SBU.toFixed(2)}
                                    step="0.01"
                                    onInput={(e) => {
                                        const raw = e.currentTarget.value;
                                        if (raw === '' || raw == null) {
                                            props.form.setFieldValue('employeeDetails.costPerHour', undefined);
                                            props.form.setFieldValue('employeeDetails.salaryType', 'CUSTOM');
                                            return;
                                        }
                                        const val = parseFloat(raw);
                                        if (!isNaN(val) && val > 0) {
                                            const calculatedCost = Number((val / MONTHLY_WORK_HOURS).toFixed(2));
                                            props.form.setFieldValue('employeeDetails.costPerHour', calculatedCost);
                                            if (val === DEFAULT_SBU) {
                                                props.form.setFieldValue('employeeDetails.salaryType', 'SBU');
                                            } else {
                                                props.form.setFieldValue('employeeDetails.salaryType', 'CUSTOM');
                                            }
                                        }
                                    }}
                                />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )}
                    </props.form.Field>

                    {/* Costo por Hora */}
                    <props.form.Field name="employeeDetails.costPerHour">
                        {(field) => (
                            <TextField.Root field={field()}>
                                <div class="flex items-center justify-between">
                                    <TextField.Label>Costo por Hora ($ Mano de Obra)</TextField.Label>
                                    <span class="text-2xs text-muted font-normal">
                                        Salario ÷ 240
                                    </span>
                                </div>
                                <TextField.Input
                                    type="number"
                                    placeholder={(DEFAULT_SBU / MONTHLY_WORK_HOURS).toFixed(2)}
                                    step="0.01"
                                    onInput={(e) => {
                                        const raw = e.currentTarget.value;
                                        if (raw === '' || raw == null) {
                                            props.form.setFieldValue('employeeDetails.salaryBase', undefined);
                                            props.form.setFieldValue('employeeDetails.salaryType', 'CUSTOM');
                                            return;
                                        }
                                        const val = parseFloat(raw);
                                        if (!isNaN(val) && val > 0) {
                                            const calculatedSalary = Number((val * MONTHLY_WORK_HOURS).toFixed(2));
                                            props.form.setFieldValue('employeeDetails.salaryBase', calculatedSalary);
                                            if (calculatedSalary === DEFAULT_SBU) {
                                                props.form.setFieldValue('employeeDetails.salaryType', 'SBU');
                                            } else {
                                                props.form.setFieldValue('employeeDetails.salaryType', 'CUSTOM');
                                            }
                                        }
                                    }}
                                />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )}
                    </props.form.Field>
                </div>
            </fieldset>

            {/* ================================================================= */}
            {/* 3. PARÁMETROS DE LEY, IESS Y SRI (ECUADOR)                       */}
            {/* ================================================================= */}
            <fieldset class="space-y-4 bg-surface/30 p-5 rounded-2xl border border-border/40">
                <div class="flex items-center gap-2 mb-1">
                    <div class="w-1.5 h-4 bg-primary rounded-full"></div>
                    <h3 class="font-semibold text-text uppercase tracking-wide text-sm flex items-center gap-2">
                        <UsersIcon class="size-4 text-primary" />
                        Nómina, Beneficios de Ley y Parámetros IESS / SRI (Ecuador)
                    </h3>
                </div>

                {/* Acumulaciones de Beneficios */}
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-surface/50 rounded-xl border border-border/50">
                    <props.form.Field name="employeeDetails.accumulateThirteenth">
                        {(field) => (
                            <Checkbox field={field()} class="font-medium text-xs">
                                Acumula Décimo Tercero
                            </Checkbox>
                        )}
                    </props.form.Field>

                    <props.form.Field name="employeeDetails.accumulateFourteenth">
                        {(field) => (
                            <Checkbox field={field()} class="font-medium text-xs">
                                Acumula Décimo Cuarto
                            </Checkbox>
                        )}
                    </props.form.Field>

                    <props.form.Field name="employeeDetails.accumulateReserveFunds">
                        {(field) => (
                            <Checkbox field={field()} class="font-medium text-xs">
                                Acumula Fondos de Reserva (IESS)
                            </Checkbox>
                        )}
                    </props.form.Field>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <props.form.Field name="employeeDetails.iessCode">
                        {(field) => (
                            <TextField.Root field={field()}>
                                <TextField.Label>Código Sectorial / IESS</TextField.Label>
                                <TextField.Input placeholder="Ej: 2110000000" />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )}
                    </props.form.Field>

                    <props.form.Field name="employeeDetails.dependentsCount">
                        {(field) => (
                            <TextField.Root field={field()}>
                                <TextField.Label>Cargas Familiares SRI (GP)</TextField.Label>
                                <TextField.Input type="number" min="0" placeholder="0" />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )}
                    </props.form.Field>
                </div>
            </fieldset>

            {/* ================================================================= */}
            {/* 4. DATOS BANCARIOS (CASH MANAGEMENT / TRANSFERENCIAS)             */}
            {/* ================================================================= */}
            <fieldset class="space-y-4 bg-surface/30 p-5 rounded-2xl border border-border/40">
                <div class="flex items-center gap-2 mb-1">
                    <div class="w-1.5 h-4 bg-primary rounded-full"></div>
                    <h3 class="font-semibold text-text uppercase tracking-wide text-sm flex items-center gap-2">
                        <IdCardIcon class="size-4 text-primary" />
                        Datos Bancarios (Cash Management / Transferencias)
                    </h3>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <props.form.Field name="employeeDetails.bankName">
                        {(field) => (
                            <TextField.Root field={field()}>
                                <TextField.Label>Institución Financiera</TextField.Label>
                                <TextField.Input placeholder="Ej: Banco Pichincha" />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )}
                    </props.form.Field>

                    <props.form.Field name="employeeDetails.bankAccountType">
                        {(field) => (
                            <SelectField
                                field={field()}
                                label="Tipo de Cuenta"
                                options={bankAccountTypeOptions}
                                placeholder="Seleccionar..."
                            />
                        )}
                    </props.form.Field>

                    <props.form.Field name="employeeDetails.bankAccountNumber">
                        {(field) => (
                            <TextField.Root field={field()}>
                                <TextField.Label>N° de Cuenta</TextField.Label>
                                <TextField.Input placeholder="Ej: 2200123456" class="font-mono font-medium" />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )}
                    </props.form.Field>
                </div>
            </fieldset>

            {/* ================================================================= */}
            {/* 5. OBSERVACIONES Y NOTAS LABORALES                               */}
            {/* ================================================================= */}
            <fieldset class="space-y-4 bg-surface/30 p-5 rounded-2xl border border-border/40">
                <div class="flex items-center gap-2 mb-1">
                    <div class="w-1.5 h-4 bg-primary rounded-full"></div>
                    <h3 class="font-semibold text-text uppercase tracking-wide text-sm flex items-center gap-2">
                        <FileTextIcon class="size-4 text-primary" />
                        Observaciones
                    </h3>
                </div>

                <props.form.Field name="employeeDetails.notes">
                    {(field) => (
                        <TextField.Root field={field()}>
                            <TextField.Label>Notas Internas</TextField.Label>
                            <TextField.TextArea
                                placeholder="Escriba aquí condiciones especiales de contratación, historial interno, acuerdos laborales o notas administrativas..."
                                rows={3}
                            />
                            <TextField.ErrorMessage />
                        </TextField.Root>
                    )}
                </props.form.Field>
            </fieldset>
        </div>
    );
};
