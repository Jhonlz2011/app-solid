import { Component, Show, createSignal } from 'solid-js';
import { Outlet, useSearch } from '@tanstack/solid-router';
import { toast } from 'solid-sonner';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { copyToClipboard } from '@shared/utils/clipboard';
import type { UserCreateData } from '@app/schema/frontend';
import Sheet from '@overlay/Sheet';
import Button from '@form/Button';
import { Badge } from '@display/Badge';
import { KeyIcon } from '@icons/KeyIcon';
import { MailIcon } from '@icons/MailIcon';
import { CopyIcon } from '@icons/CopyIcon';
import { CheckIcon } from '@icons/CheckIcon';
import { AlertTriangleIcon } from '@icons/AlertTriangleIcon';
import { PlusIcon } from '@icons/PlusIcon';
import { useRoles } from '../data/users.queries';
import { useCreateUser } from '../data/users.mutations';
import { useTenantSubscription } from '@modules/saas/data/saas.queries';
import { UserCreateForm, type UserCreateFormState } from './UserCreateForm';

interface UserNewSheetProps {
    onClose?: () => void;
}

interface CreatedUserSummary {
    mode: 'invite' | 'direct';
    email: string;
    username: string;
    temporaryPassword?: string;
    requirePasswordChange?: boolean;
    sendEmailRequested?: boolean;
    emailSent: boolean;
    emailError?: string;
    inviteUrl?: string;
    loginUrl: string;
}

