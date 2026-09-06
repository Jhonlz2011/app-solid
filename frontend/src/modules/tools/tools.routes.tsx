import { createRoute, redirect, lazyRouteComponent } from '@tanstack/solid-router';
import { queryClient } from '@shared/lib/queryClient';
import GlobalPageLoader from '@/shared/ui/display/GlobalPageLoader';
import { toolsApi } from './data/tools.api';
import { toolKeys } from './data/tools.keys';

const ToolLoansPage = lazyRouteComponent(() => import('./views/ToolLoansPage'));
const ToolLoanNewSheet = lazyRouteComponent(() => import('./components/ToolLoanNewSheet'));

export const createToolsRoutes = (layoutRoute: any) => {
    const toolsRoute = createRoute({
        getParentRoute: () => layoutRoute,
        path: 'tool-loans',
        beforeLoad: async () => {
            const { useAuth } = await import('@modules/auth/store/auth.store');
            const auth = useAuth();
            if (auth.isAuthenticated() && !auth.canRead('tool_loans')) {
                throw redirect({ to: '/dashboard' });
            }
        },
        loader: async () => {
            return await queryClient.prefetchQuery({
                queryKey: toolKeys.loanList(),
                queryFn: () => toolsApi.list(),
                staleTime: 60 * 1000,
            });
        },
        pendingComponent: GlobalPageLoader,
        component: ToolLoansPage,
    });

    const newLoanRoute = createRoute({
        getParentRoute: () => toolsRoute,
        path: 'new',
        component: ToolLoanNewSheet,
    });

    toolsRoute.addChildren([newLoanRoute]);

    return toolsRoute;
};
