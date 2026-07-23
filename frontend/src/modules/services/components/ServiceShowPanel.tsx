import { Component, Show, For, createMemo } from 'solid-js';
import { useParams, useNavigate } from '@tanstack/solid-router';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { useProduct } from '@/modules/products/data/products.queries';
import { productTypeLabels, productSubtypeLabels } from '@/modules/products/data/products.api';
import Sheet from '@shared/ui/Sheet';
import Button from '@shared/ui/Button';
import LinkButton from '@shared/ui/LinkButton';
import { Badge, StatusBadge } from '@shared/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@shared/ui/Tabs';
import { InfoRow } from '@shared/ui/InfoRow';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import { useAuth } from '@modules/auth/store/auth.store';

interface ServiceShowPanelProps {
    serviceId?: number;
    onClose?: () => void;
}

const ServiceShowPanel: Component<ServiceShowPanelProps> = (props) => {
    const auth = useAuth();
    const navigate = useNavigate();
    const params = useParams({ strict: false }) as () => any;
    const { bindDismiss } = useSheetNavigation(props);
    const serviceId = () => props.serviceId ?? Number(params()?.serviceId);

    const query = useProduct(serviceId);

    const service = () => query.data;
    const variants = createMemo(() => (service() as any)?.variants ?? []);

    const formatPrice = (val: string | number | null | undefined) => {
        if (val === null || val === undefined) return '—';
        return `$${Number(val).toFixed(2)}`;
    };

    const handleClose = () => {
        navigate({ to: '../../services/' });
    };

    return (
        <Sheet
            bindDismiss={bindDismiss}
            isOpen={true}
            onClose={handleClose}
            title={service()?.name ?? 'Servicio'}
            description={`Slug: ${(service() as any)?.slug ?? ''}`}
            size="xxxl"
            footer={
                <div class="flex items-center gap-2 w-full justify-end">
                    <Button variant="outline" onClick={handleClose}>Cerrar</Button>
                    <Show when={auth.canEdit('products')}>
                        <LinkButton to={`./edit`} preload="intent">
                            Editar
                        </LinkButton>
                    </Show>
                </div>
            }
        >
            <Show when={!query.isPending} fallback={<SkeletonLoader type="text" count={6} />}>
                <Show when={service()}>
                    {(p) => (
                        <Tabs defaultValue="general" class="w-full">
                            <TabsList>
                                <TabsTrigger value="general">General</TabsTrigger>
                                <TabsTrigger value="variants" count={variants().length}>Variantes</TabsTrigger>
                            </TabsList>

                            {/* TAB: General */}
                            <TabsContent value="general">
                                <div class="space-y-6 py-4">
                                    {/* Status + Type */}
                                    <div class="flex flex-wrap items-center gap-2">
                                        <StatusBadge isActive={p().is_active ?? true} />
                                        <Badge variant={p().product_type === 'SERVICIO' ? 'primary' : 'info'}>
                                            {productTypeLabels[p().product_type as keyof typeof productTypeLabels] ?? p().product_type}
                                        </Badge>
                                        <Show when={p().product_subtype}>
                                            <Badge variant="primary">
                                                {productSubtypeLabels[p().product_subtype as keyof typeof productSubtypeLabels] ?? p().product_subtype}
                                            </Badge>
                                        </Show>
                                    </div>

                                    {/* Info Grid */}
                                    <div class="bg-surface/30 rounded-xl border border-border divide-y divide-border">
                                        <InfoRow label="Slug" value={(p() as any).slug} />
                                        <InfoRow label="Nombre" value={p().name} />
                                        <InfoRow label="Descripción" value={p().description || '—'} />
                                        <InfoRow label="Categoría" value={(p() as any).category?.name || '—'} />
                                    </div>

                                    {/* Shared Attributes (JSONB) */}
                                    <Show when={Object.keys((p() as any).shared_attributes ?? {}).length > 0}>
                                        <div class="bg-surface/30 rounded-xl border border-border p-4 space-y-3">
                                            <h4 class="text-xs font-semibold uppercase tracking-wider text-muted">Atributos</h4>
                                            <div class="grid grid-cols-2 gap-3">
                                                <For each={Object.entries((p() as any).shared_attributes ?? {})}>
                                                    {([key, val]) => (
                                                        <div class="flex items-center justify-between bg-card rounded-lg px-3 py-2 border border-border/50">
                                                            <span class="text-xs text-muted font-medium">{key}</span>
                                                            <span class="text-sm font-medium text-text">{String(val)}</span>
                                                        </div>
                                                    )}
                                                </For>
                                            </div>
                                        </div>
                                    </Show>

                                    {/* Pricing */}
                                    <div class="bg-surface/30 rounded-xl border border-border p-4 space-y-3">
                                        <h4 class="text-xs font-semibold uppercase tracking-wider text-muted">Precios</h4>
                                        <div class="grid grid-cols-3 gap-4">
                                            <div>
                                                <span class="text-xs text-muted block">Precio Base por Defecto</span>
                                                <span class="text-lg font-bold font-mono">{formatPrice((p() as any).default_base_price)}</span>
                                            </div>
                                            <div>
                                                <span class="text-xs text-muted block">Último Costo</span>
                                                <span class="text-lg font-mono">{formatPrice((p() as any).last_cost ?? 0)}</span>
                                            </div>
                                            <div>
                                                <span class="text-xs text-muted block">IVA</span>
                                                <span class="text-lg font-mono">
                                                    {p().iva_rate_code === 0 ? '0%' : p().iva_rate_code === 2 ? '12%' : p().iva_rate_code === 4 ? '15%' : `Cod ${p().iva_rate_code}`}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* TAB: Variants */}
                            <TabsContent value="variants">
                                <div class="py-4 space-y-3">
                                    <Show when={variants().length === 0}>
                                        <p class="text-sm text-muted text-center py-8">Este servicio no tiene variantes.</p>
                                    </Show>
                                    <For each={variants()}>
                                        {(v: any) => (
                                            <div class="bg-surface/30 rounded-xl border border-border p-4 space-y-2">
                                                <div class="flex items-center justify-between">
                                                    <div class="flex items-center gap-2">
                                                        <span class="font-medium text-text">{v.variant_name || v.sku}</span>
                                                        <span class="text-xs font-mono text-muted bg-surface px-1.5 py-0.5 rounded border border-border">{v.sku}</span>
                                                        <Show when={v.is_default}>
                                                            <Badge variant="success" class="text-[10px]">Default</Badge>
                                                        </Show>
                                                    </div>
                                                    <StatusBadge isActive={v.is_active} />
                                                </div>
                                                <div class="grid grid-cols-4 gap-3 text-xs">
                                                    <div>
                                                        <span class="text-muted block">Precio</span>
                                                        <span class="font-mono font-semibold">{v.base_price ? formatPrice(v.base_price) : 'Hereda'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            </TabsContent>
                        </Tabs>
                    )}
                </Show>
            </Show>
        </Sheet>
    );
};

export default ServiceShowPanel;
