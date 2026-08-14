import { Component } from 'solid-js';
import { useEntityState } from '@modules/entities/hooks/useEntityState';
import { EntityPage } from '@modules/entities/views/EntityPage';
import { BriefcaseIcon } from '@shared/ui/icons';

import { employeesApi } from '../data/employees.api';
import { employeeKeys } from '../data/employees.keys';
import { employeeQueries } from '../data/employees.queries';
import { employeeMutations } from '../data/employees.mutations';
import { createEmployeeColumns } from '../data/employee.columns';
import { taxIdTypeLabels, personTypeLabels } from '../models/employee.types';
import EmployeeFilterSheet from '../components/EmployeeFilterSheet';

const EmployeesPage: Component = () => {
    const state = useEntityState({
        api: employeesApi,
        keys: employeeKeys,
        queries: employeeQueries,
        mutations: employeeMutations,
        createColumns: createEmployeeColumns,
        sseRoom: 'employees',
        permissionKey: 'employees',
        entityNamePlural: 'empleados',
        taxIdTypeLabels,
        personTypeLabels,
    });

    return (
        <EntityPage
            title="Empleados"
            icon={<BriefcaseIcon />}
            iconBg="linear-gradient(135deg, #10b981, #047857)"
            description="Gestiona los empleados y personal de la empresa."
            state={state}
            entityNamePlural="empleados"
            entityNameSingular="empleado"
            permissionKey="employees"
            newRoutePath="/employees/new"
            CustomFilterSheet={EmployeeFilterSheet}
        />
    );
};

export default EmployeesPage;
