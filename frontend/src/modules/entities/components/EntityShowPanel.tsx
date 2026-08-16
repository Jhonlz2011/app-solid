/**
 * EntityShowPanel.tsx — Generic detailed view panel for any Entity (Clients, Suppliers, Employees, Carriers).
 */
import { Component, Show, For } from 'solid-js';
import { useParams, useLocation, Outlet } from '@tanstack/solid-router';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { EditIcon, UserIcon, InfoIcon, MapPinIcon, TruckIcon, BriefcaseIcon } from '@shared/ui/icons';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import Button from '@shared/ui/Button';
import LinkButton from '@shared/ui/LinkButton';
import Sheet from '@shared/ui/Sheet';
import { StatusBadge, Badge, CounterBadge } from '@shared/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@shared/ui/Tabs';
import { InfoRow } from '@shared/ui/InfoRow';
import { useAuth } from '@modules/auth/store/auth.store';
import { formatCurrency, formatDate } from '@shared/utils/formatters';
import { useClient } from '@modules/clients/data/clients.queries';
import { useSupplier } from '@modules/suppliers/data/suppliers.queries';
import { useEmployee } from '@modules/employees/data/employees.queries';
import type { EntityModuleType } from './EntityNewSheet';
import { getPersonTypeLabel, getTaxIdTypeLabel, getTaxRegimeTypeLabel } from '../models/entity.types';

export interface EntityShowPanelProps {
    id?: number;
    clientId?: number;
    supplierId?: number;
    employeeId?: number;
    type?: EntityModuleType;
    onClose?: () => void;
}

