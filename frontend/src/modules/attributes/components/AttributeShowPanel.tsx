import { Component, Show, For } from 'solid-js';
import { useParams, Outlet } from '@tanstack/solid-router';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { useAttributeDetail } from '../data/attributes.queries';
import { ATTRIBUTE_TYPE_LABELS } from '../data/attributes.constants';
import type { AttributeDataType } from '@app/schema/frontend';
import { EditIcon, InfoIcon } from '@shared/ui/icons';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import Button from '@shared/ui/Button';
import Sheet from '@shared/ui/Sheet';
import { StatusBadge } from '@shared/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@shared/ui/Tabs';
import { InfoRow } from '@shared/ui/InfoRow';

interface AttributeShowPanelProps {
    attributeId?: number;
    onClose?: () => void;
}

const AttributeShowPanel: Component<AttributeShowPanelProps> = (props) => {
    const params = useParams({ strict: false }) as () => { attributeId?: string };
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    const attributeId = () => {
        if (props.attributeId) return props.attributeId;
        const parsed = Number(params()?.attributeId);
        return Number.isFinite(parsed) ? parsed : 0;
    };

    const attributeQuery = useAttributeDetail(attributeId);

    return (
        <Sheet
            bindDismiss={bindDismiss}
            isOpen={true}
            onClose={navigateAway}
            title="Detalles del Atributo"
            description="Información y uso de este atributo en categorías"
            size="xxl"
            footer={
                <Button variant="outline" onClick={close}>
                    Cerrar Panel
                </Button>
            }
        >
            <Show
                when={attributeId() > 0}
                fallback={
                    <div class="flex flex-col items-center justify-center py-12 text-center h-full">
                        <div class="text-4xl mb-4 opacity-50">🔍</div>
                        <p class="text-muted font-medium">ID de atributo inválido</p>
                    </div>
                }
            >
                <Show
                    when={!attributeQuery.isLoading}
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
                                <SkeletonLoader type="card" class="h-24" />
                            </div>
                        </div>
                    }
                >
                    <Show
                        when={attributeQuery.data}
                        fallback={
                            <div class="flex flex-col items-center justify-center py-12 text-center h-full">
                                <div class="text-4xl mb-4 opacity-50">📭</div>
                                <p class="text-muted font-medium">No se encontró el atributo</p>
                            </div>
                        }
                    >
                        {(attribute) => (
                            <Tabs defaultValue="general" class="w-full flex flex-col h-full">
                                <div class="sticky top-0 z-20 bg-card/95 backdrop-blur-md pt-5 flex flex-col gap-5">
                                    <div class="flex items-start justify-between flex-shrink-0">
                                        <div class="flex gap-4 items-center">
                                            <div class="size-14 rounded-2xl bg-info/10 flex items-center justify-center text-info font-bold text-2xl shadow-inner border border-info/20">
                                                {attribute().label.substring(0, 1).toUpperCase()}
                                            </div>
                                            <div class="flex flex-col gap-1">
                                                <h3 class="text-xl font-bold text-text leading-tight">{attribute().label}</h3>
                                                <p class="text-sm font-mono text-muted/80">{attribute().key}</p>
                                                <div class="flex gap-2 items-center mt-1">
                                                    <StatusBadge isActive={attribute().is_active} />
                                                    <span class="text-[10px] font-bold text-info bg-info/10 uppercase py-0.5 px-2 rounded-sm tracking-wider">
                                                        {ATTRIBUTE_TYPE_LABELS[attribute().type as AttributeDataType] ?? attribute().type}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            class="gap-2 shrink-0 bg-surface/50 hover:bg-surface"
                                            to={`./edit`}
                                            disabled={!attributeId()}
                                        >
                                            <EditIcon class="size-4 text-muted" />
                                            Editar
                                        </Button>
                                    </div>

                                    <div>
                                        <TabsList class="flex md:w-max overflow-x-auto shadow-sm rounded-xl mb-2">
                                            <TabsTrigger value="general"><InfoIcon /> Configuración</TabsTrigger>
                                            <TabsTrigger value="categories" count={attribute().usedInCategories?.length || 0}> Uso en Categorías</TabsTrigger>
                                        </TabsList>
                                    </div>
                                </div>

                                <div class="flex-1 pr-1 pb-6 pt-4">
                                    <TabsContent value="general" class="space-y-4 fill-mode-both">
                                        <div class="bg-surface/30 rounded-2xl border border-border/40 overflow-hidden shadow-sm">
                                            <div class="bg-surface/50 px-5 py-3 border-b border-border/40 font-semibold text-sm text-text flex items-center gap-2">
                                                <div class="size-1.5 rounded-full bg-primary"></div>
                                                Información Estructural
                                            </div>
                                            <div class="p-5 grid grid-cols-1 gap-6">
                                                <InfoRow label="Key" value={attribute().key} />
                                                <InfoRow label="Etiqueta Pública" value={attribute().label} />
                                                <InfoRow label="Tipo de Control" value={ATTRIBUTE_TYPE_LABELS[attribute().type as AttributeDataType] ?? attribute().type} />
                                            </div>
                                        </div>

                                        <Show when={attribute().default_options && attribute().default_options!.length > 0}>
                                            <div class="bg-surface/30 rounded-2xl border border-border/40 overflow-hidden shadow-sm">
                                                <div class="bg-surface/50 px-5 py-3 border-b border-border/40 font-semibold text-sm text-text flex items-center gap-2">
                                                    <div class="size-1.5 rounded-full bg-info"></div>
                                                    Opciones Predeterminadas
                                                </div>
                                                <div class="p-5">
                                                    <div class="flex flex-wrap gap-2">
                                                        <For each={attribute().default_options}>
                                                            {(opt) => (
                                                                <span class="inline-flex items-center px-2.5 py-1 bg-surface border border-border rounded-lg text-sm text-text font-medium shadow-sm">
                                                                    {opt}
                                                                </span>
                                                            )}
                                                        </For>
                                                    </div>
                                                </div>
                                            </div>
                                        </Show>
                                    </TabsContent>

                                    <TabsContent value="categories" class="fill-mode-both">
                                        <Show when={(attribute().usedInCategories?.length ?? 0) > 0} fallback={
                                            <div class="flex flex-col items-center justify-center text-center py-12 px-4 shadow-sm text-muted bg-surface/30 rounded-2xl border border-dashed border-border/60 min-h-[200px]">
                                                Este atributo no está asignado a ninguna categoría aún.
                                            </div>
                                        }>
                                            <div class="space-y-4">
                                                <For each={attribute().usedInCategories}>
                                                    {(cat) => (
                                                        <div class="bg-card rounded-xl p-4 border border-border/40 shadow-sm flex items-center justify-between gap-4">
                                                            <div class="flex flex-col min-w-0">
                                                                <span class="font-bold text-text truncate">{cat.categoryName}</span>
                                                            </div>
                                                            <div class="flex flex-col items-end shrink-0">
                                                                <Show when={cat.required} fallback={
                                                                    <span class="text-[10px] bg-surface-alt px-1.5 py-0.5 rounded-sm uppercase tracking-wider text-muted">Opcional</span>
                                                                }>
                                                                    <span class="text-[10px] bg-danger/10 text-danger px-1.5 py-0.5 rounded-sm uppercase font-bold tracking-wider">Requerido</span>
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

export default AttributeShowPanel;
