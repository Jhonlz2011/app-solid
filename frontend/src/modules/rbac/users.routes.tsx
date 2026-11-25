import { createRoute, redirect } from '@tanstack/solid-router';
import { queryClient } from '@shared/lib/queryClient';
import { rbacQueries } from './data/users.queries';
import { DEFAULT_USERS_PAGE_SIZE } from './data/users.keys';
import { saasKeys } from '@modules/saas/data/saas.queries';
import { saasApi } from '@modules/saas/data/saas.api';
import { createUserModals } from '@shared/routes/users.factory';
import { createRoleModals } from '@shared/routes/roles.factory';
import { createEmployeeModals } from '@shared/routes/employees.factory';
import { createClientsModals } from '@shared/routes/clients.factory';
import { createSupplierModals } from '@shared/routes/suppliers.factory';

// ─── Lazy page ──────────────────────────────────────────────────────────────
import { lazyRouteComponent } from '@tanstack/solid-router';
const UsersRolesPage = lazyRouteComponent(() => import('./views/UsersRolesPage'));

export interface UsersRouteSearch {
    tab?: 'users' | 'roles';
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    isActive?: string[];
    roles?: string[];
    rolesSearch?: string;
    role?: string;
}

function parseStringArrayParam(value: unknown): string[] | undefined {
    if (Array.isArray(value)) {
        const cleaned = value.map(String).map(v => v.trim()).filter(Boolean);
        return cleaned.length > 0 ? cleaned : undefined;
    }
    if (typeof value === 'string' && value.trim()) {
        const cleaned = value.split(',').map(v => v.trim()).filter(Boolean);
        return cleaned.length > 0 ? cleaned : undefined;
    }
    return undefined;
}

// ─── Route factory ──────────────────────────────────────────────────────────
export const createUsersRoutes = (layoutRoute: any) => {
    const usersRoute = createRoute({
        getParentRoute: () => layoutRoute,
        path: 'users',
        validateSearch: (raw: Record<string, unknown>): UsersRouteSearch => {
            const pageNum = Number(raw.page);
            const limitNum = Number(raw.limit);
            const searchStr = typeof raw.search === 'string' ? raw.search.trim() : undefined;
            const sortBy = typeof raw.sortBy === 'string' && raw.sortBy.trim() ? raw.sortBy.trim() : undefined;
            const sortOrder = raw.sortOrder === 'asc' || raw.sortOrder === 'desc' ? raw.sortOrder : undefined;
            const rolesSearch = typeof raw.rolesSearch === 'string' && raw.rolesSearch.trim() ? raw.rolesSearch : undefined;
            const role = typeof raw.role === 'string' && raw.role.trim() ? raw.role.trim() : undefined;

            return {
                tab: raw.tab === 'roles' ? 'roles' : raw.tab === 'users' ? 'users' : undefined,
                page: Number.isFinite(pageNum) && pageNum > 1 ? Math.floor(pageNum) : undefined,
                limit: Number.isFinite(limitNum) && limitNum > 0 && limitNum <= 100 && limitNum !== DEFAULT_USERS_PAGE_SIZE
                    ? Math.floor(limitNum)
                    : undefined,
                search: searchStr || undefined,
                sortBy,
                sortOrder: sortBy ? sortOrder : undefined,
                isActive: parseStringArrayParam(raw.isActive),
                roles: parseStringArrayParam(raw.roles),
                rolesSearch,
                role,
            };
        },
        beforeLoad: async () => {
            const { useAuth } = await import('@modules/auth/store/auth.store');
            if (!useAuth().canRead('users')) {
                throw redirect({ to: '/dashboard' });
            }
        },
        loaderDeps: ({ search }) => ({
            page: search.page ?? 1,
            limit: search.limit ?? DEFAULT_USERS_PAGE_SIZE,
            search: search.search,
            sortBy: search.sortBy,
            sortOrder: search.sortOrder,
            isActive: search.isActive,
            roles: search.roles,
        }),
        loader: ({ deps }) => {
            queryClient.ensureQueryData(rbacQueries.list(deps));
            queryClient.ensureQueryData(rbacQueries.roles());
            queryClient.ensureQueryData(
                rbacQueries.facets(deps.search, { isActive: deps.isActive, roles: deps.roles })
            );
            queryClient.ensureQueryData({
                queryKey: saasKeys.subscription(),
                queryFn: saasApi.getMySubscription,
                staleTime: 1000 * 60 * 5,
            });
        },
        staleTime: Infinity, // TanStack Router: don't re-run loader once loaded (TanStack Query handles freshness)
        component: UsersRolesPage,
    });

    // Inject deep nested modals (standardized to plural)
    usersRoute.addChildren([
        ...createUserModals(usersRoute),
        ...createRoleModals(usersRoute, 'role'),
        ...createEmployeeModals(usersRoute, 'employees'),
        ...createClientsModals(usersRoute, 'clients'),
        ...createSupplierModals(usersRoute, 'suppliers'),
    ]);

    return usersRoute;
};