const UserNewSheet: Component<UserNewSheetProps> = (props) => {
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    const search = useSearch({ strict: false });
    const initialRoleName = () => (search() as any)?.role as string | undefined;
    const createMutation = useCreateUser();
    const rolesQuery = useRoles();
    const subscriptionQuery = useTenantSubscription();

    const [createdSummary, setCreatedSummary] = createSignal<CreatedUserSummary | null>(null);
    const [copiedKey, setCopiedKey] = createSignal<string | null>(null);
    const [formState, setFormState] = createSignal<UserCreateFormState>({
        mode: 'invite',
        isExistingUser: false,
        isAlreadyMember: false,
        canSubmit: true,
    });

    const isInviteFlow = () => formState().isExistingUser || formState().mode === 'invite';
    const submitButtonLabel = () => (isInviteFlow() ? 'Invitar' : 'Crear acceso');
    const submitButtonIcon = () => (isInviteFlow() ? <MailIcon class="size-4" /> : <KeyIcon class="size-4" />);
    const submitLoadingText = () => (isInviteFlow() ? 'Enviando...' : 'Creando acceso...');

    const handleCloseClean = () => {
        setCreatedSummary(null);
        close();
    };

    const handleNavigateAwayClean = () => {
        setCreatedSummary(null);
        navigateAway();
    };

    const handleCopy = async (key: string, text: string, successMsg: string) => {
        const ok = await copyToClipboard(text);
        if (ok) {
            setCopiedKey(key);
            toast.success(successMsg);
            setTimeout(() => {
                if (copiedKey() === key) setCopiedKey(null);
            }, 2500);
        } else {
            toast.error('No se pudo copiar al portapapeles');
        }
    };

    const handleSubmit = async (values: UserCreateData) => {
        const result = await createMutation.mutateAsync(values);
        const fallbackLoginUrl = typeof window !== 'undefined' ? `${window.location.origin}/login` : '/login';

        setCreatedSummary({
            mode: result.mode,
            email: result.email,
            username: result.username,
            temporaryPassword: result.mode === 'direct' ? values.temporaryPassword : undefined,
            requirePasswordChange: result.mode === 'direct' ? (values.mustChangePassword ?? true) : false,
            sendEmailRequested: values.sendEmail ?? (result.mode === 'invite'),
            emailSent: result.emailSent,
            emailError: result.emailError,
            inviteUrl: result.inviteUrl,
            loginUrl: result.loginUrl || fallbackLoginUrl,
        });

        if (result.mode === 'direct') {
            toast.success(`Acceso creado para "${result.username}"`);
        } else if (result.emailSent) {
            toast.success(`Invitación enviada a "${result.email}"`);
        } else {
            toast.warning('Usuario invitado. El correo no pudo enviarse; puedes copiar el enlace ahora.');
        }
    };

    const isPending = () => createMutation.isPending;

    const buildFullCredentialsText = (summary: CreatedUserSummary) => {
        const lines = [
            'Tus credenciales de acceso a Zelys:',
            `Acceso: ${summary.loginUrl}`,
            `Correo: ${summary.email}`,
            `Usuario: ${summary.username}`,
            `Contraseña temporal: ${summary.temporaryPassword ?? ''}`,
        ];
        if (summary.requirePasswordChange) {
            lines.push('Al iniciar sesión el sistema te pedirá definir tu nueva contraseña personal.');
        }
        return lines.join('\n');
    };

    return (
        <Sheet
            bindDismiss={bindDismiss}
            isOpen={true}
            onClose={handleNavigateAwayClean}
            title={createdSummary() ? (createdSummary()!.mode === 'direct' ? 'Acceso creado' : 'Invitación generada') : 'Crear usuario'}
            description={
                createdSummary()
                    ? 'Guarda o comparte esta información antes de cerrar la ventana'
                    : 'Invita o crea un colaborador con acceso inmediato a tu empresa'
            }
            size="lg"
            footer={
                <Show
                    when={createdSummary()}
                    fallback={
                        <>
                            <Button variant="outline" onClick={handleCloseClean} disabled={isPending()}>
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                form="user-create-form"
                                loading={isPending()}
                                loadingText={submitLoadingText()}
                                icon={submitButtonIcon()}
                                disabled={isPending() || formState().isAlreadyMember}
                            >
                                {submitButtonLabel()}
                            </Button>
                        </>
                    }
                >
                    <Button
                        variant="outline"
                        icon={<PlusIcon class="size-4" />}
                        onClick={() => setCreatedSummary(null)}
                    >
                        Crear otro usuario
                    </Button>
                    <Button variant="primary" onClick={handleCloseClean}>
                        Listo
                    </Button>
                </Show>
            }
        >
            <Show
                when={createdSummary()}
                keyed
                fallback={
                    <UserCreateForm
                        formId="user-create-form"
                        roles={rolesQuery.data ?? []}
                        rolesLoading={rolesQuery.isPending}
                        initialRoleName={initialRoleName()}
                        hasFreeAccountantSeat={Boolean(subscriptionQuery.data?.users.hasFreeAccountantSeat)}
                        freeAccountantSeatAvailable={Boolean(
                            subscriptionQuery.data?.users.hasFreeAccountantSeat
                            && !subscriptionQuery.data?.users.accountantAssigned
                        )}
                        onSubmit={handleSubmit}
                        isSubmitting={isPending()}
                        onStateChange={setFormState}
                    />
                }
            >
                {(summary) => (
                    <div class="py-4 space-y-5 animate-in fade-in duration-200">
                        {/* Mode DIRECT: One-time credentials card */}
                        <Show when={summary.mode === 'direct'}>
                            <div class="rounded-2xl border border-emerald-500/25 bg-emerald-500/8 p-4 flex items-start gap-3">
                                <div class="size-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                    <CheckIcon class="size-5" />
                                </div>
                                <div class="space-y-1 min-w-0">
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <h3 class="text-sm font-bold text-heading">Cuenta activa lista para ingresar</h3>
                                        <Badge size="sm" variant="success">Acceso inmediato</Badge>
                                    </div>
                                    <p class="text-xs text-muted leading-relaxed">
                                        Esta es la única vez que se mostrará la contraseña temporal. Cópiala ahora y entrégala al colaborador.
                                    </p>
                                </div>
                            </div>

                            <div class="rounded-2xl border border-border bg-surface/50 p-4 space-y-3 text-sm">
                                <div class="flex items-center justify-between gap-2">
                                    <span class="text-xs text-muted">Enlace de ingreso</span>
                                    <span class="font-mono text-xs text-text truncate">{summary.loginUrl}</span>
                                </div>
                                <div class="flex items-center justify-between gap-2">
                                    <span class="text-xs text-muted">Correo</span>
                                    <span class="font-medium text-text truncate">{summary.email}</span>
                                </div>
                                <div class="flex items-center justify-between gap-2">
                                    <span class="text-xs text-muted">Usuario</span>
                                    <span class="font-mono font-medium text-text">{summary.username}</span>
                                </div>
                                <div class="pt-2.5 border-t border-border/70 flex items-center justify-between gap-2">
                                    <div class="min-w-0">
                                        <span class="text-xs text-muted block">Contraseña temporal</span>
                                        <code class="text-sm font-bold text-primary font-mono select-all">
                                            {summary.temporaryPassword}
                                        </code>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleCopy('pwd', summary.temporaryPassword ?? '', 'Contraseña copiada')}
                                    >
                                        <Show when={copiedKey() === 'pwd'} fallback={<CopyIcon class="size-4" />}>
                                            <CheckIcon class="size-4 text-emerald-500" />
                                        </Show>
                                        Copiar
                                    </Button>
                                </div>
                            </div>

                            <Show when={summary.requirePasswordChange}>
                                <div class="rounded-xl border border-info/20 bg-info/8 px-3.5 py-2.5 text-xs text-muted">
                                    Al iniciar sesión por primera vez, el sistema bloqueará los módulos hasta que el usuario cambie esta contraseña temporal por una personal.
                                </div>
                            </Show>

                            <Show when={summary.sendEmailRequested}>
                                <div
                                    class={`rounded-xl border px-3.5 py-2.5 text-xs flex items-center gap-2 ${
                                        summary.emailSent
                                            ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300'
                                            : 'border-amber-500/25 bg-amber-500/8 text-amber-800 dark:text-amber-300'
                                    }`}
                                >
                                    <Show when={summary.emailSent} fallback={<AlertTriangleIcon class="size-4 shrink-0" />}>
                                        <MailIcon class="size-4 shrink-0" />
                                    </Show>
                                    <span>
                                        {summary.emailSent
                                            ? `Se envió un aviso informativo a ${summary.email}.`
                                            : `No se pudo enviar el correo de aviso (${summary.emailError || 'error SMTP'}). El usuario igual puede ingresar con estas credenciales.`}
                                    </span>
                                </div>
                            </Show>

                            <Button
                                type="button"
                                variant="primary"
                                class="w-full"
                                icon={copiedKey() === 'full' ? <CheckIcon class="size-4" /> : <CopyIcon class="size-4" />}
                                onClick={() => handleCopy('full', buildFullCredentialsText(summary), 'Credenciales completas copiadas')}
                            >
                                {copiedKey() === 'full' ? 'Credenciales copiadas' : 'Copiar credenciales completas'}
                            </Button>
                        </Show>

                        {/* Mode INVITE: Real email delivery status + copyable activation URL */}
                        <Show when={summary.mode === 'invite'}>
                            <Show
                                when={summary.emailSent}
                                fallback={
                                    <div class="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
                                        <div class="size-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                            <AlertTriangleIcon class="size-5" />
                                        </div>
                                        <div class="space-y-1 min-w-0">
                                            <h3 class="text-sm font-bold text-heading">
                                                {summary.sendEmailRequested ? 'No se pudo entregar el correo' : 'Enlace listo para compartir'}
                                            </h3>
                                            <p class="text-xs text-muted leading-relaxed">
                                                {summary.sendEmailRequested
                                                    ? `La invitación para ${summary.email} se creó correctamente, pero el servidor de correo respondió: ${summary.emailError || 'no disponible'}. Comparte el enlace manualmente.`
                                                    : `La invitación para ${summary.email} está lista. Comparte el enlace de activación directamente por WhatsApp o chat interno.`}
                                            </p>
                                        </div>
                                    </div>
                                }
                            >
                                <div class="rounded-2xl border border-emerald-500/25 bg-emerald-500/8 p-4 flex items-start gap-3">
                                    <div class="size-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                        <MailIcon class="size-5" />
                                    </div>
                                    <div class="space-y-1 min-w-0">
                                        <h3 class="text-sm font-bold text-heading">Correo de invitación enviado</h3>
                                        <p class="text-xs text-muted leading-relaxed">
                                            Se envió un enlace de activación a <strong class="text-heading">{summary.email}</strong> (válido por 72 horas). Si lo prefieres, también puedes copiar el enlace abajo.
                                        </p>
                                    </div>
                                </div>
                            </Show>

                            <Show when={summary.inviteUrl}>
                                {(url) => (
                                    <div class="rounded-2xl border border-border bg-surface/50 p-4 space-y-3">
                                        <div class="flex items-center justify-between gap-2">
                                            <span class="text-xs font-medium text-muted">Enlace de activación único (72h)</span>
                                            <Badge size="sm" variant="warning">Invitación pendiente</Badge>
                                        </div>
                                        <div class="p-2.5 rounded-xl bg-card border border-border font-mono text-xs text-text break-all select-all">
                                            {url()}
                                        </div>
                                        <Button
                                            type="button"
                                            variant="primary"
                                            class="w-full"
                                            icon={copiedKey() === 'invite' ? <CheckIcon class="size-4" /> : <CopyIcon class="size-4" />}
                                            onClick={() => handleCopy('invite', url(), 'Enlace de activación copiado')}
                                        >
                                            {copiedKey() === 'invite' ? 'Enlace copiado' : 'Copiar enlace de activación'}
                                        </Button>
                                    </div>
                                )}
                            </Show>
                        </Show>
                    </div>
                )}
            </Show>

            {/* Nested role creation dialogs render here */}
            <Outlet />
        </Sheet>
    );
};

export default UserNewSheet;
