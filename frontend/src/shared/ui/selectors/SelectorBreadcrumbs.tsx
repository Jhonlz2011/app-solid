import { Component, For, Show, createMemo } from 'solid-js';
import { Link, useLocation } from '@tanstack/solid-router';
import { ChevronRightIcon } from '@shared/ui/icons';

export interface BreadcrumbItem {
    id: number;
    name: string;
}

export interface SelectorBreadcrumbsProps {
    items: BreadcrumbItem[];
    basePath: string; // e.g. '/categories' o '/locations'
}

/**
 * Helper genérico y type-safe para construir recursivamente la ruta de ancestros
 * desde cualquier lista plana que soporte una estructura jerárquica parent_id.
 */
export function buildBreadcrumbs<T>(
    selectedId: number | null | undefined,
    flatList: T[],
    options: {
        getId: (item: T) => number;
        getParentId: (item: T) => number | null | undefined;
        getName: (item: T) => string;
        skipSelf?: boolean;
    }
): BreadcrumbItem[] {
    if (!selectedId) return [];
    
    const parts: BreadcrumbItem[] = [];
    let current = flatList.find(item => options.getId(item) === selectedId);
    if (!current) return [];

    if (options.skipSelf) {
        const pid = options.getParentId(current);
        current = pid ? flatList.find(item => options.getId(item) === pid) : undefined;
    }

    while (current) {
        parts.unshift({
            id: options.getId(current),
            name: options.getName(current),
        });
        const pid = options.getParentId(current);
        current = pid ? flatList.find(item => options.getId(item) === pid) : undefined;
    }
    return parts;
}

/**
 * Componente compartido para mostrar los breadcrumbs de forma estéticamente
 * idéntica a la original pero con soporte para TanStack Router Link clickeable.
 * Resuelve dinámicamente el prefijo de la ruta según el contexto activo (/new) para no romper el estado.
 */
export const SelectorBreadcrumbs: Component<SelectorBreadcrumbsProps> = (props) => {
    const location = useLocation();

    // Resuelve dinámicamente el prefijo de la ruta de forma compatible con hojas anidadas /new
    const resolvedPath = createMemo(() => {
        const path = location().pathname;
        const target = props.basePath; // e.g. '/categories' o '/locations'
        const index = path.lastIndexOf(target);
        if (index !== -1) {
            let base = path.substring(0, index + target.length);
            const suffix = path.substring(index + target.length);
            // Si el sufijo indica que estamos en el flujo /new o sus hijos anidados
            if (suffix === '/new' || suffix.startsWith('/new/')) {
                base += '/new';
            }
            return base;
        }
        return target;
    });

    return (
        <Show when={props.items.length > 0}>
            <div class="flex items-center gap-1 overflow-x-auto custom-scrollbar-horizontal scroll-smooth min-w-0 max-w-full select-none text-text-secondary text-[11px] font-medium ml-6">
                <For each={props.items}>
                    {(part, i) => (
                        <div class="flex items-center shrink-0">
                            <Link
                                to={`${resolvedPath()}/${part.id}/show`}
                                preload="intent"
                                class="max-w-37.5 truncate text-primary-strong hover:underline cursor-pointer"
                            >
                                {part.name}
                            </Link>
                            <Show when={i() < props.items.length - 1}>
                                <ChevronRightIcon 
                                    stroke-width={4}
                                    class="size-3 mx-1 text-secondary shrink-0" 
                                />
                            </Show>
                        </div>
                    )}
                </For>
            </div>
        </Show>
    );
};

export default SelectorBreadcrumbs;
