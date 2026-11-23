import { Component, createSignal, createResource, For, Show, createMemo } from 'solid-js';
import { useSearch } from '@tanstack/solid-router';
import { getApiUrl } from '@shared/config/runtime-env';
import type { SaasPlanId } from '@app/schema/enums';

export interface PlanSelectorProps {
    selectedPlanId: SaasPlanId;
    onPlanChange: (planId: SaasPlanId) => void;
}

export interface PlanSummaryInfo {
    name: string;
    priceLabel: string;
}

// ─── API & Grouped Types ─────────────────────────────────────────────────────

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
}

interface GroupedPlan {
    baseKey: string;
    title: string;
    subtitle: string;
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
        baseKey: 'free',
        title: 'Freemium',
        subtitle: 'Para empezar',
        isPopular: false,
        monthlyPrice: 0,
        yearlyPrice: 0,
        monthlyPlanId: 'free',
        yearlyPlanId: 'free',
        annualDiscountPercent: 0,
        freeAccountant: false,
        sortOrder: 0,
        features: ['1 Usuario Operativo', '15 Comprobantes SRI / año', '150 MB Almacenamiento'],
    },
    {
        baseKey: 'starter',
        title: 'Emprendedor',
        subtitle: 'Starter + POS',
        isPopular: false,
        monthlyPrice: 9.99,
        yearlyPrice: 99,
        monthlyPlanId: 'starter_monthly',
        yearlyPlanId: 'starter_yearly',
        annualDiscountPercent: 17,
        freeAccountant: true,
        sortOrder: 1,
        features: ['2 Usuarios Operativos', '250 Comprobantes SRI / mes', '1 Terminal POS', '1 GB Almacenamiento'],
    },
    {
        baseKey: 'pro',
        title: 'Negocio Pro',
        subtitle: 'ERP & Contable',
        isPopular: true,
        monthlyPrice: 34.99,
        yearlyPrice: 349,
        monthlyPlanId: 'pro_monthly',
        yearlyPlanId: 'pro_yearly',
        annualDiscountPercent: 17,
        freeAccountant: true,
        sortOrder: 2,
        features: [
            '5 Usuarios Operativos',
            'Comprobantes SRI ilimitados',
            '3 Cajas POS',
            '5 GB Almacenamiento',
            'Contabilidad NIIF y Retenciones',
            'Nómina y Gestión de Empleados',
        ],
    },
    {
        baseKey: 'enterprise',
        title: 'Corporativo',
        subtitle: 'Manufactura & Holding',
        isPopular: false,
        monthlyPrice: 89.99,
        yearlyPrice: 899,
        monthlyPlanId: 'enterprise_monthly',
        yearlyPlanId: 'enterprise_yearly',
        annualDiscountPercent: 17,
        freeAccountant: true,
        sortOrder: 3,
        features: [
            '15 Usuarios Operativos',
            'Comprobantes SRI ilimitados',
            '8 Cajas POS',
            '20 GB Almacenamiento',
            'Contabilidad NIIF y Retenciones',
            'Nómina y Gestión de Empleados',
            'Manufactura y Órdenes de Trabajo',
            'CRM y Visitas Técnicas',
        ],
    },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveBaseKey(planId: SaasPlanId): string {
    if (planId === 'free') return 'free';
    return planId.replace('_monthly', '').replace('_yearly', '');
}

function parsePlanTitle(rawName: string, baseKey: string): { title: string; subtitle: string } {
    const parenMatch = rawName.match(/\(([^)]+)\)/);
    const cleaned = rawName
        .replace(/\([^)]*\)/g, '')
        .replace(/^Plan\s+/i, '')
        .trim();
    const defaultSubtitles: Record<string, string> = {
        free: 'Para empezar',
        starter: 'Starter + POS',
        pro: 'ERP & Contable',
        enterprise: 'Manufactura & Holding',
    };
    return {
        title: cleaned || rawName,
        subtitle: parenMatch?.[1]?.trim() || defaultSubtitles[baseKey] || '',
    };
}

