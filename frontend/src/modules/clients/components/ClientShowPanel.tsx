import { Component, Show, For } from 'solid-js';
import { useNavigate, useParams, Outlet } from '@tanstack/solid-router';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { useClient } from '../data/clients.api';
import { EditIcon, UserIcon, InfoIcon, MapPinIcon, ScalesIcon } from '@shared/ui/icons';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import Button from '@shared/ui/Button';
import Sheet from '@shared/ui/Sheet';
import { personTypeLabels, taxIdTypeLabels, taxRegimeTypeLabels } from '../models/client.types';
import { CounterBadge, StatusBadge } from '@shared/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@shared/ui/Tabs';
import { InfoRow } from '@shared/ui/InfoRow';

interface ClientShowPanelProps {
    clientId?: number;
    onClose?: () => void;
}

const ClientShowPanel: Component<ClientShowPanelProps> = (props) => {
    const navigate = useNavigate();
    const params = useParams({ strict: false }) as () => any;

    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);

    const clientId = () => props.clientId ?? Number(params()?.clientId);

    const clientQuery = useClient(clientId);

    return (
        <Sheet
            bindDismiss={bindDismiss}
            isOpen={true}
            onClose={navigateAway}
            title="Detalles del Cliente"
            description="Información completa del cliente"
            size="xxxxl"
            footer={
                <Button variant="outline" onClick={close}>
                    Cerrar Panel
                </Button>
            }
        >
            <Show
                when={clientId() > 0}
                fallback={
                    <div class="flex flex-col items-center justify-center py-12 text-center h-full">
                        <div class="text-4xl mb-4 opacity-50">🔍</div>
                        <p class="text-muted font-medium">ID de cliente inválido</p>
                    </div>
                }
            >
                <Show
                    when={!clientQuery.isLoading}
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
                                <SkeletonLoader type="card" class="h-32" />
                            </div>
                        </div>
                    }
                >
                    <Show
                        when={clientQuery.data}
                        fallback={
                            <div class="flex flex-col items-center justify-center py-12 text-center h-full">
                                <div class="text-4xl mb-4 opacity-50">📭</div>
                                <p class="text-muted font-medium">No se encontró el cliente</p>
                            </div>
                        }
                    >
                        {(client) => (
                            <Tabs defaultValue="general" class="w-full flex flex-col h-full">
                                {/* 
                                    ESTRATEGIA TAILWIND V4 PARA STICKY HEADERS:
                                    En lugar de tener múltiples elementos sticky compitiendo con `top-0` y `top-19`,
                                    agrupamos TODO el encabezado (Info + TabsList) en un ÚNICO contenedor `sticky top-0`.
                                    El navegador calculará dinámicamente la altura total y el contenido siempre hará scroll 
                                    perfectamente por debajo, sin importar si el nombre de la empresa hace salto de línea.
                                */}
                                <div class="sticky top-0 z-20 bg-card/95 backdrop-blur-md pt-5 flex flex-col gap-5">
                                    {/* Header info */}
                                    <div class="flex items-start justify-between flex-shrink-0">
                                        <div class="flex gap-4 items-center">
                                            <div class="size-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl shadow-inner border border-primary/20">
                                                {client().business_name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div class="flex flex-col gap-1">
                                                <h3 class="text-xl font-bold text-text leading-tight">{client().business_name}</h3>
                                                <Show when={client().trade_name}>
                                                    <p class="text-sm text-muted font-medium">{client().trade_name}</p>
                                                </Show>
                                                <div class="flex gap-2 items-center mt-1">
                                                    <span class="text-xs font-mono bg-surface/50 px-2 py-0.5 rounded-md border border-border/50 text-text/80 shadow-sm">{client().tax_id}</span>
                                                    <StatusBadge isActive={client().is_active} />
                                                </div>
                                            </div>
                                        </div>

                                        <Button
                                            to={`./edit`}
                                            variant="outline"
                                            size="sm"
                                            class="gap-2 shrink-0 bg-surface/50 hover:bg-surface"
                                            disabled={!clientId()}
                                        >
                                            <EditIcon class="size-4 text-muted" />
                                            Editar
                                        </Button>
                                    </div>

                                    {/* TabsList */}
                                    <div>
                                        <TabsList class="flex py-1.5 overflow-x-auto shadow-sm rounded-xl">
                                            <TabsTrigger value="general"><InfoIcon /> Información General</TabsTrigger>
                                            <TabsTrigger value="contacts" count={client().contacts?.length || 0}><UserIcon class="size-4" /> Contactos</TabsTrigger>
                                            <TabsTrigger value="addresses" count={client().addresses?.length || 0}><MapPinIcon class="size-4" /> Direcciones</TabsTrigger>
                                        </TabsList>
                                    </div>
                                </div>

                                {/* Scrolled Content */}
                                <div class="flex-1 pr-1 pb-6 pt-4">

                                    <TabsContent value="general" class="space-y-4 fill-mode-both">
                                        <div class="bg-surface/30 rounded-2xl border border-border/40 overflow-hidden shadow-sm">
                                            <div class="bg-surface/50 px-5 py-3 border-b border-border/40 font-semibold text-sm text-text flex items-center gap-2">
                                                <div class="size-1.5 rounded-full bg-primary"></div>
                                                Identificación & Empresa
                                            </div>
                                            <div class="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                                <div class="sm:col-span-2">
                                                    <InfoRow label="Razón Social" value={client().business_name} />
                                                </div>
                                                <div class="sm:col-span-1">
                                                    <InfoRow label="Nombre Comercial" value={client().trade_name} />
                                                </div>
                                                <InfoRow label="Número ID" value={client().tax_id} />
                                                <InfoRow label="Tipo ID" value={taxIdTypeLabels[client().tax_id_type as keyof typeof taxIdTypeLabels] ?? client().tax_id_type} />
                                                <InfoRow label="Tipo Persona" value={personTypeLabels[client().person_type as keyof typeof personTypeLabels] ?? client().person_type} />
                                            </div>
                                        </div>
                                        <div class="bg-surface/30 rounded-2xl border border-border/40 overflow-hidden shadow-sm">
                                            <div class="bg-surface/50 px-5 py-3 border-b border-border/40 font-semibold text-sm text-text flex items-center gap-2">
                                                <div class="size-1.5 rounded-full bg-info"></div>
                                                Contacto Principal
                                            </div>
                                            <div class="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                                <InfoRow label="Email Facturación" value={client().email_billing} />
                                                <InfoRow label="Teléfono" value={client().phone} />
                                            </div>
                                        </div>

                                        <div class="bg-surface/30 rounded-2xl border border-border/40 overflow-hidden shadow-sm">
                                            <div class="bg-surface/50 px-5 py-3 border-b border-border/40 font-semibold text-sm text-text flex items-center gap-2">
                                                <div class="size-1.5 rounded-full bg-warning"></div>
                                                Clasificación SRI & Obligaciones
                                            </div>
                                            <div class="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-6">
                                                <div class="sm:col-span-2">
                                                    <InfoRow label="Régimen Fiscal" value={client().tax_regime_type ? taxRegimeTypeLabels[client().tax_regime_type as keyof typeof taxRegimeTypeLabels] ?? client().tax_regime_type : undefined} />
                                                </div>

                                                <div class="flex flex-col gap-1">
                                                    <span class="text-xs font-medium text-muted uppercase tracking-wider">Agente de Retención</span>
                                                    <div class="pt-1">
                                                        <Show when={client().is_retention_agent} fallback={<span class="text-sm text-muted font-medium bg-surface px-2.5 py-1 rounded-md border border-border/60">No Asignado</span>}>
                                                            <span class="text-xs bg-info/10 text-info px-2.5 py-1 rounded-md font-bold uppercase tracking-wider border border-info/20 shadow-sm flex items-center w-max gap-1.5"><div class="size-1.5 bg-info rounded-full"></div> SÍ ES AGENTE</span>
                                                        </Show>
                                                    </div>
                                                </div>

                                                <div class="flex flex-col gap-1">
                                                    <span class="text-xs font-medium text-muted uppercase tracking-wider">Contribuyente Especial</span>
                                                    <div class="pt-1">
                                                        <Show when={client().is_special_contributor} fallback={<span class="text-sm text-muted font-medium bg-surface px-2.5 py-1 rounded-md border border-border/60">No Asignado</span>}>
                                                            <span class="text-xs bg-danger/10 text-danger px-2.5 py-1 rounded-md font-bold uppercase tracking-wider border border-danger/20 shadow-sm flex items-center w-max gap-1.5"><div class="size-1.5 bg-danger rounded-full"></div> SÍ ES ESPECIAL</span>
                                                        </Show>
                                                    </div>
                                                </div>

                                                <div class="flex flex-col gap-1">
                                                    <span class="text-xs font-medium text-muted uppercase tracking-wider">Obligado a llevar Contabilidad</span>
                                                    <div class="pt-1">
                                                        <Show when={client().obligado_contabilidad} fallback={<span class="text-sm text-muted font-medium bg-surface px-2.5 py-1 rounded-md border border-border/60">No</span>}>
                                                            <span class="text-xs bg-success/10 text-success px-2.5 py-1 rounded-md font-bold uppercase tracking-wider border border-success/20 shadow-sm flex items-center w-max gap-1.5"><div class="size-1.5 bg-success rounded-full"></div> SÍ ESTÁ OBLIGADO</span>
                                                        </Show>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="contacts" class="fill-mode-both">
                                        <Show when={(client().contacts?.length ?? 0) > 0} fallback={
                                            <div class="flex flex-col items-center justify-center text-center py-12 px-4 shadow-sm text-muted bg-surface/30 rounded-2xl border border-dashed border-border/60 min-h-[200px]">
                                                <UserIcon class="size-8 opacity-20 mb-3" />
                                                No hay contactos registrados para este cliente.
                                            </div>
                                        }>
                                            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                <For each={client().contacts}>
                                                    {(contact) => (
                                                        <div class="bg-card hover:bg-surface/40 transition-colors rounded-2xl p-5 border border-border/40 shadow-sm flex flex-col gap-4">
                                                            <div class="flex items-center gap-3 border-b border-border/50 pb-3">
                                                                <div class="bg-primary/10 size-10 flex items-center justify-center rounded-xl text-primary shrink-0 drop-shadow-sm"><UserIcon class="size-5" /></div>
                                                                <div class="flex flex-col flex-1 overflow-hidden">
                                                                    <div class="font-bold text-text truncate leading-tight" title={contact.name}>{contact.name}</div>
                                                                    <div class="text-[11px] text-muted tracking-wider uppercase font-semibold truncate pt-0.5">{contact.position || 'Sin cargo'}</div>
                                                                </div>
                                                                <Show when={contact.is_primary}>
                                                                    <span class="text-[10px] bg-primary/10 border border-primary/20 text-primary px-2.5 py-1 rounded-lg uppercase font-bold tracking-wider shrink-0 flex items-center gap-1">
                                                                        <div class="size-1 rounded-full bg-primary animate-pulse"></div> Principal
                                                                    </span>
                                                                </Show>
                                                            </div>
                                                            <div class="grid grid-cols-1 gap-3">
                                                                <InfoRow label="Email" value={contact.email} />
                                                                <InfoRow label="Teléfono" value={contact.phone} />
                                                            </div>
                                                        </div>
                                                    )}
                                                </For>
                                            </div>
                                        </Show>
                                    </TabsContent>

                                    <TabsContent value="addresses" class="fill-mode-both">
                                        <Show when={(client().addresses?.length ?? 0) > 0} fallback={
                                            <div class="flex flex-col items-center justify-center text-center py-12 px-4 shadow-sm text-muted bg-surface/30 rounded-2xl border border-dashed border-border/60 min-h-[200px]">
                                                <div class="text-2xl opacity-30 mb-2">📍</div>
                                                No hay direcciones registradas para este cliente.
                                            </div>
                                        }>
                                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <For each={client().addresses}>
                                                    {(address) => (
                                                        <div class="bg-card hover:bg-surface/40 transition-colors rounded-2xl p-5 border border-border/40 shadow-sm flex flex-col gap-4">
                                                            <div class="flex items-start justify-between border-b border-border/50 pb-3">
                                                                <div class="flex items-start gap-3 flex-1 overflow-hidden">
                                                                    <div class="bg-primary/10 mt-0.5 size-8 flex items-center justify-center rounded-lg text-primary shrink-0 opacity-80">📍</div>
                                                                    <div class="font-semibold text-text leading-snug break-words pr-2" title={address.address_line}>{address.address_line}</div>
                                                                </div>
                                                                <Show when={address.is_main}>
                                                                    <span class="text-[10px] bg-primary/10 border border-primary/20 text-primary px-2.5 py-1 rounded-lg uppercase font-bold tracking-wider shrink-0 mt-0.5">
                                                                        Matriz
                                                                    </span>
                                                                </Show>
                                                            </div>
                                                            <div class="grid grid-cols-2 gap-4">
                                                                <InfoRow label="Ciudad" value={address.city} />
                                                                <InfoRow label="Cód. Postal" value={address.postal_code} />
                                                                <div class="col-span-2">
                                                                    <div class="flex flex-col gap-1 animate-in fade-in">
                                                                        <span class="text-xs font-medium text-muted uppercase tracking-wider">País</span>
                                                                        <div class="flex items-center gap-2">
                                                                            <img
                                                                                src={`https://flagcdn.com/${(address.country_code || 'EC').toLowerCase()}.svg`}
                                                                                alt={address.country_code || 'EC'}
                                                                                class="size-5 rounded-sm object-cover shadow-sm"
                                                                                loading="lazy"
                                                                            />
                                                                            <span class="text-sm text-text font-medium">{address.country || 'Ecuador'}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </For>
                                            </div>
                                        </Show>
                                    </TabsContent>

                                    {/* <TabsContent value="fiscal" class="animate-in fade-in duration-300 fill-mode-both">
                                        
                                        </TabsContent> */}
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

export default ClientShowPanel;