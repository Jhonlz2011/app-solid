import { Component, Show, For } from 'solid-js';
import { useParams, Outlet } from '@tanstack/solid-router';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { useEmployee } from '../data/employees.queries';
import { EditIcon, UserIcon, InfoIcon, MapPinIcon } from '@shared/ui/icons';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import Button from '@shared/ui/Button';
import LinkButton from '@shared/ui/LinkButton';
import Sheet from '@shared/ui/Sheet';
import { personTypeLabels, taxIdTypeLabels, taxRegimeTypeLabels } from '../models/employee.types';
import { StatusBadge } from '@shared/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@shared/ui/Tabs';
import { InfoRow } from '@shared/ui/InfoRow';
import { useAuth } from '@modules/auth/store/auth.store';

// We need a specific useEmployee query since it wasn't exported in employees.queries.ts
import { createQuery } from '@tanstack/solid-query';
import { employeesApi } from '../data/employees.api';
import { employeeKeys } from '../data/employees.keys';

function useEmployeeQuery(id: () => number) {
    return createQuery(() => ({
        queryKey: employeeKeys.detail(id()),
        queryFn: () => employeesApi.get(id()),
        enabled: id() > 0,
    }));
}


interface EmployeeShowPanelProps {
    employeeId?: number;
    onClose?: () => void;
}