function formatPrice(amount: number): string {
    if (amount === 0) return '$0';
    return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

function buildFeatureLabels(plan: ApiPlan): string[] {
    const f = plan.features;
    const labels: string[] = [];

    const maxUsers = Number(f['max_users'] ?? 1);
    labels.push(`${maxUsers} Usuario${maxUsers > 1 ? 's' : ''} Operativo${maxUsers > 1 ? 's' : ''}`);

    const sriMonthly = Number(f['sri_documents_monthly'] ?? 0);
    const sriYearly = Number(f['sri_documents_yearly'] ?? 0);
    if (sriMonthly === -1) {
        labels.push('Comprobantes SRI ilimitados');
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
            const { title, subtitle } = parsePlanTitle(p.name, base);
            grouped.set(base, { baseKey: base, title, subtitle, isPopular: p.is_popular, sortOrder: p.sort_order });
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
        g.annualDiscountPercent = p.annual_discount_percent || g.annualDiscountPercent || 0;
        g.freeAccountant = Boolean(p.features['free_accountant_seat']);
    }

    return Array.from(grouped.values())
        .map((g) => {
            const refPlan = g.monthlyPlan || g.yearlyPlan;
            const defaultPlanId: SaasPlanId = g.monthlyPlanId ?? g.yearlyPlanId ?? 'free';
            return {
                baseKey: g.baseKey!,
                title: g.title!,
                subtitle: g.subtitle || '',
                isPopular: g.isPopular ?? false,
                monthlyPrice: g.monthlyPrice ?? 0,
                yearlyPrice: g.yearlyPrice ?? 0,
                monthlyPlanId: g.monthlyPlanId ?? defaultPlanId,
                yearlyPlanId: g.yearlyPlanId ?? defaultPlanId,
                annualDiscountPercent: g.annualDiscountPercent ?? 0,
                freeAccountant: g.freeAccountant ?? false,
                features: refPlan ? buildFeatureLabels(refPlan) : [],
                sortOrder: g.sortOrder ?? 0,
            } satisfies GroupedPlan;
        })
        .sort((a, b) => a.sortOrder - b.sortOrder);
}

// ─── Module-level cached fetcher (single request shared across steps) ────────

let cachedPlans: GroupedPlan[] = FALLBACK_PLANS;
let plansPromise: Promise<GroupedPlan[]> | null = null;

function fetchPlans(): Promise<GroupedPlan[]> {
    if (plansPromise) return plansPromise;

    plansPromise = fetch(`${getApiUrl()}/api/saas/plans`, { credentials: 'include' })
        .then(async (res) => {
            if (!res.ok) return FALLBACK_PLANS;
            const data: ApiPlan[] = await res.json();
            if (!data.length) return FALLBACK_PLANS;
            cachedPlans = groupApiPlans(data);
            return cachedPlans;
        })
        .catch(() => FALLBACK_PLANS);

    return plansPromise;
}

export function resolvePlanSummary(planId: SaasPlanId): PlanSummaryInfo {
    const base = resolveBaseKey(planId);
    const plan = cachedPlans.find((p) => p.baseKey === base) ?? FALLBACK_PLANS[0];
    if (plan.baseKey === 'free') {
        return { name: plan.title, priceLabel: 'Gratis · de por vida' };
    }
    const isYearly = planId.endsWith('_yearly');
    const amount = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
    return {
        name: plan.title,
        priceLabel: `${formatPrice(amount)}${isYearly ? '/año' : '/mes'}`,
    };
}

// ─── Component ───────────────────────────────────────────────────────────────

export const PlanSelector: Component<PlanSelectorProps> = (props) => {
    const search = useSearch({ strict: false });
    const urlPlanParam = () => (search() as any)?.plan as string | undefined;

    const [plans] = createResource(fetchPlans);

    const initialParam = urlPlanParam() || props.selectedPlanId;
    const [billingInterval, setBillingInterval] = createSignal<'monthly' | 'yearly'>(
        initialParam?.endsWith('_yearly') ? 'yearly' : 'monthly'
    );

    const resolvedPlans = () => plans() || cachedPlans;

    const handleSelectPlan = (plan: GroupedPlan) => {
        if (plan.baseKey === 'free') {
            props.onPlanChange('free');
        } else {
            props.onPlanChange(billingInterval() === 'yearly' ? plan.yearlyPlanId : plan.monthlyPlanId);
        }
    };

    const handleToggleInterval = (interval: 'monthly' | 'yearly') => {
        setBillingInterval(interval);
        if (props.selectedPlanId === 'free') return;
        const currentBase = resolveBaseKey(props.selectedPlanId);
        const target = resolvedPlans().find((p) => p.baseKey === currentBase);
        if (target) {
            props.onPlanChange(interval === 'yearly' ? target.yearlyPlanId : target.monthlyPlanId);
        }
    };

    const isSelected = (plan: GroupedPlan) => {
        if (plan.baseKey === 'free') return props.selectedPlanId === 'free';
        return props.selectedPlanId === plan.monthlyPlanId || props.selectedPlanId === plan.yearlyPlanId;
    };

    const maxDiscount = createMemo(() =>
        Math.max(...resolvedPlans().map((p) => p.annualDiscountPercent || 0))
    );

    return (
        <div class="@container space-y-5">
            {/* Header & Billing Interval Toggle */}
            <div class="flex flex-col @xl:flex-row @xl:items-end justify-between gap-4">
                <div>
                    <h2 class="text-xl sm:text-2xl font-bold text-heading tracking-tight">
                        Elige el plan para tu empresa
                    </h2>
                    <p class="text-xs sm:text-sm text-muted mt-1">
                        Comienza gratis o activa facturación electrónica y gestión ERP completa.
                    </p>
                </div>

                <div
                    role="group"
                    aria-label="Frecuencia de facturación"
                    class="inline-flex items-center p-1 bg-card-alt rounded-xl border border-border self-start @xl:self-auto shrink-0"
                >
                    <button
                        type="button"
                        onClick={() => handleToggleInterval('monthly')}
                        class={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                            billingInterval() === 'monthly'
                                ? 'bg-card text-heading border-border-strong/70 shadow-xs'
                                : 'text-muted border-transparent hover:text-heading'
                        }`}
                    >
                        Mensual
                    </button>
                    <button
                        type="button"
                        onClick={() => handleToggleInterval('yearly')}
                        class={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 border ${
                            billingInterval() === 'yearly'
                                ? 'bg-card text-heading border-border-strong/70 shadow-xs'
                                : 'text-muted border-transparent hover:text-heading'
                        }`}
                    >
                        <span>Anual</span>
                        <Show when={maxDiscount() > 0}>
                            <span class="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-success/15 text-success border border-success/25 leading-none">
                                -{maxDiscount()}%
                            </span>
                        </Show>
                    </button>
                </div>
            </div>

            {/* Container-Aware 4-Column Pricing Grid */}
            <div
                role="radiogroup"
                aria-label="Planes disponibles"
                class="grid grid-cols-1 @md:grid-cols-2 @4xl:grid-cols-4 gap-3.5 items-stretch pt-2"
            >
                <For each={resolvedPlans()}>
                    {(plan) => {
                        const selected = () => isSelected(plan);
                        const isYearly = () => billingInterval() === 'yearly';
                        const price = () => (isYearly() ? plan.yearlyPrice : plan.monthlyPrice);
                        const periodLabel = () =>
                            plan.baseKey === 'free' ? '' : isYearly() ? '/año' : '/mes';
                        const billingHint = () => {
                            if (plan.baseKey === 'free') return 'Sin tarjeta · de por vida';
                            if (isYearly()) return `$${(plan.yearlyPrice / 12).toFixed(2)}/mes facturado anual`;
                            return plan.annualDiscountPercent > 0
                                ? `Ahorra ${plan.annualDiscountPercent}% en plan anual`
                                : 'Facturación mensual';
                        };

                        return (
                            <button
                                type="button"
                                role="radio"
                                aria-checked={selected()}
                                onClick={() => handleSelectPlan(plan)}
                                class={`group relative flex flex-col text-left p-5 rounded-2xl border transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                                    selected()
                                        ? 'border-primary bg-primary-soft/25 ring-2 ring-primary/25 shadow-lg shadow-primary/5'
                                        : plan.isPopular
                                            ? 'border-primary/40 bg-card-alt/50 hover:border-primary/70 hover:bg-card-alt/80'
                                            : 'border-border bg-card-alt/30 hover:border-border-strong hover:bg-card-alt/60'
                                }`}
                            >
                                {/* Popular badge */}
                                <Show when={plan.isPopular}>
                                    <span class="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary text-white dark:text-slate-950 shadow-sm">
                                        Más popular
                                    </span>
                                </Show>

                                {/* Title + Radio Indicator */}
                                <div class="flex items-start justify-between gap-2">
                                    <div class="min-w-0">
                                        <h3 class="text-base font-bold text-heading leading-snug">
                                            {plan.title}
                                        </h3>
                                        <Show when={plan.subtitle}>
                                            <p class="text-[11px] text-muted mt-0.5 leading-snug">
                                                {plan.subtitle}
                                            </p>
                                        </Show>
                                    </div>
                                    <span
                                        class={`size-4.5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                                            selected()
                                                ? 'border-primary bg-primary text-white dark:text-slate-950'
                                                : 'border-border-strong bg-surface'
                                        }`}
                                    >
                                        <Show when={selected()}>
                                            <svg class="size-2.5" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                            </svg>
                                        </Show>
                                    </span>
                                </div>

                                {/* Price */}
                                <div class="mt-4 pb-3.5 border-b border-border/70">
                                    <div class="flex items-baseline gap-1">
                                        <span class="text-3xl font-extrabold tracking-tight text-heading tabular-nums">
                                            {formatPrice(price())}
                                        </span>
                                        <Show when={periodLabel()}>
                                            <span class="text-xs font-medium text-muted">{periodLabel()}</span>
                                        </Show>
                                    </div>
                                    <p class="text-[11px] text-muted mt-1 leading-tight">
                                        {billingHint()}
                                    </p>
                                </div>

                                {/* Free Accountant Callout */}
                                <Show when={plan.freeAccountant}>
                                    <div class="mt-3 px-2.5 py-1.5 rounded-lg bg-success/10 border border-success/20 text-[11px] font-medium text-success flex items-center gap-1.5 whitespace-nowrap">
                                        <span class="size-1.5 rounded-full bg-success shrink-0" />
                                        <span class="truncate">Asiento de contador gratis</span>
                                    </div>
                                </Show>

                                {/* Features */}
                                <ul class="mt-3.5 space-y-2 text-xs text-text/85 flex-1">
                                    <For each={plan.features}>
                                        {(feat) => (
                                            <li class="flex items-start gap-2">
                                                <svg class="size-3.5 text-success shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4.5 12.75l6 6 9-13.5" />
                                                </svg>
                                                <span class="leading-snug">{feat}</span>
                                            </li>
                                        )}
                                    </For>
                                </ul>

                                {/* Selection Footer Indicator */}
                                <div class="mt-4 pt-3 border-t border-border/60">
                                    <span
                                        class={`block w-full py-1.5 rounded-lg text-xs font-semibold text-center transition-colors ${
                                            selected()
                                                ? 'bg-primary text-white dark:text-slate-950'
                                                : 'bg-surface/80 text-muted border border-border group-hover:text-heading group-hover:border-border-strong'
                                        }`}
                                    >
                                        {selected() ? 'Plan seleccionado' : 'Elegir plan'}
                                    </span>
                                </div>
                            </button>
                        );
                    }}
                </For>
            </div>

            {/* Concise Reassurance Footnote */}
            <p class="text-xs text-muted text-center pt-1">
                ¿Necesitas más usuarios, cajas POS o almacenamiento? Podrás cambiar de plan o añadir complementos en cualquier momento desde Configuración.
            </p>
        </div>
    );
};
