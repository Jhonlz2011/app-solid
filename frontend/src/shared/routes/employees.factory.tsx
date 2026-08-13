import { lazyRouteComponent } from '@tanstack/solid-router';
import { createEntityModals } from '@shared/routes/modals.factory';
import { employeeKeys } from '@modules/employees/data/employees.keys';
import { employeesApi } from '@modules/employees/data/employees.api';

const LazyEmployeeShowRoute = lazyRouteComponent(() => import('@modules/employees/components/EmployeeShowPanel'));
const LazyEmployeeEditRoute = lazyRouteComponent(() => import('@modules/employees/components/EmployeeEditSheet'));
const LazyEmployeeNewRoute = lazyRouteComponent(() => import('@modules/employees/components/EmployeeNewSheet'));

export const createEmployeeModals = (parentRoute: any, basePath = '') =>
    createEntityModals(parentRoute, basePath, {
        entityKey: 'employees',
        idParam: 'employeeId',
        components: { New: LazyEmployeeNewRoute, Show: LazyEmployeeShowRoute, Edit: LazyEmployeeEditRoute },
        detail: { queryKey: employeeKeys.detail, queryFn: employeesApi.get },
    });
