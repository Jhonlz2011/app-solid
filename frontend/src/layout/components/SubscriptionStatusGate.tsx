import { Component, Show, createMemo } from 'solid-js';
import { useQueryClient } from '@tanstack/solid-query';
import { toast } from 'solid-sonner';
import { useAuth, actions as authActions } from '@modules/auth/store/auth.store';
import { useBranding } from '@modules/auth/store/branding.store';
import { useUpgradePlan } from '@modules/saas/data/saas.queries';
import Button from '@form/Button';
import { Badge } from '@display/Badge';
import { SparklesIcon } from '@icons/SparklesIcon';
import { ClockIcon } from '@icons/ClockIcon';
import { LockIcon } from '@icons/LockIcon';
import { AlertTriangleIcon } from '@icons/AlertTriangleIcon';
import { MailIcon } from '@icons/MailIcon';
import { LogoutIcon } from '@icons/LogoutIcon';

const SUPPORT_EMAIL = 'soporte@zelys.app';

function formatShortDate(iso?: string | null): string | null {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat('es-EC', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(date);
}

function getDaysRemaining(iso?: string | null): number | null {
    if (!iso) return null;
    const target = new Date(iso).getTime();
    if (Number.isNaN(target)) return null;
    return Math.max(0, Math.ceil((target - Date.now()) / 86_400_000));
}

/**
 * Compact executive top banner for active TRIAL and GRACE_PERIOD subscriptions.
 * Renders nothing for ACTIVE or blocked states (blocked states render SubscriptionBlockedView).
 */
export const SubscriptionBanner: Component = () => {
    const auth = useAuth();

    const status = () => auth.planStatus();
    const planLabel = () => auth.planName() || auth.plan();
    const trialDaysLeft = createMemo(() => getDaysRemaining(auth.planPeriodEnd()));
    const trialEndLabel = createMemo(() => formatShortDate(auth.planPeriodEnd()));
    const graceEndLabel = createMemo(() => formatShortDate(auth.gracePeriodEndsAt()));

    return (
        <>
            <Show when={status() === 'TRIAL'}>
                <div
                    role="status"
                    class="w-full shrink-0 bg-primary/8 border-b border-primary/20 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="inline-flex items-center justify-center size-5 rounded-full bg-primary/15 text-primary shrink-0">
                            <SparklesIcon class="size-3" />
                        </span>
                        <p class="text-heading truncate">
                            <strong class="font-semibold">Periodo de prueba</strong>
                            <span class="text-muted"> · {planLabel()}</span>
                            <Show when={trialDaysLeft() !== null}>
                                <span class="text-primary font-semibold">
                                    {' · '}
                                    {trialDaysLeft() === 0
                                        ? 'Vence hoy'
                                        : trialDaysLeft() === 1
                                            ? 'Queda 1 día'
                                            : `Quedan ${trialDaysLeft()} días`}
                                </span>
                            </Show>
                            <Show when={trialEndLabel()}>
                                <span class="hidden sm:inline text-muted"> (hasta el {trialEndLabel()})</span>
                            </Show>
                        </p>
                    </div>
                    <a
                        href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Activar suscripción ${planLabel()}`)}`}
                        class="text-xs font-semibold text-primary hover:underline shrink-0"
                    >
                        Activar plan
                    </a>
                </div>
            </Show>

            <Show when={status() === 'GRACE_PERIOD'}>
                <div
                    role="alert"
                    class="w-full shrink-0 bg-amber-500/10 border-b border-amber-500/25 text-amber-800 dark:text-amber-300 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="inline-flex items-center justify-center size-5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                            <ClockIcon class="size-3" />
                        </span>
                        <p class="truncate">
                            <strong class="font-semibold">Periodo de gracia activo</strong>
                            <span>
                                {' — '}
                                Regulariza tu suscripción
                                <Show when={graceEndLabel()}>
                                    {' '}antes del <strong>{graceEndLabel()}</strong>
                                </Show>
                                {' '}para evitar la pausa de módulos.
                            </span>
                        </p>
                    </div>
                    <a
                        href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Regularizar pago — ${planLabel()}`)}`}
                        class="text-xs font-semibold underline hover:opacity-80 shrink-0"
                    >
                        Contactar soporte
                    </a>
                </div>
            </Show>
        </>
    );
};

/**
 * Full-area executive recovery gate shown inside MainLayout when the tenant subscription
 * is PENDING_PAYMENT, PAST_DUE, SUSPENDED, or CANCELLED.
 * Prevents broken blank sidebars and cascading 403s while offering 1-click Freemium recovery.
 */
