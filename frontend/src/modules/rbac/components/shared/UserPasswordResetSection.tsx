import { Component, Show, createSignal } from 'solid-js';
import { TextField, FieldLabel } from '@form/TextField';
import Button from '@form/Button';
import ConfirmDialog from '@overlay/ConfirmDialog';
import { CopyIcon } from '@icons/CopyIcon';
import { KeyIcon } from '@icons/KeyIcon';
import { copyToClipboard } from '@shared/utils/clipboard';
import { toast } from 'solid-sonner';
import { generatePassword } from '@shared/utils/password.utils';
import { useAdminResetPassword } from '../../data/users.mutations';

export interface UserPasswordResetSectionProps {
    /** Form-controlled mode props */
    newPassword?: () => string;
    onPasswordChange?: (password: string) => void;
    disabled?: boolean;

    /** Direct action mode props (for UserShowPanel) */
    userId?: string;
    username?: string;
}

export const UserPasswordResetSection: Component<UserPasswordResetSectionProps> = (props) => {
    const isStandalone = () => Boolean(props.userId && props.username);
    const [isOpen, setIsOpen] = createSignal(false);
    const [localPassword, setLocalPassword] = createSignal('');
    const [showConfirm, setShowConfirm] = createSignal(false);
    const resetMutation = useAdminResetPassword();

    const currentPassword = () => props.newPassword ? props.newPassword() : localPassword();

    const handlePasswordChange = (val: string) => {
        if (props.onPasswordChange) {
            props.onPasswordChange(val);
        } else {
            setLocalPassword(val);
        }
    };

    const handleGeneratePassword = () => {
        const pw = generatePassword();
        handlePasswordChange(pw);
    };

    const handleCopyPassword = async () => {
        const ok = await copyToClipboard(currentPassword());
        if (ok) toast.success('Contraseña copiada al portapapeles');
        else toast.error('Error al copiar al portapapeles');
    };

    const handleCancel = () => {
        setIsOpen(false);
        handlePasswordChange('');
    };

    const handleDirectReset = async () => {
        if (!props.userId || !props.username) return;
        setShowConfirm(false);
        try {
            await resetMutation.mutateAsync({
                userId: props.userId,
                newPassword: currentPassword(),
            });
            toast.success(`Contraseña de "${props.username}" actualizada. Todas sus sesiones fueron cerradas.`);
            handleCancel();
        } catch (err: any) {
            toast.error(err?.message || 'Error al restablecer la contraseña');
        }
    };

    const isValid = () => currentPassword().length >= 8;

    return (
        <div class="space-y-2">
            <Show
                when={isOpen()}
                fallback={
                    <button
                        type="button"
                        onClick={() => setIsOpen(true)}
                        class="flex items-center gap-3 w-full p-3.5 rounded-xl bg-surface/40 border border-border/40 hover:bg-surface/60 hover:border-border transition-all text-left cursor-pointer group"
                    >
                        <div class="size-9 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/15 transition-colors shrink-0">
                            <KeyIcon class="size-4.5 text-amber-500" />
                        </div>
                        <div class="min-w-0 flex-1">
                            <p class="text-sm font-medium text-text">Restablecer contraseña</p>
                            <p class="text-xs text-muted truncate">Cerrará todas las sesiones activas del usuario</p>
                        </div>
                    </button>
                }
            >
                <div class="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-3">
                    <p class="text-xs text-muted leading-relaxed">
                        Restablecer la contraseña cerrará <strong>todas</strong> las sesiones activas del usuario.
                    </p>
                    <div class="flex gap-2">
                        <div class="flex-1 relative">
                            <TextField.Root value={currentPassword()} onChange={handlePasswordChange}>
                                <TextField.PasswordInput
                                    placeholder="Nueva contraseña (mín. 8 caracteres)"
                                    class="w-full text-sm font-mono bg-card"
                                    disabled={props.disabled || resetMutation.isPending}
                                    minLength={8}
                                />
                            </TextField.Root>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleGeneratePassword} title="Generar contraseña segura">
                            Generar
                        </Button>
                        <Show when={currentPassword()}>
                            <Button variant="outline" size="sm" onClick={handleCopyPassword} title="Copiar contraseña">
                                <CopyIcon class="size-4" />
                            </Button>
                        </Show>
                    </div>

                    <Show when={currentPassword().length > 0 && currentPassword().length < 8}>
                        <p class="text-xs text-danger font-medium" role="alert">
                            La contraseña debe tener al menos 8 caracteres
                        </p>
                    </Show>

                    {/* In direct action mode (UserShowPanel), show explicit execute button */}
                    <Show when={isStandalone()}>
                        <Button
                            variant="warning"
                            size="sm"
                            disabled={!isValid() || resetMutation.isPending}
                            loading={resetMutation.isPending}
                            loadingText="Restableciendo..."
                            onClick={() => setShowConfirm(true)}
                            class="w-full mt-2"
                        >
                            Confirmar y Restablecer
                        </Button>
                    </Show>

                    <div class="flex justify-end pt-1">
                        <button
                            type="button"
                            onClick={handleCancel}
                            class="text-xs text-muted hover:text-text transition-colors cursor-pointer"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            </Show>

            {/* Direct action confirmation dialog */}
            <Show when={isStandalone()}>
                <ConfirmDialog
                    isOpen={showConfirm()}
                    onClose={() => setShowConfirm(false)}
                    onConfirm={handleDirectReset}
                    title="¿Restablecer contraseña?"
                    description={`La contraseña de "${props.username}" será cambiada y todas sus sesiones activas serán cerradas inmediatamente.`}
                    confirmLabel="Restablecer"
                    variant="warning"
                    isLoading={resetMutation.isPending}
                    loadingText="Restableciendo..."
                />
            </Show>
        </div>
    );
};
