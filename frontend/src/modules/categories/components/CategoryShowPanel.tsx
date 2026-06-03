import { Component, Show, For, createMemo } from 'solid-js';
import { useParams, Outlet, Link } from '@tanstack/solid-router';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { useCategoryDetail, useCategoriesFlat } from '../data/categories.queries';
import { EditIcon, InfoIcon, TagIcon, ChevronRightIcon } from '@shared/ui/icons';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import Button from '@shared/ui/Button';
import LinkButton from '@shared/ui/LinkButton';
import Sheet from '@shared/ui/Sheet';
import { StatusBadge, Badge } from '@shared/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@shared/ui/Tabs';
import { InfoRow } from '@shared/ui/InfoRow';
import { useAuth } from '@modules/auth/store/auth.store';

interface CategoryShowPanelProps {
    categoryId?: number;
    onClose?: () => void;
    onBack?: () => void;
}

const CategoryShowPanel: Component<CategoryShowPanelProps> = (props) => {
    const auth = useAuth();
    const params = useParams({ strict: false }) as () => { categoryId?: string };
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    const categoryId = () => {
        if (props.categoryId) return props.categoryId;
        const parsed = Number(params()?.categoryId);
        return Number.isFinite(parsed) ? parsed : 0;
    };

    const categoryQuery = useCategoryDetail(categoryId);
    const flatQuery = useCategoriesFlat();

    const subCategories = createMemo(() => {
        const flat = flatQuery.data as any[] ?? [];
        return flat.filter(c => c.parent_id === categoryId());
    });

    return (
        <Sheet
            bindDismiss={bindDismiss}
            isOpen={true}
            onClose={navigateAway}
            onBack={props.onBack}
            title="Detalles de la Categoría"
            description="Información completa de jerarquía y propiedades"
            size="xxxl"
            footer={
                <Button variant="outline" onClick={close}>
                    Cerrar Panel
                </Button>
            }
        >
            <Show
                when={categoryId() > 0}
                fallback={
                    <div class="flex flex-col items-center justify-center py-12 text-center h-full">
                        <div class="text-4xl mb-4 opacity-50">🔍</div>
                        <p class="text-muted font-medium">ID de categoría inválido</p>
                    </div>
                }
            >
                <Show
                    when={!categoryQuery.isLoading}
                    fallback={
                        <div class="space-y-6 pt-4">
                            <div class="flex items-center gap-4">
                                <SkeletonLoader type="avatar" class="size-16" />
                                <div class="space-y-2">
                                    <SkeletonLoader type="text" class="w-48 h-6" />
                                    <SkeletonLoader type="text" class="w-32 h-4" />
                                </div>
                            </div>
                            <SkeletonLoader type="text" count={1} class="h-10 rounded-xl" />
                            <div class="grid grid-cols-2 gap-4">
                                <SkeletonLoader type="card" class="h-32" />
                            </div>
                        </div>
                    }
                >
                    <Show
                        when={categoryQuery.data}
                        fallback={
                            <div class="flex flex-col items-center justify-center py-12 text-center h-full">
                                <div class="text-4xl mb-4 opacity-50">📭</div>
                                <p class="text-muted font-medium">No se encontró la categoría</p>
                            </div>
                        }
                    >
                        {(category) => (
                            <Tabs defaultValue="general" class="w-full flex flex-col h-full">
                                <div class="sticky top-0 z-20 bg-card/95 backdrop-blur-md pt-5 flex flex-col gap-5">
                                    <div class="flex items-start justify-between shrink-0">
                                        <div class="flex gap-4 items-center">
                                            <div class="size-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl shadow-inner border border-primary/20">
                                                {category().icon ?? '📁'}
                                            </div>
                                            <div class="flex flex-col gap-1">
                                                <h3 class="text-xl font-bold text-text leading-tight">{category().name}</h3>
                                                <Show when={category().path}>
                                                    <p class="text-sm font-mono text-muted/80">{category().path!.replace(/\./g, ' > ')}</p>
                                                </Show>
                                                <div class="flex gap-2 items-center mt-1">
                                                    <StatusBadge isActive={category().is_active} />
                                                </div>
                                            </div>
                                        </div>

                                        <Show when={auth.canEdit('categories')}>
                                            <LinkButton
                                                variant="outline"
                                                size="sm"
                                                class="gap-2 shrink-0 bg-surface/50 hover:bg-surface"
                                                to={`./edit`}
                                                disabled={!categoryId()}
                                            >
                                                <EditIcon class="size-4 text-muted" />
                                                Editar
                                            </LinkButton>
                                        </Show>
                                    </div>

                                    <div>
                                        <TabsList class="flex md:w-max overflow-x-auto shadow-sm rounded-xl mb-2">
                                            <TabsTrigger value="general"><InfoIcon /> Detalles</TabsTrigger>
                                            <TabsTrigger value="subcategories" count={subCategories().length}> Sub-categorías</TabsTrigger>
                                            <TabsTrigger value="attributes" count={category().attributes?.length || 0}>Atributos</TabsTrigger>
                                        </TabsList>
                                    </div>
                                </div>

                                <div class="flex-1 pr-1 pb-6 pt-4">
                                    <TabsContent value="general" class="space-y-4 fill-mode-both">
                                        <div class="bg-surface/30 rounded-2xl border border-border/40 overflow-hidden shadow-sm">
                                            <div class="bg-surface/50 px-5 py-3 border-b border-border/40 font-semibold text-sm text-text flex items-center gap-2">
                                                <div class="size-1.5 rounded-full bg-primary"></div>
                                                 General
                                            </div>
                                            <div class="p-5 grid grid-cols-1 sm:grid-cols-2 gap-6">
                                                <div class="sm:col-span-2">
                                                    <InfoRow label="Descripción" value={category().description} />
                                                </div>
                                                <InfoRow label="Ruta Completa" value={category().path!.replace(/\./g, ' / ')} />
                                                <div class="flex flex-col gap-1">
                                                    <span class="text-xs font-medium text-muted uppercase tracking-wider">Plantilla de Nombre (SKU)</span>
                                                    <div class="pt-1">
                                                        <Show when={category().name_template} fallback={<span class="text-sm font-mono text-muted/60">No definida</span>}>
                                                            <Badge variant="default" class="text-xs font-mono px-2 py-1 rounded border border-border">
                                                                {category().name_template}
                                                            </Badge>
                                                        </Show>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="subcategories" class="fill-mode-both">
                                        <Show when={subCategories().length > 0} fallback={
                                            <div class="flex flex-col items-center justify-center text-center py-12 px-4 shadow-sm text-muted bg-surface/30 rounded-2xl border border-dashed border-border/60 min-h-[200px]">
                                                Esta categoría no tiene hijos.
                                            </div>
                                        }>
                                            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                <For each={subCategories()}>
                                                    {(sub) => (
                                                        <Link
                                                            to={`/categories/${sub.id}/show`}
                                                            preload="intent"
                                                            class="bg-card hover:bg-surface/40 hover:border-primary/30 transition-all duration-200 rounded-2xl p-5 border border-border/40 shadow-sm flex items-center gap-3 group cursor-pointer"
                                                        >
                                                            <div class="text-2xl shrink-0">{sub.icon ?? '📁'}</div>
                                                            <div class="flex flex-col overflow-hidden flex-1 min-w-0">
                                                                <div class="font-bold text-text truncate group-hover:text-primary transition-colors">{sub.name}</div>
                                                                <div class="flex items-center gap-2 mt-1">
                                                                    <StatusBadge isActive={sub.is_active ?? true} />
                                                                    <span class="text-[10px] text-muted font-mono">ID: {sub.id}</span>
                                                                </div>
                                                            </div>
                                                            <ChevronRightIcon class="size-4 text-muted/30 group-hover:text-primary shrink-0 transition-colors" />
                                                        </Link>
                                                    )}
                                                </For>
                                            </div>
                                        </Show>
                                    </TabsContent>

                                    <TabsContent value="attributes" class="fill-mode-both">
                                        <Show when={(category().attributes?.length ?? 0) > 0} fallback={
                                            <div class="flex flex-col items-center justify-center text-center py-12 px-4 shadow-sm text-muted bg-surface/30 rounded-2xl border border-dashed border-border/60 min-h-[200px]">
                                                <TagIcon class="size-8 opacity-20 mb-3" />
                                                No hay atributos heredados o asociados.
                                            </div>
                                        }>
                                            <div class="space-y-4">
                                                <For each={category().attributes}>
                                                    {(attr) => (
                                                        <div class="bg-card rounded-xl p-4 border border-border/40 shadow-sm flex items-center justify-between gap-4">
                                                            <div class="flex flex-col min-w-0">
                                                                <div class="flex items-center gap-2">
                                                                    <span class="font-bold text-text truncate">{attr.label}</span>
                                                                    <Show when={attr.required}>
                                                                        <Badge variant="danger" class="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-sm">Requerido</Badge>
                                                                    </Show>
                                                                </div>
                                                                <span class="text-xs text-muted font-mono mt-0.5">{attr.key}</span>
                                                            </div>
                                                            <div class="flex flex-col items-end">
                                                                <span class="text-xs font-semibold text-muted uppercase tracking-wider">{attr.type}</span>
                                                                <Show when={attr.specificOptions && attr.specificOptions.length > 0}>
                                                                    <span class="text-[10px] text-muted italic mt-1">Opciones limitadas específicas</span>
                                                                </Show>
                                                            </div>
                                                        </div>
                                                    )}
                                                </For>
                                            </div>
                                        </Show>
                                    </TabsContent>
                                </div>
                            </Tabs>
                        )}
                    </Show>
                </Show>
            </Show>
            
            <Outlet />
        </Sheet>
    );
};

export default CategoryShowPanel;
