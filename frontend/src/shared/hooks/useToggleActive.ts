/**
 * useToggleActive<T> — Extracts the repeated deactivate/restore toggle pattern
 * used across all settings list components.
 *
 * Usage:
 *   const handleToggle = useToggleActive({
 *       deactivate: useDeactivateBrand(),
 *       restore: useRestoreBrand(),
 *       getName: (item) => item.name,
 *   });
 *
 *   <SettingsTable onToggleActive={handleToggle} ... />
 */
import { toast } from 'solid-sonner';

interface ToggleActiveConfig<T extends { id: number; is_active?: boolean | null }> {
    /** Deactivate mutation (from createMutation) */
    deactivate: { mutate: (id: number, opts?: any) => void };
    /** Restore mutation (from createMutation) */
    restore: { mutate: (id: number, opts?: any) => void };
    /** Extract display name for toast messages */
    getName: (item: T) => string;
    /** Custom success message (optional) */
    successMsg?: (name: string, wasActive: boolean) => string;
}

export function useToggleActive<T extends { id: number; is_active?: boolean | null }>(
    config: ToggleActiveConfig<T>,
) {
    return (item: T) => {
        const isActive = item.is_active ?? true;
        const mutation = isActive ? config.deactivate : config.restore;
        const name = config.getName(item);

        mutation.mutate(item.id, {
            onSuccess: () => {
                const msg = config.successMsg
                    ? config.successMsg(name, isActive)
                    : `"${name}" ${isActive ? 'desactivada' : 'restaurada'}`;
                toast.success(msg);
            },
            onError: (err: any) => toast.error(err.message || 'Error'),
        });
    };
}
