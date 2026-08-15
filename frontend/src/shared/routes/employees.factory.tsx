import { lazyRouteComponent } from '@tanstack/solid-router';
import { createEntityModals } from '@shared/routes/modals.factory';
import { employeeKeys } from '@modules/employees/data/employees.keys';
import { employeesApi } from '@modules/employees/data/employees.api';

const LazyEntityShowRoute = lazyRouteComponent(() => import('@modules/entities/components/EntityShowPanel'));
const LazyEntityEditRoute = lazyRouteComponent(() => import('@modules/entities/components/EntityEditSheet'));
const LazyEntityNewRoute = lazyRouteComponent(() => import('@modules/entities/components/EntityNewSheet'));

export const createEmployeeModals = (parentRoute: any, basePath = '') =>
    createEntityModals(parentRoute, basePath, {
        entityKey: 'employees',
        idParam: 'employeeId',
        components: { New: LazyEntityNewRoute, Show: LazyEntityShowRoute, Edit: LazyEntityEditRoute },
        detail: { queryKey: employeeKeys.detail, queryFn: employeesApi.get },
    });
