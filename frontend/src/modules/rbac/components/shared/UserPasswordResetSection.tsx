import { Component, Show, createSignal } from 'solid-js';
import Button from '@form/Button';
import ConfirmDialog from '@overlay/ConfirmDialog';
import { KeyIcon } from '@icons/KeyIcon';
import { toast } from 'solid-sonner';
import { useAdminResetPassword } from '../../data/users.mutations';

export interface UserPasswordResetSectionProps {
    disabled?: boolean;
    userId?: string;
    username?: string;
}

/**
 * Tenant administrators can only request Better Auth's recovery flow. A
 * password is never generated, displayed, copied, or written by the tenant.
 */
export const UserPasswordResetSection: Component<UserPasswordResetSectionProps> = (props) => {
    const [showConfirm, setShowConfirm] = createSignal(false);
    const resetMutation = useAdminResetPassword();

    const handleResetRequest = async () => {
        if (!props.userId || !props.username) return;
        setShowConfirm(false);
        try {
            await resetMutation.mutateAsync({ userId: props.userId });
            toast.success(`Se envió un enlace de recuperación a "${props.username}".`);
        } catch (err: any) {
            toast.error(err?.message || 'Error al solicitar la recuperación de contraseña');
        }
    };

    return (
        <Show when={props.userId && props.username}>
            <button
                type="button"
                onClick={() => setShowConfirm(true)}
                disabled={props.disabled || resetMutation.isPending}
                class="flex items-center gap-3 w-full p-3.5 rounded-xl bg-surface/40 border border-border/40 hover:bg-surface/60 hover:border-border transition-all text-left cursor-pointer group disabled:opacity-50"
            >
                <div class="size-9 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/15 transition-colors shrink-0">
                    <KeyIcon class="size-4.5 text-amber-500" />
                </div>
                <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium text-text">Enviar recuperación de contraseña</p>
                    <p class="text-xs text-muted truncate">Revoca sesiones y envía un enlace de un solo uso</p>
                </div>
                <Button variant="outline" size="sm" loading={resetMutation.isPending} loadingText="Enviando...">
                    Solicitar
                </Button>
            </button>

            <ConfirmDialog
                isOpen={showConfirm()}
                onClose={() => setShowConfirm(false)}
                onConfirm={handleResetRequest}
                title="¿Enviar recuperación de contraseña?"
                description={`Se revocarán las sesiones activas de "${props.username}" y se enviará un enlace de un solo uso a su correo.`}
                confirmLabel="Enviar enlace"
                variant="warning"
                isLoading={resetMutation.isPending}
                loadingText="Enviando..."
            />
        </Show>
    );
};
