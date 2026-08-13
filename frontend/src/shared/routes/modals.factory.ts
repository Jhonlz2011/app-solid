import { createRoute, redirect } from '@tanstack/solid-router';
import { queryClient } from '@shared/lib/queryClient';
import type { RbacModule } from '@app/schema/enums';

type PermissionAction = 'canAdd' | 'canEdit';

function guardPermission(entityKey: RbacModule, action: PermissionAction, parentRoute: any) {
    return async () => {
        const { useAuth } = await import('@modules/auth/store/auth.store');
        if (!useAuth()[action](entityKey)) {
            throw redirect({ to: parentRoute.fullPath });
        }
    };
}

function bounceToParent(parentRoute: any) {
    return () => { throw redirect({ to: parentRoute.fullPath }); };
}

interface DetailConfig {
    queryKey: (id: number) => readonly unknown[];
    queryFn: (id: number) => Promise<unknown>;
    staleTime?: number;
}

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

/**
 * Aplica `nestInEdit` a UNA instancia concreta de ruta Edit. Cada entry
 * point que renderiza `components.Edit` (sibling, show/edit, new/show/edit)
 * es un nodo distinto del árbol, así que cada uno necesita su PROPIO set de
 * rutas hijas — `nestInEdit` se invoca una vez por entry point, generando
 * objetos de ruta independientes parentados a esa instancia específica.
 */
function attachEditChildren(editRouteInstance: any, nestInEdit?: (editRoute: any) => any[]) {
    const children = nestInEdit?.(editRouteInstance) ?? [];
    if (children.length) editRouteInstance.addChildren(children);
    return editRouteInstance;
}

export interface EntityModalsConfig {
    entityKey: RbacModule;
    idParam: string;
    components: {
        New: any;
        Edit: any;
        Show?: any;
    };
    detail?: DetailConfig;
    showPreload?: (id: number) => Promise<void>;
    editPreload?: (id: number) => Promise<void>;
    nestInNew?: (newRoute: any) => any[];
    /** Se aplica a TODOS los entry points que renderizan el Edit sheet:
     *  el `/edit` sibling, el `show/edit` anidado, y (si allowShowFromNew)
     *  `new/$id/show/edit`. Cada uno recibe su propio árbol de hijos. */
    nestInEdit?: (editRoute: any) => any[];
    allowShowFromNew?: boolean;
}

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
        const newShowEditRoute = attachEditChildren(
            createRoute({
                getParentRoute: () => newShowRoute,
                path: `edit`,
                beforeLoad: guardPermission(entityKey, 'canEdit', parentRoute),
                loader: config.editPreload ? createDetailLoader(idParam, undefined, config.editPreload) : undefined,
                component: components.Edit,
            }),
            config.nestInEdit
        );
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

    const editRoute = attachEditChildren(
        createRoute({
            getParentRoute: () => baseRoute,
            path: `edit`,
            beforeLoad: guardPermission(entityKey, 'canEdit', parentRoute),
            loader: (detail || config.editPreload) ? createDetailLoader(idParam, detail, config.editPreload) : undefined,
            component: components.Edit,
        }),
        config.nestInEdit
    );

    const baseChildren: any[] = [indexRoute, editRoute];

    if (components.Show) {
        const showRoute = createRoute({
            getParentRoute: () => baseRoute,
            path: `show`,
            loader: (detail || config.showPreload) ? createDetailLoader(idParam, detail, config.showPreload) : undefined,
            component: components.Show,
        });
        const nestedEditRoute = attachEditChildren(
            createRoute({
                getParentRoute: () => showRoute,
                path: `edit`,
                beforeLoad: guardPermission(entityKey, 'canEdit', parentRoute),
                loader: config.editPreload ? createDetailLoader(idParam, undefined, config.editPreload) : undefined,
                component: components.Edit,
            }),
            config.nestInEdit
        );
        baseChildren.push(showRoute.addChildren([nestedEditRoute]));
    }

    return [newRoute, baseRoute.addChildren(baseChildren)];
}