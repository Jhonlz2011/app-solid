import { lazyRouteComponent } from '@tanstack/solid-router';
import { createEntityModals } from '@shared/routes/modals.factory';
import { employeeKeys } from '@modules/employees/data/employees.keys';
import { employeesApi } from '@modules/employees/data/employees.api';

const LazyEntityShowRoute = lazyRouteComponent(async () => {
    const m = await import('@modules/entities/components/EntityShowPanel');
    return { default: (props: any) => <m.EntityShowPanel {...props} type="employee" /> };
});
const LazyEntityEditRoute = lazyRouteComponent(async () => {
    const m = await import('@modules/entities/components/EntityEditSheet');
    return { default: (props: any) => <m.EntityEditSheet {...props} type="employee" /> };
});
const LazyEntityNewRoute = lazyRouteComponent(async () => {
    const m = await import('@modules/entities/components/EntityNewSheet');
    return { default: (props: any) => <m.EntityNewSheet {...props} type="employee" /> };
});

export const createEmployeeModals = (parentRoute: any, basePath = '') =>
    createEntityModals(parentRoute, basePath, {
        entityKey: 'employees',
        idParam: 'employeeId',
        components: { New: LazyEntityNewRoute, Show: LazyEntityShowRoute, Edit: LazyEntityEditRoute },
        detail: { queryKey: employeeKeys.detail, queryFn: employeesApi.get },
    });
