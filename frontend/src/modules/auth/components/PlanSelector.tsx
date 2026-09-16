import { Component, createSignal, For, Show, createEffect } from 'solid-js';
import { useSearch } from '@tanstack/solid-router';
import { Badge } from '@display/Badge';

export interface PlanSelectorProps {
    selectedPlanId: string;
    onPlanChange: (planId: string) => void;
    compact?: boolean;
}

interface PlanOption {
    baseKey: string;
    name: string;
    badge?: string;
    isPopular?: boolean;
    monthlyPrice: number;
    yearlyPrice: number;
    monthlyPlanId: string;
    yearlyPlanId: string;
    features: string[];
    freeAccountant: boolean;
}

const PLANS: PlanOption[] = [
    {
        baseKey: 'free',
        name: 'Freemium',
        monthlyPrice: 0,
        yearlyPrice: 0,
        monthlyPlanId: 'free',
        yearlyPlanId: 'free',
        freeAccountant: false,
        features: [
            '1 Usuario Operativo',
            '15 Facturas SRI / mes',
            '1 GB Almacenamiento',
            'Catálogo y Facturación Básica',
        ],
    },
    {
        baseKey: 'starter',
        name: 'Emprendedor',
        monthlyPrice: 9.99,
        yearlyPrice: 95.90,
        monthlyPlanId: 'starter_monthly',
        yearlyPlanId: 'starter_yearly',
        freeAccountant: true,
        features: [
            '2 Usuarios Operativos',
            '✨ 1 Contador Externo GRATIS',
            '250 Facturas SRI / mes',
            '1 Terminal de Caja POS',
            '5 GB Almacenamiento',
            'Inventario y Compras',
        ],
    },
    {
        baseKey: 'pro',
        name: 'Pro',
        badge: 'Más Popular',
        isPopular: true,
        monthlyPrice: 34.99,
        yearlyPrice: 335.90,
        monthlyPlanId: 'pro_monthly',
        yearlyPlanId: 'pro_yearly',
        freeAccountant: true,
        features: [
            '5 Usuarios Operativos',
            '✨ 1 Contador Externo GRATIS',
            'Comprobantes SRI ILIMITADOS',
            '2 Cajas POS Simultáneas',
            'Contabilidad NIIF y Retenciones',
            'Cuentas por Cobrar y Pagar',
            '20 GB Almacenamiento',
        ],
    },
    {
        baseKey: 'enterprise',
        name: 'Corporativo',
        monthlyPrice: 89.99,
        yearlyPrice: 863.90,
        monthlyPlanId: 'enterprise_monthly',
        yearlyPlanId: 'enterprise_yearly',
        freeAccountant: true,
        features: [
            '15 Usuarios Operativos',
            '✨ 1 Contador Externo GRATIS',
            'Comprobantes SRI ILIMITADOS',
            'Manufactura y Órdenes de Trabajo',
            'Nómina y Gestión de Empleados',
            '5 Cajas POS',
            '50 GB Almacenamiento',
        ],
    },
];

export const PlanSelector: Component<PlanSelectorProps> = (props) => {
    const search = useSearch({ strict: false });
    const urlPlanParam = (search() as any)?.plan as string | undefined;

    // Detect if initial plan is yearly
    const [billingInterval, setBillingInterval] = createSignal<'monthly' | 'yearly'>('monthly');

    // Auto-select from URL if provided
    createEffect(() => {
        const param = urlPlanParam || props.selectedPlanId;
        if (param) {
            if (param.endsWith('_yearly')) {
                setBillingInterval('yearly');
                props.onPlanChange(param);
            } else if (param.endsWith('_monthly') || param === 'free') {
                setBillingInterval('monthly');
                props.onPlanChange(param);
            }
        }
    });

    const handleSelectPlan = (plan: PlanOption) => {
        if (plan.baseKey === 'free') {
            props.onPlanChange('free');
        } else {
            props.onPlanChange(billingInterval() === 'yearly' ? plan.yearlyPlanId : plan.monthlyPlanId);
        }
    };

    const handleToggleInterval = (interval: 'monthly' | 'yearly') => {
        setBillingInterval(interval);
        // Map current selected plan to new interval
        const current = props.selectedPlanId;
        if (current === 'free') return;
        const currentBase = current.replace('_monthly', '').replace('_yearly', '');
        const target = PLANS.find(p => p.baseKey === currentBase);
        if (target) {
            props.onPlanChange(interval === 'yearly' ? target.yearlyPlanId : target.monthlyPlanId);
        }
    };

    const isSelected = (plan: PlanOption) => {
        if (plan.baseKey === 'free') return props.selectedPlanId === 'free';
        return props.selectedPlanId === plan.monthlyPlanId || props.selectedPlanId === plan.yearlyPlanId;
    };

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
                        <span class="px-1.5 py-0.2 text-[10px] font-bold uppercase rounded bg-emerald-500 text-white">
                            -20%
                        </span>
                    </button>
                </div>
            </div>

            {/* Plan Cards Grid */}
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <For each={PLANS}>
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
                                <Show when={plan.badge}>
                                    <div class="absolute -top-2.5 right-3">
                                        <span class="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-linear-to-r from-primary to-indigo-600 text-white shadow-xs">
                                            {plan.badge}
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
        </div>
    );
};