export const SubscriptionBlockedView: Component = () => {
    const auth = useAuth();
    const branding = useBranding();
    const queryClient = useQueryClient();
    const upgradePlan = useUpgradePlan();

    const status = () => auth.planStatus();
    const companyName = () =>
        branding.tenant()?.tradeName
        || branding.tenant()?.businessName
        || auth.user()?.companySlug
        || 'tu empresa';
    const planLabel = () => auth.planName() || auth.plan();

    const canManageBilling = createMemo(() => {
        if (auth.isAdmin()) return true;
        return Boolean(auth.user()?.permissions?.includes('companies.update'));
    });

    const statusCopy = createMemo(() => {
        switch (status()) {
            case 'PENDING_PAYMENT':
                return {
                    badge: 'Pago pendiente',
                    badgeVariant: 'warning' as const,
                    accentClass: 'bg-amber-500',
                    iconBgClass: 'bg-amber-500/12 text-amber-600 dark:text-amber-400 border-amber-500/20',
                    title: 'Tu suscripción está pendiente de activación',
                    description: `El plan ${planLabel()} de ${companyName()} requiere confirmación de pago para habilitar los módulos operativos.`,
                    isSevere: false,
                };
            case 'PAST_DUE':
                return {
                    badge: 'Pago vencido',
                    badgeVariant: 'danger' as const,
                    accentClass: 'bg-danger',
                    iconBgClass: 'bg-danger/10 text-danger border-danger/20',
                    title: 'Suscripción vencida',
                    description: `El periodo de pago del plan ${planLabel()} de ${companyName()} ha vencido y los módulos se encuentran pausados temporalmente.`,
                    isSevere: true,
                };
            default:
                return {
                    badge: status() === 'CANCELLED' ? 'Cancelada' : 'Suspendida',
                    badgeVariant: 'danger' as const,
                    accentClass: 'bg-danger',
                    iconBgClass: 'bg-danger/10 text-danger border-danger/20',
                    title: 'Acceso a módulos pausado',
                    description: `La suscripción de ${companyName()} no se encuentra activa en este momento.`,
                    isSevere: true,
                };
        }
    });

    const handleSwitchToFreemium = async () => {
        try {
            await upgradePlan.mutateAsync({ planId: 'free' });
            await authActions.refreshSession();
            await queryClient.invalidateQueries();
            toast.success('Plan Freemium activado', {
                description: 'Los módulos base de tu espacio de trabajo están nuevamente disponibles.',
            });
        } catch (err: any) {
            toast.error('No se pudo activar el Plan Freemium', {
                description: err?.message || 'Inténtalo nuevamente o contacta a soporte.',
            });
        }
    };

    const supportMailto = () =>
        `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Regularizar suscripción — ${companyName()} (${planLabel()})`)}`;

    return (
        <div class="h-full w-full overflow-y-auto flex items-center justify-center p-5 sm:p-8 bg-bg">
            <div class="w-full max-w-lg rounded-2xl border border-border bg-card shadow-card overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div class={`h-1 w-full ${statusCopy().accentClass}`} />

                <div class="p-6 sm:p-8 space-y-6">
                    {/* Header */}
                    <div class="flex items-start gap-4">
                        <div class={`size-12 rounded-2xl border flex items-center justify-center shrink-0 ${statusCopy().iconBgClass}`}>
                            <Show when={statusCopy().isSevere} fallback={<LockIcon class="size-5" />}>
                                <AlertTriangleIcon class="size-5" />
                            </Show>
                        </div>
                        <div class="space-y-1.5 min-w-0">
                            <Badge size="sm" variant={statusCopy().badgeVariant}>
                                {statusCopy().badge}
                            </Badge>
                            <h1 class="text-lg sm:text-xl font-bold tracking-tight text-heading">
                                {statusCopy().title}
                            </h1>
                            <p class="text-sm text-muted leading-relaxed">
                                {statusCopy().description}
                            </p>
                        </div>
                    </div>

                    {/* Plan & data safety summary */}
                    <div class="rounded-xl border border-border bg-surface/60 p-4 space-y-2.5 text-xs">
                        <div class="flex items-center justify-between gap-2">
                            <span class="text-muted">Empresa</span>
                            <span class="font-semibold text-heading truncate">{companyName()}</span>
                        </div>
                        <div class="flex items-center justify-between gap-2">
                            <span class="text-muted">Plan actual</span>
                            <span class="font-semibold text-heading truncate">{planLabel()}</span>
                        </div>
                        <div class="pt-2 border-t border-border/70 text-muted leading-relaxed">
                            Tus comprobantes, inventario, usuarios y configuración están completamente seguros e intactos.
                        </div>
                    </div>

                    {/* Actions */}
                    <Show
                        when={canManageBilling()}
                        fallback={
                            <div class="space-y-4">
                                <div class="rounded-xl border border-border bg-surface/40 p-3.5 text-xs text-muted leading-relaxed">
                                    Solicita al propietario o administrador de <strong>{companyName()}</strong> que regularice el pago o cambie al Plan Freemium para restaurar el acceso inmediato.
                                </div>
                                <Button
                                    variant="outline"
                                    class="w-full"
                                    icon={<LogoutIcon class="size-4" />}
                                    onClick={() => void authActions.logout()}
                                >
                                    Cerrar sesión
                                </Button>
                            </div>
                        }
                    >
                        <div class="space-y-3">
                            <Button
                                variant="primary"
                                class="w-full"
                                icon={<SparklesIcon class="size-4" />}
                                loading={upgradePlan.isPending}
                                loadingText="Activando Plan Freemium..."
                                onClick={handleSwitchToFreemium}
                            >
                                Continuar con Plan Gratis (Freemium)
                            </Button>

                            <a
                                href={supportMailto()}
                                class="w-full inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-border bg-surface hover:bg-surface/80 text-sm font-medium text-heading transition-colors"
                            >
                                <MailIcon class="size-4 text-muted" />
                                Coordinar pago con soporte
                            </a>

                            <p class="text-[11px] text-center text-muted">
                                Al cambiar a Freemium recuperas acceso inmediato a los módulos base. Podrás actualizar nuevamente cuando desees.
                            </p>
                        </div>
                    </Show>
                </div>
            </div>
        </div>
    );
};
