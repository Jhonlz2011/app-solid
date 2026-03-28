import { Component, Show, createSignal } from 'solid-js';
import { toast } from 'solid-sonner';
import { copyToClipboard } from '@shared/utils/clipboard';
import { generatePassword } from '@shared/utils/password.utils';
import { TextField } from '@shared/ui/TextField';
import Button from '@shared/ui/Button';
import ConfirmDialog from '@shared/ui/ConfirmDialog';
import { CopyIcon } from '@shared/ui/icons';
import { useAdminResetPassword } from '../data/users.queries';

interface PasswordResetSectionProps {
    userId: number;
    username: string;
}

const PasswordResetSection: Component<PasswordResetSectionProps> = (props) => {
    const [newPassword, setNewPassword] = createSignal('');
    const [showConfirm, setShowConfirm] = createSignal(false);
    const resetMutation = useAdminResetPassword();

    const handleGenerate = () => {
        const pw = generatePassword();
        setNewPassword(pw);
    };

    const handleCopy = async () => {
        const ok = await copyToClipboard(newPassword());
        if (ok) toast.success('Contraseña copiada al portapapeles');
        else toast.error('Error al copiar al portapapeles');
    };

    const handleReset = async () => {
        setShowConfirm(false);
        try {
            await resetMutation.mutateAsync({ userId: props.userId, newPassword: newPassword() });
            toast.success(`Contraseña de "${props.username}" actualizada. Todas sus sesiones fueron cerradas.`);
            setNewPassword('');
        } catch (err: any) {
            toast.error(err?.message || 'Error al restablecer la contraseña');
        }
    };

    const isValid = () => newPassword().length >= 8;

    return (
        <>
            <div class="bg-surface/30 rounded-2xl border border-border/40 overflow-hidden">
                <div class="bg-surface/50 px-5 py-3 border-b border-border/40 font-semibold text-sm text-text flex items-center gap-2">
                    <div class="size-1.5 rounded-full bg-amber-500" />
                    Seguridad
                </div>
                <div class="p-5 space-y-3">
                    <p class="text-xs text-muted leading-relaxed">
                        Restablecer la contraseña cerrará <strong>todas</strong> las sesiones activas del usuario.
                    </p>
                    <div class="flex gap-2">
                        <div class="flex-1 relative">
                            <TextField.Root value={newPassword()} onChange={setNewPassword}>
                                <TextField.PasswordInput
                                    placeholder="Nueva contraseña (mín. 8 caracteres)"
                                    class="font-mono text-sm"
                                />
                            </TextField.Root>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleGenerate} title="Generar contraseña">
                            Generar
                        </Button>
                        <Show when={newPassword()}>
                            <Button variant="outline" size="sm" onClick={handleCopy} title="Copiar">
                                <CopyIcon class="size-4" />
                            </Button>
                        </Show>
                    </div>
                    <Button
                        variant="warning"
                        size="sm"
                        disabled={!isValid() || resetMutation.isPending}
                        loading={resetMutation.isPending}
                        loadingText="Restableciendo..."
                        onClick={() => setShowConfirm(true)}
                        class="w-full"
                    >
                        Restablecer contraseña
                    </Button>
                </div>
            </div>

            <ConfirmDialog
                isOpen={showConfirm()}
                onClose={() => setShowConfirm(false)}
                onConfirm={handleReset}
                title="¿Restablecer contraseña?"
                description={`La contraseña de "${props.username}" será cambiada y todas sus sesiones activas serán cerradas inmediatamente.`}
                confirmLabel="Restablecer"
                variant="warning"
                isLoading={resetMutation.isPending}
                loadingText="Restableciendo..."
            />
        </>
    );
};

export default PasswordResetSection;