const EmployeeShowPanel: Component<EmployeeShowPanelProps> = (props) => {
    const auth = useAuth();
    const params = useParams({ strict: false }) as () => any;
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    const employeeId = () => props.employeeId ?? Number(params()?.employeeId);

    const employeeQuery = useEmployeeQuery(employeeId);

    return (
        <Sheet
            bindDismiss={bindDismiss}
            isOpen={true}
            onClose={navigateAway}
            title="Detalles del Empleado"
            description="Información completa del empleado"
            size="xxxxl"
            footer={
                <Button variant="outline" onClick={close}>
                    Cerrar Panel
                </Button>
            }
        >
            <Show
                when={employeeId() > 0}
                fallback={
                    <div class="flex flex-col items-center justify-center py-12 text-center h-full">
                        <div class="text-4xl mb-4 opacity-50">🔍</div>
                        <p class="text-muted font-medium">ID de empleado inválido</p>
                    </div>
                }
            >
                <Show
                    when={!employeeQuery.isLoading}
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
                        when={employeeQuery.data}
                        fallback={
                            <div class="flex flex-col items-center justify-center py-12 text-center h-full">
                                <div class="text-4xl mb-4 opacity-50">📭</div>
                                <p class="text-muted font-medium">No se encontró el empleado</p>
                            </div>
                        }
                    >
                        {(employee) => (
                            <Tabs defaultValue="general" class="w-full flex flex-col h-full">
                                <div class="sticky top-0 z-20 bg-card/95 backdrop-blur-md pt-5 flex flex-col gap-5">
                                    <div class="flex items-start justify-between shrink-0">
                                        <div class="flex gap-4 items-center">
                                            <div class="size-14 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary font-bold text-2xl shadow-inner border border-secondary/20">
                                                {employee().business_name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div class="flex flex-col gap-1">
                                                <h3 class="text-xl font-bold text-text leading-tight">{employee().business_name}</h3>
                                                <Show when={employee().employeeDetails?.job_title}>
                                                    <p class="text-sm text-muted font-medium">{employee().employeeDetails?.job_title}</p>
                                                </Show>
                                                <div class="flex gap-2 items-center mt-1">
                                                    <span class="text-xs font-mono bg-surface/50 px-2 py-0.5 rounded-md border border-border/50 text-text/80 shadow-sm">{employee().tax_id}</span>
                                                    <StatusBadge isActive={employee().is_active} />
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <Show when={auth.canEdit('employees')}>
                                            <LinkButton
                                                variant="outline"
                                                size="sm"
                                                class="gap-2 shrink-0 bg-surface/50 hover:bg-surface"
                                                to={`./edit`}
                                                disabled={!employeeId()}
                                            >
                                                <EditIcon class="size-4 text-muted" />
                                                Editar
                                            </LinkButton>
                                        </Show>
                                    </div>

                                    <div>
                                        <TabsList class="flex py-1.5 overflow-x-auto shadow-sm rounded-xl">
                                            <TabsTrigger value="general"><InfoIcon /> General</TabsTrigger>
                                            <TabsTrigger value="contacts" count={employee().contacts?.length || 0}><UserIcon class="size-4" /> Contactos</TabsTrigger>
                                            <TabsTrigger value="addresses" count={employee().addresses?.length || 0}><MapPinIcon class="size-4" /> Direcciones</TabsTrigger>
                                        </TabsList>
                                    </div>
                                </div>

                                <div class="flex-1 pr-1 pb-6 pt-4">

                                    <TabsContent value="general" class="space-y-4 fill-mode-both">
                                        
                                        <Show when={employee().employeeDetails}>
                                            {(details) => (
                                                <div class="bg-surface/30 rounded-2xl border border-border/40 overflow-hidden shadow-sm">
                                                    <div class="bg-surface/50 px-5 py-3 border-b border-border/40 font-semibold text-sm text-text flex items-center gap-2">
                                                        <div class="size-1.5 rounded-full bg-secondary"></div>
                                                        Datos Laborales
                                                    </div>
                                                    <div class="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                                        <InfoRow label="Departamento" value={details().department} />
                                                        <InfoRow label="Cargo" value={details().job_title} />
                                                        <InfoRow label="Fecha Contrato" value={details().hire_date} />
                                                        <InfoRow label="Salario Base" value={details().salary_base ? `$${details().salary_base}` : undefined} />
                                                        <InfoRow label="Costo por Hora" value={details().cost_per_hour ? `$${details().cost_per_hour}` : undefined} />
                                                    </div>
                                                </div>
                                            )}
                                        </Show>

                                        <div class="bg-surface/30 rounded-2xl border border-border/40 overflow-hidden shadow-sm">
                                            <div class="bg-surface/50 px-5 py-3 border-b border-border/40 font-semibold text-sm text-text flex items-center gap-2">
                                                <div class="size-1.5 rounded-full bg-primary"></div>
                                                Identificación & Empresa
                                            </div>
                                            <div class="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                                <div class="sm:col-span-2">
                                                    <InfoRow label="Razón Social" value={employee().business_name} />
                                                </div>
                                                <InfoRow label="Número ID" value={employee().tax_id} />
                                                <InfoRow label="Tipo ID" value={employee().tax_id_type} />
                                                <InfoRow label="Tipo Persona" value={employee().person_type} />
                                            </div>
                                        </div>
                                        <div class="bg-surface/30 rounded-2xl border border-border/40 overflow-hidden shadow-sm">
                                            <div class="bg-surface/50 px-5 py-3 border-b border-border/40 font-semibold text-sm text-text flex items-center gap-2">
                                                <div class="size-1.5 rounded-full bg-info"></div>
                                                Contacto Principal
                                            </div>
                                            <div class="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                                <InfoRow label="Email Facturación" value={employee().email_billing} />
                                                <InfoRow label="Teléfono" value={employee().phone} />
                                            </div>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="contacts" class="fill-mode-both">
                                        <Show when={(employee().contacts?.length ?? 0) > 0} fallback={
                                            <div class="flex flex-col items-center justify-center text-center py-12 px-4 shadow-sm text-muted bg-surface/30 rounded-2xl border border-dashed border-border/60 min-h-50">
                                                <UserIcon class="size-8 opacity-20 mb-3" />
                                                No hay contactos registrados para este empleado.
                                            </div>
                                        }>
                                            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                <For each={employee().contacts}>
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
                                        <Show when={(employee().addresses?.length ?? 0) > 0} fallback={
                                            <div class="flex flex-col items-center justify-center text-center py-12 px-4 shadow-sm text-muted bg-surface/30 rounded-2xl border border-dashed border-border/60 min-h-50">
                                                <div class="text-2xl opacity-30 mb-2">📍</div>
                                                No hay direcciones registradas para este empleado.
                                            </div>
                                        }>
                                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <For each={employee().addresses}>
                                                    {(address) => (
                                                        <div class="bg-card hover:bg-surface/40 transition-colors rounded-2xl p-5 border border-border/40 shadow-sm flex flex-col gap-4">
                                                            <div class="flex items-start justify-between border-b border-border/50 pb-3">
                                                                <div class="flex items-start gap-3 flex-1 overflow-hidden">
                                                                    <div class="bg-primary/10 mt-0.5 size-8 flex items-center justify-center rounded-lg text-primary shrink-0 opacity-80">📍</div>
                                                                    <div class="font-semibold text-text leading-snug wrap-break-word pr-2" title={address.address_line}>{address.address_line}</div>
                                                                </div>
                                                                <Show when={address.is_main}>
                                                                    <span class="text-[10px] bg-primary/10 border border-primary/20 text-primary px-2.5 py-1 rounded-lg uppercase font-bold tracking-wider shrink-0 mt-0.5">
                                                                        Matriz
                                                                    </span>
                                                                </Show>
                                                            </div>
                                                            <div class="grid grid-cols-2 gap-4">
                                                                <InfoRow label="Ciudad/Cantón" value={address.city} />
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

export default EmployeeShowPanel;
