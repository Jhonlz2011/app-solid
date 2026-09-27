import { Component, createSignal, createResource, For, Show, createMemo } from 'solid-js';
import { useSearch } from '@tanstack/solid-router';
import { getApiUrl } from '@shared/config/runtime-env';
import type { SaasPlanId } from '@app/schema/enums';

export interface PlanSelectorProps {
    selectedPlanId: SaasPlanId;
    onPlanChange: (planId: SaasPlanId) => void;
    compact?: boolean;
    showAddons?: boolean;
}

// ─── API Types ───────────────────────────────────────────────────────────────

interface PlanFeatureDetail {
    code: string;
    name: string;
    category: string;
    value: boolean | number | string;
    unit_label: string | null;
}

interface ApiPlan {
    id: SaasPlanId;
    name: string;
    description: string;
    interval: string;
    price_usd: string;
    annual_discount_percent: number;
    is_popular: boolean;
    sort_order: number;
    features: Record<string, boolean | number | string>;
    feature_details: PlanFeatureDetail[];
}

interface ApiAddon {
    id: string;
    name: string;
    description: string;
    addon_type: string;
    billing_type: string;
    price_usd: string;
    quantity: number;
    unit_label: string;
}

// ─── Grouped Plan (monthly + yearly merged) ──────────────────────────────────

interface GroupedPlan {
    baseKey: string;
    name: string;
    isPopular: boolean;
    monthlyPrice: number;
    yearlyPrice: number;
    monthlyPlanId: SaasPlanId;
    yearlyPlanId: SaasPlanId;
    annualDiscountPercent: number;
    freeAccountant: boolean;
    features: string[];
    sortOrder: number;
}

// ─── Static Fallback ─────────────────────────────────────────────────────────

