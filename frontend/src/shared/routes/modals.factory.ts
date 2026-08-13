import { createRoute, redirect } from '@tanstack/solid-router';
import { queryClient } from '@shared/lib/queryClient';

type PermissionAction = 'canAdd' | 'canEdit';

/**
 * DRY: permission-guarded beforeLoad. Always bounces to where THIS
 * factory instance was mounted (parentRoute.fullPath).
 */
function guardPermission(entityKey: string, action: PermissionAction, parentRoute: any) {
    return async () => {
        const { useAuth } = await import('@modules/auth/store/auth.store');
        if (!useAuth()[action](entityKey)) {
            throw redirect({ to: parentRoute.fullPath });
        }
    };
}

/** DRY: invisible /$id bounce-back */
function bounceToParent(parentRoute: any) {
    return () => { throw redirect({ to: parentRoute.fullPath }); };
}

interface DetailConfig {
    queryKey: (id: number) => readonly unknown[];
    queryFn: (id: number) => Promise<unknown>;
    staleTime?: number;
}

/** DRY: prefetch-on-load for show/edit detail routes. */
function createDetailLoader(idParam: string, detail?: DetailConfig, extraPreload?: (id: number) => Promise<void>) {
    return async ({ params }: { params: Record<string, string> }) => {
        const id = Number(params[idParam]);
        if (isNaN(id)) return;
        
        const promises: Promise<any>[] = [];
        
        if (detail) {
            promises.push(
                queryClient.prefetchQuery({
                    queryKey: detail.queryKey(id),
                    queryFn: () => detail.queryFn(id),
                    staleTime: detail.staleTime ?? 1000 * 30,
                })
            );
        }
        
        if (extraPreload) {
            promises.push(extraPreload(id));
        }

        if (promises.length > 0) {
            await Promise.all(promises);
        }
    };
}

export interface EntityModalsConfig {
    entityKey: string;
    idParam: string;
    components: {
        New: any;
        Edit: any;
        Show?: any; // omit for flat entities without a detail page
    };
    detail?: DetailConfig; // required if Show is present
    showPreload?: (id: number) => Promise<void>;
    editPreload?: (id: number) => Promise<void>;
    /** Attach other factories inside the `new` and/or `edit` sheet */
    nestInNew?: (newRoute: any) => any[];
    nestInEdit?: (editRoute: any) => any[];
    /** Enable /new/$id/show(/edit) — link to an EXISTING record from inside the create flow */
    allowShowFromNew?: boolean;
}

/**
 * Standardized deep-nested modal factory for any catalog entity.
 */
export function createEntityModals(parentRoute: any, basePath = '', config: EntityModalsConfig) {
    const prefix = basePath ? `${basePath}/` : '';
    const { entityKey, idParam, components, detail } = config;

    // --- CREATE ---
    const newRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: `${prefix}new`,
        beforeLoad: guardPermission(entityKey, 'canAdd', parentRoute),
        component: components.New,
    });

    const newChildren: any[] = [...(config.nestInNew?.(newRoute) ?? [])];

    if (config.allowShowFromNew && components.Show) {
        const newShowRoute = createRoute({
            getParentRoute: () => newRoute,
            path: `$${idParam}/show`,
            loader: (detail || config.showPreload) ? createDetailLoader(idParam, detail, config.showPreload) : undefined,
            component: components.Show,
        });
        const newShowEditRoute = createRoute({
            getParentRoute: () => newShowRoute,
            path: `edit`,
            beforeLoad: guardPermission(entityKey, 'canEdit', parentRoute),
            loader: config.editPreload ? createDetailLoader(idParam, undefined, config.editPreload) : undefined,
            component: components.Edit,
        });
        newChildren.push(newShowRoute.addChildren([newShowEditRoute]));
    }

    if (newChildren.length) newRoute.addChildren(newChildren);

    // --- $id ---
    const baseRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: `${prefix}$${idParam}`,
    });

    const indexRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: `/`,
        beforeLoad: bounceToParent(parentRoute),
    });

    const editRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: `edit`,
        beforeLoad: guardPermission(entityKey, 'canEdit', parentRoute),
        loader: (detail || config.editPreload) ? createDetailLoader(idParam, detail, config.editPreload) : undefined,
        component: components.Edit,
    });

    const editChildren = config.nestInEdit?.(editRoute) ?? [];
    if (editChildren.length) editRoute.addChildren(editChildren);

    const baseChildren: any[] = [indexRoute, editRoute];

    if (components.Show) {
        const showRoute = createRoute({
            getParentRoute: () => baseRoute,
            path: `show`,
            loader: (detail || config.showPreload) ? createDetailLoader(idParam, detail, config.showPreload) : undefined,
            component: components.Show,
        });
        const nestedEditRoute = createRoute({
            getParentRoute: () => showRoute,
            path: `edit`,
            beforeLoad: guardPermission(entityKey, 'canEdit', parentRoute),
            loader: config.editPreload ? createDetailLoader(idParam, undefined, config.editPreload) : undefined,
            component: components.Edit,
        });
        baseChildren.push(showRoute.addChildren([nestedEditRoute]));
    }

    return [newRoute, baseRoute.addChildren(baseChildren)];
}
