/**
 * useEntityBusinessRules.ts
 *
 * Encapsulates the 4 core business and fiscal rules for Ecuadorian entities:
 * 1. Personal tax ID (CEDULA, PASAPORTE) forces PersonType = NATURAL.
 * 2. JURIDICA forces obligadoContabilidad = true and taxIdType = RUC (if it was CEDULA/PASAPORTE).
 * 3. Employee forces PersonType = NATURAL and initializes / cleans up employeeDetails.
 * 4. RIMPE Negocio Popular forces PersonType = NATURAL and turns off obligadoContabilidad and special contributor.
 */
import { createEffect, on } from 'solid-js';
import type { EntityFormApi } from '../entity-form.types';
import { EMPTY_EMPLOYEE_DETAILS, isPersonalTaxId } from '../entity-form.utils';

export function useEntityBusinessRules(form: EntityFormApi) {
    const taxIdType = form.useStore((s) => s.values.taxIdType);
    const personType = form.useStore((s) => s.values.personType);
    const isEmployeeVal = form.useStore((s) => s.values.isEmployee);
    const hasEmployeeDetails = form.useStore((s) => !!s.values.employeeDetails);
    const taxRegimeType = form.useStore((s) => s.values.taxRegimeType);

    // Rule 1: Personal ID types force NATURAL person
    createEffect(
        on(
            taxIdType,
            (type) => {
                if (isPersonalTaxId(type) && personType() !== 'NATURAL') {
                    form.setFieldValue('personType', 'NATURAL');
                }
            },
            { defer: true }
        )
    );

    // Rule 2: JURIDICA forces accounting obligation & RUC
    createEffect(
        on(
            personType,
            (pt) => {
                if (pt === 'JURIDICA') {
                    const obligado = form.getFieldValue('obligadoContabilidad');
                    if (!obligado) form.setFieldValue('obligadoContabilidad', true);
                    const curr = taxIdType();
                    if (isPersonalTaxId(curr)) {
                        form.setFieldValue('taxIdType', 'RUC');
                    }
                }
            },
            { defer: true }
        )
    );

    // Rule 3: Employee management & details initialization
    createEffect(
        on(
            isEmployeeVal,
            (isEmp) => {
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
            },
            { defer: true }
        )
    );

    // Rule 4: RIMPE Negocio Popular fiscal constraints
    createEffect(
        on(
            taxRegimeType,
            (regime) => {
                if (regime === 'RIMPE_NEGOCIO_POPULAR') {
                    if (personType() !== 'NATURAL') form.setFieldValue('personType', 'NATURAL');
                    if (form.getFieldValue('obligadoContabilidad')) form.setFieldValue('obligadoContabilidad', false);
                    if (form.getFieldValue('isSpecialContributor')) form.setFieldValue('isSpecialContributor', false);
                }
            },
            { defer: true }
        )
    );
}