export const EntityShowPanel: Component<EntityShowPanelProps> = (props) => {
    const auth = useAuth();
    const params = useParams({ strict: false }) as () => any;
    const location = useLocation();
    const nav = useSheetNavigation(props);

    const resolvedType = (): EntityModuleType => {
        if (props.type) return props.type;
        const pathname = location().pathname;
        if (pathname.includes('/suppliers')) return 'supplier';
        if (pathname.includes('/employees')) return 'employee';
        if (pathname.includes('/carriers')) return 'carrier';
        return 'client';
    };

    const entityId = () => {
        if (props.id) return props.id;
        if (props.clientId) return props.clientId;
        if (props.supplierId) return props.supplierId;
        if (props.employeeId) return props.employeeId;
        const p = params();
        return Number(p?.id ?? p?.clientId ?? p?.supplierId ?? p?.employeeId ?? 0);
    };

    const clientQuery = useClient(entityId, () => resolvedType() === 'client');
    const supplierQuery = useSupplier(entityId, () => resolvedType() === 'supplier');
    const employeeQuery = useEmployee(entityId, () => resolvedType() === 'employee' || resolvedType() === 'carrier');

    const activeQuery = () => {
        const t = resolvedType();
        if (t === 'supplier') return supplierQuery;
        if (t === 'employee' || t === 'carrier') return employeeQuery;
        return clientQuery;
    };

    const query = () => activeQuery();
    const entity = () => query().data;

    const typeConfig = () => {
        const t = resolvedType();
        switch (t) {
            case 'supplier':
                return {
                    title: 'Detalles del Proveedor',
                    description: 'Información completa del proveedor',
                    permKey: 'suppliers',
                    editPath: `/suppliers/${entityId()}/edit`,
                };
            case 'employee':
                return {
                    title: 'Detalles del Empleado',
                    description: 'Información completa del empleado',
                    permKey: 'employees',
                    editPath: `/employees/${entityId()}/edit`,
                };
            case 'carrier':
                return {
                    title: 'Detalles del Transportista',
                    description: 'Información completa del transportista',
                    permKey: 'carriers',
                    editPath: `/carriers/${entityId()}/edit`,
                };
            case 'client':
            default:
                return {
                    title: 'Detalles del Cliente',
                    description: 'Información completa del cliente',
                    permKey: 'clients',
                    editPath: `/clients/${entityId()}/edit`,
                };
        }
    };

    const canEdit = () => auth.canEdit(typeConfig().permKey as any);

    return (
        <Sheet
            bindDismiss={nav.bindDismiss}
            isOpen={true}
            onClose={nav.navigateAway}
            title={typeConfig().title}
            description={typeConfig().description}
            size="xxxxl"
            footer={
                <Button variant="outline" onClick={nav.close}>
                    Cerrar Panel
                </Button>
            }
        >
            <Show
                when={entityId() > 0}
                fallback={
                    <div class="flex flex-col items-center justify-center py-12 text-center h-full">
                        <div class="text-4xl mb-4 opacity-50">🔍</div>
                        <p class="text-muted font-medium">ID de registro inválido</p>
                    </div>
                }
            >
                <Show
                    when={!query().isLoading}
                    fallback={
                        <div class="space-y-6 pt-4">
                            <div class="flex items-center gap-4">
                                <SkeletonLoader type="avatar" class="size-16" />
                                <div class="space-y-2">
                                    <SkeletonLoader type="text" class="w-48 h-6" />
                                    <SkeletonLoader type="text" class="w-32 h-4" />
                                </div>
                            </div>
                            <div class="grid grid-cols-2 gap-4 mt-6">
                                <SkeletonLoader type="text" count={4} />
                                <SkeletonLoader type="text" count={4} />
                            </div>
                        </div>
                    }
                >
                    <Show
                        when={entity()}
                        fallback={
                            <div class="flex flex-col items-center justify-center py-12 text-center h-full">
                                <div class="text-4xl mb-4 opacity-50">📭</div>
                                <p class="text-muted font-medium">No se encontró el registro</p>
                            </div>
                        }
                    >
                        {(e) => (
                            <div class="space-y-6 pb-6">
                                {/* Header Card */}
                                <div class="bg-card border border-border rounded-2xl p-5 shadow-xs relative overflow-hidden">
                                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div class="flex items-start gap-4">
                                            <div class="size-14 rounded-2xl bg-linear-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 flex items-center justify-center text-primary font-bold text-xl shrink-0 shadow-inner">
                                                {e().business_name?.substring(0, 2).toUpperCase() || 'EN'}
                                            </div>
                                            <div>
                                                <div class="flex items-center gap-2.5 flex-wrap">
                                                    <h3 class="font-bold text-text text-lg leading-tight">
                                                        {e().business_name}
                                                    </h3>
                                                    <StatusBadge isActive={e().is_active ?? true} />
                                                </div>
                                                <Show when={e().trade_name}>
                                                    <p class="text-sm text-muted font-medium mt-0.5">{e().trade_name}</p>
                                                </Show>
                                                <div class="flex items-center gap-3 mt-2 text-xs text-muted flex-wrap">
                                                    <span class="font-mono bg-surface px-2 py-0.5 rounded-md border border-border">
                                                        {getTaxIdTypeLabel(e().tax_id_type)}: {e().tax_id}
                                                    </span>
                                                    <span>•</span>
                                                    <span>{getPersonTypeLabel(e().person_type)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <Show when={canEdit()}>
                                            <div class="flex items-center gap-2 self-start sm:self-auto shrink-0">
                                                <LinkButton
                                                    to={typeConfig().editPath}
                                                    preload="intent"
                                                    variant="outline"
                                                    size="sm"
                                                    icon={<EditIcon class="size-4" />}
                                                >
                                                    Editar
                                                </LinkButton>
                                            </div>
                                        </Show>
                                    </div>
                                </div>

                                {/* Tabs Navigation */}
                                <Tabs defaultValue="general">
                                    <TabsList>
                                        <TabsTrigger value="general" class="gap-2">
                                            <InfoIcon class="size-4" />
                                            <span>General</span>
                                        </TabsTrigger>
                                        <TabsTrigger value="contacts" class="gap-2">
                                            <UserIcon class="size-4" />
                                            <span>Contactos</span>
                                            <CounterBadge count={e().contacts?.length ?? 0} />
                                        </TabsTrigger>
                                        <TabsTrigger value="addresses" class="gap-2">
                                            <MapPinIcon class="size-4" />
                                            <span>Direcciones</span>
                                            <CounterBadge count={e().addresses?.length ?? 0} />
                                        </TabsTrigger>
                                        <Show when={e().is_employee || resolvedType() === 'employee'}>
                                            <TabsTrigger value="employee" class="gap-2">
                                                <BriefcaseIcon class="size-4" />
                                                <span>Empleado</span>
                                            </TabsTrigger>
                                        </Show>
                                        <Show when={e().is_carrier || resolvedType() === 'carrier'}>
                                            <TabsTrigger value="carrier" class="gap-2">
                                                <TruckIcon class="size-4" />
                                                <span>Transportista</span>
                                                <CounterBadge count={(e().vehicles?.length ?? 0) + (e().drivers?.length ?? 0)} />
                                            </TabsTrigger>
                                        </Show>
                                    </TabsList>

                                    {/* General Tab */}
                                    <TabsContent value="general" class="space-y-4">
                                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div class="bg-card border border-border rounded-2xl p-4 space-y-3">
                                                <h4 class="text-xs font-bold text-muted uppercase tracking-wider">
                                                    Datos Fiscales y Contables
                                                </h4>
                                                <InfoRow label="Régimen Tributario" value={getTaxRegimeTypeLabel(e().tax_regime_type)} />
                                                <InfoRow label="Obligado a Contabilidad" value={e().obligado_contabilidad ? 'Sí' : 'No'} />
                                                <InfoRow label="Agente de Retención" value={e().is_retention_agent ? 'Sí' : 'No'} />
                                                <InfoRow label="Contribuyente Especial" value={e().is_special_contributor ? 'Sí' : 'No'} />
                                            </div>

                                            <div class="bg-card border border-border rounded-2xl p-4 space-y-3">
                                                <h4 class="text-xs font-bold text-muted uppercase tracking-wider">
                                                    Contacto Principal
                                                </h4>
                                                <InfoRow label="Email de Facturación" value={e().email_billing || 'No registrado'} />
                                                <InfoRow label="Teléfono" value={e().phone || 'No registrado'} />
                                                <InfoRow label="Roles en el Sistema">
                                                    <div class="flex gap-1.5 flex-wrap">
                                                        <Show when={e().is_client}><Badge variant="success">Cliente</Badge></Show>
                                                        <Show when={e().is_supplier}><Badge variant="warning">Proveedor</Badge></Show>
                                                        <Show when={e().is_employee}><Badge variant="info">Empleado</Badge></Show>
                                                        <Show when={e().is_carrier}><Badge variant="primary">Transportista</Badge></Show>
                                                        <Show when={!e().is_client && !e().is_supplier && !e().is_employee && !e().is_carrier}>
                                                            <span class="text-sm text-text font-medium">—</span>
                                                        </Show>
                                                    </div>
                                                </InfoRow>
                                            </div>
                                        </div>
                                    </TabsContent>

                                    {/* Contacts Tab */}
                                    <TabsContent value="contacts">
                                        <Show
                                            when={(e().contacts?.length ?? 0) > 0}
                                            fallback={
                                                <div class="text-center py-10 border border-dashed border-border rounded-2xl text-muted text-sm">
                                                    No hay contactos registrados
                                                </div>
                                            }
                                        >
                                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <For each={e().contacts}>
                                                    {(c) => (
                                                        <div class="bg-card border border-border rounded-2xl p-4 space-y-2 relative">
                                                            <div class="flex items-center justify-between">
                                                                <span class="font-bold text-text text-sm">{c.name}</span>
                                                                <Show when={c.is_primary}>
                                                                    <Badge variant="primary" class="text-[10px]">Principal</Badge>
                                                                </Show>
                                                            </div>
                                                            <Show when={c.position}>
                                                                <p class="text-xs text-muted">{c.position}</p>
                                                            </Show>
                                                            <div class="text-xs space-y-1 text-muted pt-1 border-t border-border/50">
                                                                <Show when={c.email}><div>✉️ {c.email}</div></Show>
                                                                <Show when={c.phone}><div>📞 {c.phone}</div></Show>
                                                            </div>
                                                        </div>
                                                    )}
                                                </For>
                                            </div>
                                        </Show>
                                    </TabsContent>

                                    {/* Addresses Tab */}
                                    <TabsContent value="addresses">
                                        <Show
                                            when={(e().addresses?.length ?? 0) > 0}
                                            fallback={
                                                <div class="text-center py-10 border border-dashed border-border rounded-2xl text-muted text-sm">
                                                    No hay direcciones registradas
                                                </div>
                                            }
                                        >
                                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <For each={e().addresses}>
                                                    {(a) => (
                                                        <div class="bg-card border border-border rounded-2xl p-4 space-y-2">
                                                            <div class="flex items-center justify-between">
                                                                <span class="font-bold text-text text-sm">{a.address_line}</span>
                                                                <Show when={a.is_main}>
                                                                    <Badge variant="primary" class="text-[10px]">Principal</Badge>
                                                                </Show>
                                                            </div>
                                                            <p class="text-xs text-muted">
                                                                {[a.city, a.country].filter(Boolean).join(', ')}
                                                            </p>
                                                        </div>
                                                    )}
                                                </For>
                                            </div>
                                        </Show>
                                    </TabsContent>

                                    {/* Employee Details Tab */}
                                    <Show when={e().is_employee || resolvedType() === 'employee'}>
                                        <TabsContent value="employee" class="space-y-4">
                                            <div class="bg-card border border-border rounded-2xl p-4 space-y-3">
                                                <h4 class="text-xs font-bold text-muted uppercase tracking-wider">
                                                    Información Laboral
                                                </h4>
                                                <InfoRow label="Departamento" value={e().employeeDetails?.department || 'No especificado'} />
                                                <InfoRow label="Cargo / Puesto" value={e().employeeDetails?.job_title || 'No especificado'} />
                                                <InfoRow label="Salario Base" value={e().employeeDetails?.salary_base ? formatCurrency(Number(e().employeeDetails?.salary_base)) : 'No registrado'} />
                                                <InfoRow label="Fecha de Contratación" value={e().employeeDetails?.hire_date ? formatDate(e().employeeDetails?.hire_date) : 'No registrada'} />
                                                <InfoRow label="Costo por Hora" value={e().employeeDetails?.cost_per_hour ? formatCurrency(Number(e().employeeDetails?.cost_per_hour)) : 'No registrado'} />
                                            </div>
                                        </TabsContent>
                                    </Show>

                                    {/* Carrier Details Tab */}
                                    <Show when={e().is_carrier || resolvedType() === 'carrier'}>
                                        <TabsContent value="carrier" class="space-y-6">
                                            {/* Vehicles */}
                                            <div class="space-y-3">
                                                <h4 class="text-xs font-bold text-muted uppercase tracking-wider">
                                                    Vehículos Asignados ({(e().vehicles?.length ?? 0)})
                                                </h4>
                                                <Show
                                                    when={(e().vehicles?.length ?? 0) > 0}
                                                    fallback={
                                                        <div class="text-center py-6 border border-dashed border-border rounded-xl text-muted text-xs">
                                                            No hay vehículos registrados
                                                        </div>
                                                    }
                                                >
                                                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        <For each={e().vehicles}>
                                                            {(v) => (
                                                                <div class="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
                                                                    <div>
                                                                        <span class="font-mono font-bold text-sm text-text">{v.license_plate}</span>
                                                                        <Show when={v.description}>
                                                                            <p class="text-xs text-muted">{v.description}</p>
                                                                        </Show>
                                                                    </div>
                                                                    <StatusBadge isActive={v.is_active} />
                                                                </div>
                                                            )}
                                                        </For>
                                                    </div>
                                                </Show>
                                            </div>

                                            {/* Drivers */}
                                            <div class="space-y-3">
                                                <h4 class="text-xs font-bold text-muted uppercase tracking-wider">
                                                    Conductores Registrados ({(e().drivers?.length ?? 0)})
                                                </h4>
                                                <Show
                                                    when={(e().drivers?.length ?? 0) > 0}
                                                    fallback={
                                                        <div class="text-center py-6 border border-dashed border-border rounded-xl text-muted text-xs">
                                                            No hay conductores registrados
                                                        </div>
                                                    }
                                                >
                                                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        <For each={e().drivers}>
                                                            {(d) => (
                                                                <div class="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
                                                                    <div>
                                                                        <span class="font-bold text-sm text-text">{d.full_name}</span>
                                                                        <p class="text-xs text-muted font-mono">{d.identification_number}</p>
                                                                        <Show when={d.phone}>
                                                                            <p class="text-xs text-muted">📞 {d.phone}</p>
                                                                        </Show>
                                                                    </div>
                                                                    <StatusBadge isActive={d.is_active} />
                                                                </div>
                                                            )}
                                                        </For>
                                                    </div>
                                                </Show>
                                            </div>
                                        </TabsContent>
                                    </Show>
                                </Tabs>
                            </div>
                        )}
                    </Show>
                </Show>
            </Show>
            <Outlet />
        </Sheet>
    );
};

export default EntityShowPanel;