const FALLBACK_PLANS: GroupedPlan[] = [
    {
        baseKey: 'free', name: 'Freemium', isPopular: false,
        monthlyPrice: 0, yearlyPrice: 0, monthlyPlanId: 'free', yearlyPlanId: 'free',
        annualDiscountPercent: 0, freeAccountant: false, sortOrder: 0,
        features: ['1 Usuario Operativo', '15 Comprobantes SRI / año', '150 MB Almacenamiento', 'Catálogo y Facturación Básica'],
    },
    {
        baseKey: 'starter', name: 'Emprendedor', isPopular: false,
        monthlyPrice: 9.99, yearlyPrice: 99.00, monthlyPlanId: 'starter_monthly', yearlyPlanId: 'starter_yearly',
        annualDiscountPercent: 17, freeAccountant: true, sortOrder: 1,
        features: ['2 Usuarios Operativos', '250 Comprobantes SRI / mes', '1 Terminal de Caja POS', '1 GB Almacenamiento', 'Inventario y Compras'],
    },
    {
        baseKey: 'pro', name: 'Pro', isPopular: true,
        monthlyPrice: 34.99, yearlyPrice: 349.00, monthlyPlanId: 'pro_monthly', yearlyPlanId: 'pro_yearly',
        annualDiscountPercent: 17, freeAccountant: true, sortOrder: 2,
        features: ['5 Usuarios Operativos', 'Comprobantes SRI ILIMITADOS', '3 Cajas POS Simultáneas', 'Contabilidad NIIF', '5 GB Almacenamiento'],
    },
    {
        baseKey: 'enterprise', name: 'Corporativo', isPopular: false,
        monthlyPrice: 89.99, yearlyPrice: 899.00, monthlyPlanId: 'enterprise_monthly', yearlyPlanId: 'enterprise_yearly',
        annualDiscountPercent: 17, freeAccountant: true, sortOrder: 3,
        features: ['15 Usuarios Operativos', 'Comprobantes SRI ILIMITADOS', 'Manufactura y Nómina', '5 Cajas POS', '50 GB Almacenamiento'],
    },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveBaseKey(planId: SaasPlanId): string {
    if (planId === 'free') return 'free';
    return planId.replace('_monthly', '').replace('_yearly', '');
}

function buildFeatureLabels(plan: ApiPlan, allPlans: ApiPlan[]): string[] {
    const f = plan.features;
    const labels: string[] = [];

    const maxUsers = Number(f['max_users'] ?? 1);
    labels.push(`${maxUsers} Usuario${maxUsers > 1 ? 's' : ''} Operativo${maxUsers > 1 ? 's' : ''}`);

    const sriMonthly = Number(f['sri_documents_monthly'] ?? 0);
    const sriYearly = Number(f['sri_documents_yearly'] ?? 0);
    if (sriMonthly === -1) {
        labels.push('Comprobantes SRI ILIMITADOS');
    } else if (sriMonthly > 0) {
        labels.push(`${sriMonthly} Comprobantes SRI / mes`);
    } else if (sriYearly > 0) {
        labels.push(`${sriYearly} Comprobantes SRI / año`);
    }

    const pos = Number(f['max_pos_registers'] ?? 0);
    if (f['modules.pos'] && pos > 0) {
        labels.push(`${pos} ${pos === 1 ? 'Terminal' : 'Cajas'} POS`);
    }

    const storageMb = Number(f['max_storage_mb'] ?? 0);
    if (storageMb > 0) {
        labels.push(storageMb >= 1024 ? `${Math.round(storageMb / 1024)} GB Almacenamiento` : `${storageMb} MB Almacenamiento`);
    }

    if (f['modules.accounting']) labels.push('Contabilidad NIIF y Retenciones');
    if (f['modules.hr_payroll']) labels.push('Nómina y Gestión de Empleados');
    if (f['modules.manufacturing']) labels.push('Manufactura y Órdenes de Trabajo');
    if (f['modules.crm']) labels.push('CRM y Visitas Técnicas');
    if (f['modules.tools']) labels.push('Gestión de Herramientas');

    return labels;
}

function groupApiPlans(plans: ApiPlan[]): GroupedPlan[] {
    const grouped = new Map<string, Partial<GroupedPlan> & { monthlyPlan?: ApiPlan; yearlyPlan?: ApiPlan }>();

    for (const p of plans) {
        const base = resolveBaseKey(p.id);
        if (!grouped.has(base)) {
            grouped.set(base, { baseKey: base, name: p.name, isPopular: p.is_popular, sortOrder: p.sort_order });
        }
        const g = grouped.get(base)!;
        const price = parseFloat(p.price_usd);
        if (p.interval === 'YEARLY' || p.id === 'free') {
            g.yearlyPrice = price;
            g.yearlyPlanId = p.id;
            g.yearlyPlan = p;
        }
        if (p.interval === 'MONTHLY' || p.id === 'free') {
            g.monthlyPrice = price;
            g.monthlyPlanId = p.id;
            g.monthlyPlan = p;
        }
        g.annualDiscountPercent = p.annual_discount_percent || 0;
        g.freeAccountant = Boolean(p.features['free_accountant_seat']);
    }

    return Array.from(grouped.values())
        .map(g => {
            const refPlan = g.monthlyPlan || g.yearlyPlan;
            const defaultPlanId: SaasPlanId = g.monthlyPlanId ?? g.yearlyPlanId ?? 'free';
            return {
                baseKey: g.baseKey!,
                name: g.name!,
                isPopular: g.isPopular ?? false,
                monthlyPrice: g.monthlyPrice ?? 0,
                yearlyPrice: g.yearlyPrice ?? 0,
                monthlyPlanId: g.monthlyPlanId ?? defaultPlanId,
                yearlyPlanId: g.yearlyPlanId ?? defaultPlanId,
                annualDiscountPercent: g.annualDiscountPercent ?? 0,
                freeAccountant: g.freeAccountant ?? false,
                features: refPlan ? buildFeatureLabels(refPlan, plans) : [],
                sortOrder: g.sortOrder ?? 0,
            } satisfies GroupedPlan;
        })
        .sort((a, b) => a.sortOrder - b.sortOrder);
}

// ─── Data Fetchers ───────────────────────────────────────────────────────────

const apiBase = getApiUrl();

async function fetchPlans(): Promise<GroupedPlan[]> {
    try {
        const res = await fetch(`${apiBase}/api/saas/plans`, { credentials: 'include' });
        if (!res.ok) return FALLBACK_PLANS;
        const data: ApiPlan[] = await res.json();
        if (!data.length) return FALLBACK_PLANS;
        return groupApiPlans(data);
    } catch {
        return FALLBACK_PLANS;
    }
}

async function fetchAddons(): Promise<ApiAddon[]> {
    try {
        const res = await fetch(`${apiBase}/api/saas/addons`, { credentials: 'include' });
        if (!res.ok) return [];
        return await res.json();
    } catch {
        return [];
    }
}

// ─── Component ───────────────────────────────────────────────────────────────

export const PlanSelector: Component<PlanSelectorProps> = (props) => {
    const search = useSearch({ strict: false });
    const urlPlanParam = () => (search() as any)?.plan as string | undefined;

    const [plans] = createResource(fetchPlans);
    const [addons] = createResource(() => props.showAddons !== false, (shouldFetch) => shouldFetch ? fetchAddons() : Promise.resolve([]));

    const [billingInterval, setBillingInterval] = createSignal<'monthly' | 'yearly'>('monthly');

    // Auto-select from URL param on mount
    const initialParam = urlPlanParam() || props.selectedPlanId;
    if (initialParam) {
        if (initialParam.endsWith('_yearly')) setBillingInterval('yearly');
    }

    const handleSelectPlan = (plan: GroupedPlan) => {
        if (plan.baseKey === 'free') {
            props.onPlanChange('free');
        } else {
            props.onPlanChange(billingInterval() === 'yearly' ? plan.yearlyPlanId : plan.monthlyPlanId);
        }
    };

    const handleToggleInterval = (interval: 'monthly' | 'yearly') => {
        setBillingInterval(interval);
        const current = props.selectedPlanId;
        if (current === 'free') return;
        const currentBase = resolveBaseKey(current);
        const target = (plans() || FALLBACK_PLANS).find(p => p.baseKey === currentBase);
        if (target) {
            props.onPlanChange(interval === 'yearly' ? target.yearlyPlanId : target.monthlyPlanId);
        }
    };

    const isSelected = (plan: GroupedPlan) => {
        if (plan.baseKey === 'free') return props.selectedPlanId === 'free';
        return props.selectedPlanId === plan.monthlyPlanId || props.selectedPlanId === plan.yearlyPlanId;
    };

    const maxDiscount = createMemo(() => {
        const list = plans() || FALLBACK_PLANS;
        return Math.max(...list.map(p => p.annualDiscountPercent || 0));
    });

    const resolvedPlans = () => plans() || FALLBACK_PLANS;

    return (
        <div class="space-y-4">
            {/* Header / Interval Toggle */}
            <div class="flex flex-col sm:flex-row items-center justify-between gap-3 pb-1">
                <div>
                    <span class="text-sm font-semibold text-foreground block">Planes y Beneficios</span>
                    <span class="text-xs text-muted">Selecciona el plan que mejor se adapte a tu operación comercial.</span>
                </div>

                <div class="flex items-center p-0.5 bg-surface/80 rounded-xl border border-border shrink-0">
                    <button
                        type="button"
                        onClick={() => handleToggleInterval('monthly')}
                        class={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            billingInterval() === 'monthly'
                                ? 'bg-primary text-white shadow-sm'
                                : 'text-muted hover:text-foreground'
                        }`}
                    >
                        Facturación Mensual
                    </button>
                    <button
                        type="button"
                        onClick={() => handleToggleInterval('yearly')}
                        class={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                            billingInterval() === 'yearly'
                                ? 'bg-primary text-white shadow-sm'
                                : 'text-muted hover:text-foreground'
                        }`}
                    >
                        <span>Anual</span>
                        <Show when={maxDiscount() > 0}>
                            <span class="px-1.5 py-0.2 text-[10px] font-bold uppercase rounded bg-emerald-500 text-white">
                                -{maxDiscount()}%
                            </span>
                        </Show>
                    </button>
                </div>
            </div>

            {/* Plan Cards Grid */}
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <For each={resolvedPlans()}>
                    {(plan) => {
                        const selected = () => isSelected(plan);
                        const price = () => billingInterval() === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
                        const periodLabel = () => plan.baseKey === 'free' ? 'gratis de por vida' : billingInterval() === 'yearly' ? '/año' : '/mes';

                        return (
                            <div
                                onClick={() => handleSelectPlan(plan)}
                                class={`relative flex flex-col p-4 rounded-2xl border transition-all cursor-pointer ${
                                    selected()
                                        ? 'border-primary ring-2 ring-primary/20 bg-primary/[0.03] shadow-md'
                                        : 'border-border/70 hover:border-border hover:bg-surface/30'
                                }`}
                            >
                                {/* Popular badge */}
                                <Show when={plan.isPopular}>
                                    <div class="absolute -top-2.5 right-3">
                                        <span class="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-linear-to-r from-primary to-indigo-600 text-white shadow-xs">
                                            Más Popular
                                        </span>
                                    </div>
                                </Show>

                                {/* Plan title & price */}
                                <div class="mb-3">
                                    <h4 class="font-bold text-base text-foreground flex items-center justify-between">
                                        <span>{plan.name}</span>
                                        <span class={`size-4 rounded-full border flex items-center justify-center transition-all ${
                                            selected()
                                                ? 'border-primary bg-primary text-white'
                                                : 'border-border bg-background'
                                        }`}>
                                            <Show when={selected()}>
                                                <svg class="size-2.5 stroke-current stroke-2" fill="none" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                                </svg>
                                            </Show>
                                        </span>
                                    </h4>

                                    <div class="mt-2 flex items-baseline gap-1">
                                        <span class="text-2xl font-black text-foreground">
                                            ${price() === 0 ? '0' : price().toFixed(2)}
                                        </span>
                                        <span class="text-xs text-muted">{periodLabel()}</span>
                                    </div>
                                </div>

                                {/* Free Accountant Callout */}
                                <Show when={plan.freeAccountant}>
                                    <div class="mb-3 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                        <span class="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <span>Incluye Asiento de Contador</span>
                                    </div>
                                </Show>

                                {/* Features List */}
                                <ul class="space-y-1.5 text-xs text-muted flex-1 mt-1 border-t border-border/50 pt-2.5">
                                    <For each={plan.features}>
                                        {(feat) => (
                                            <li class="flex items-start gap-1.5">
                                                <svg class="size-3.5 text-emerald-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4.5 12.75l6 6 9-13.5" />
                                                </svg>
                                                <span class="leading-tight">{feat}</span>
                                            </li>
                                        )}
                                    </For>
                                </ul>
                            </div>
                        );
                    }}
                </For>
            </div>

            {/* Add-ons Section */}
            <Show when={props.showAddons !== false && (addons() || []).length > 0}>
                <div class="pt-3 border-t border-border/50">
                    <div class="mb-2">
                        <span class="text-sm font-semibold text-foreground">Add-ons Disponibles</span>
                        <span class="text-xs text-muted ml-2">Complementos que puedes agregar a cualquier plan de pago.</span>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        <For each={addons() || []}>
                            {(addon) => (
                                <div class="flex items-start gap-3 p-3 rounded-xl border border-border/60 bg-surface/20 hover:bg-surface/40 transition-colors">
                                    <div class="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                                        <Show when={addon.addon_type === 'USER_SEATS'} fallback={
                                            <Show when={addon.addon_type === 'POS_REGISTERS'} fallback={
                                                <Show when={addon.addon_type === 'STORAGE_GB'} fallback={
                                                    <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                                }>
                                                    <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7C5 4 4 5 4 7z" /></svg>
                                                </Show>
                                            }>
                                                <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                            </Show>
                                        }>
                                            <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                        </Show>
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <div class="flex items-baseline justify-between gap-2">
                                            <span class="text-xs font-semibold text-foreground truncate">{addon.name}</span>
                                            <span class="text-xs font-bold text-primary whitespace-nowrap">
                                                ${parseFloat(addon.price_usd).toFixed(2)}
                                                <span class="text-[10px] text-muted font-normal">/{addon.billing_type === 'RECURRING' ? 'mes' : 'único'}</span>
                                            </span>
                                        </div>
                                        <p class="text-[11px] text-muted mt-0.5 line-clamp-2">{addon.description}</p>
                                    </div>
                                </div>
                            )}
                        </For>
                    </div>
                </div>
            </Show>
        </div>
    );
};
