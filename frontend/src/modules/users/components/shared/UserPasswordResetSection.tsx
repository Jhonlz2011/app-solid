import { Component, Show, createSignal } from 'solid-js';
import { TextField } from '@form/TextField';
import Button from '@form/Button';
import { CopyIcon } from '@icons/CopyIcon';
import { KeyIcon } from '@icons/KeyIcon';
import { copyToClipboard } from '@shared/utils/clipboard';
import { toast } from 'solid-sonner';
import { generatePassword } from '@shared/utils/password.utils';

export interface UserPasswordResetSectionProps {
    newPassword: () => string;
    onPasswordChange: (password: string) => void;
    disabled?: boolean;
}

export const UserPasswordResetSection: Component<UserPasswordResetSectionProps> = (props) => {
    const [isOpen, setIsOpen] = createSignal(false);

    const handleGeneratePassword = () => {
        const pw = generatePassword();
        props.onPasswordChange(pw);
    };

    const handleCopyPassword = async () => {
        const ok = await copyToClipboard(props.newPassword());
        if (ok) toast.success('Contraseña copiada al portapapeles');
        else toast.error('Error al copiar al portapapeles');
    };

    const handleCancel = () => {
        setIsOpen(false);
        props.onPasswordChange('');
    };

    return (
        <div class="space-y-3">
            <div class="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-2">
                <div class="size-1.5 rounded-full bg-amber-500" />
                Cambiar contraseña
            </div>

            <Show
                when={isOpen()}
                fallback={
                    <button
                        type="button"
                        onClick={() => setIsOpen(true)}
                        class="flex items-center gap-2 w-full p-3 rounded-xl bg-surface/40 border border-border/40 hover:bg-surface/60 hover:border-border transition-all text-left cursor-pointer group"
                    >
                        <div class="size-8 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/15 transition-colors">
                            <KeyIcon class="size-4 text-amber-600" />
                        </div>
                        <div>
                            <p class="text-sm font-medium text-text">Restablecer contraseña</p>
                            <p class="text-xs text-muted">Cerrará todas las sesiones activas del usuario</p>
                        </div>
                    </button>
                }
            >
                <div class="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-3">
                    <p class="text-xs text-muted leading-relaxed">
                        La nueva contraseña cerrará <strong>todas</strong> las sesiones activas del usuario.
                    </p>
                    <div class="flex gap-2">
                        <div class="flex-1 relative">
                            <TextField.Root value={props.newPassword()} onChange={props.onPasswordChange}>
                                <TextField.PasswordInput
                                    placeholder="Nueva contraseña (mín. 8 caracteres)"
                                    class="w-full text-sm font-mono bg-card"
                                    disabled={props.disabled}
                                    minLength={8}
                                />
                            </TextField.Root>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleGeneratePassword} title="Generar contraseña segura">
                            Generar
                        </Button>
                        <Show when={props.newPassword()}>
                            <Button variant="outline" size="sm" onClick={handleCopyPassword} title="Copiar contraseña">
                                <CopyIcon class="size-4" />
                            </Button>
                        </Show>
                    </div>
                    <Show when={props.newPassword().length > 0 && props.newPassword().length < 8}>
                        <p class="text-xs text-danger font-medium" role="alert">
                            La contraseña debe tener al menos 8 caracteres
                        </p>
                    </Show>
                    <div class="flex justify-end">
                        <button
                            type="button"
                            onClick={handleCancel}
                            class="text-xs text-muted hover:text-text transition-colors cursor-pointer"
                        >
                            Cancelar cambio
                        </button>
                    </div>
                </div>
            </Show>
        </div>
    );
};
