// Profile Page - My Account View (Optimized for 0ms UX)
import { Component, createSignal, Show, onMount, onCleanup } from 'solid-js';
import { useQueryClient } from '@tanstack/solid-query';
import { toast } from 'solid-sonner';
import { actions as authActions } from '@modules/auth/auth.store';
import { useProfile, useUpdateProfile, useChangePassword, profileKeys } from '../data/profile.api';
import { ProfileHeader } from '../components/ProfileHeader';
import { AccountSection } from '../components/AccountSection';
import { SecuritySection } from '../components/SecuritySection';
import { SessionsSection } from '../components/SessionsSection';
import { UserIcon, ShieldIcon, DeviceIcon } from '@shared/components/icons';
import { broadcast, BroadcastEvents } from '@shared/store/broadcast.store';

type TabId = 'account' | 'security' | 'sessions';

const ProfilePage: Component = () => {
    const [activeTab, setActiveTab] = createSignal<TabId>('account');
    const queryClient = useQueryClient();

    const profileQuery = useProfile();
    const updateProfileMutation = useUpdateProfile();
    const changePasswordMutation = useChangePassword();

    // Listen for profile updates from other tabs (via centralized broadcast store)
    onMount(() => {
        const cleanup = broadcast.on(BroadcastEvents.PROFILE_UPDATE, () => {
            console.log('[ProfilePage] Received PROFILE_UPDATE, invalidating query');
            queryClient.invalidateQueries({ queryKey: profileKeys.me() });
        });

        onCleanup(cleanup);
    });

    // Prefetch sessions data on hover for instant data availability
    const handleTabHover = (tabId: TabId) => {
        if (tabId === 'sessions') {
            queryClient.prefetchQuery({
                queryKey: ['auth', 'sessions'],
                staleTime: 30 * 1000,
            });
        }
    };

    const handleUpdateProfile = async (data: { username?: string; email?: string }) => {
        try {
            const result = await updateProfileMutation.mutateAsync(data);
            if (result.success) {
                // 1. Invalidate profile query for fresh data
                queryClient.invalidateQueries({ queryKey: profileKeys.me() });

                // 2. Update auth store immediately for sidebar reactivity + broadcast to other tabs
                authActions.updateUser(data);

                toast.success('Perfil actualizado correctamente');
            }
        } catch (error: any) {
            toast.error(error?.message || 'Error al actualizar el perfil');
            throw error;
        }
    };

    const handleChangePassword = async (data: { currentPassword: string; newPassword: string }) => {
        try {
            await changePasswordMutation.mutateAsync(data);
            toast.success('Contraseña cambiada correctamente. Debes iniciar sesión de nuevo.');
        } catch (error: any) {
            toast.error(error?.message || 'Error al cambiar la contraseña');
            throw error;
        }
    };

    const tabs = [
        { id: 'account' as const, label: 'Cuenta', Icon: UserIcon },
        { id: 'security' as const, label: 'Seguridad', Icon: ShieldIcon },
        { id: 'sessions' as const, label: 'Sesiones', Icon: DeviceIcon },
    ];

    return (
        <div class="w-full p-4 sm:p-6 max-w-3xl mx-auto">
            {/* Loading State */}
            <Show when={profileQuery.isLoading}>
                <div class="flex justify-center py-16">
                    <div class="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
                </div>
            </Show>

            {/* Error State */}
            <Show when={profileQuery.isError}>
                <div class="text-center py-16">
                    <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-danger/10 flex items-center justify-center">
                        <svg class="w-8 h-8 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <p class="text-danger mb-4">Error al cargar el perfil</p>
                    <button
                        onClick={() => profileQuery.refetch()}
                        class="px-4 py-2 bg-surface-alt hover:bg-border rounded-lg text-sm transition-colors"
                    >
                        Reintentar
                    </button>
                </div>
            </Show>

            {/* Content */}
            <Show when={profileQuery.data} keyed>
                {(profile) => (
                    <>
                        {/* Profile Header */}
                        <ProfileHeader profile={profile} />

                        {/* Tab Navigation */}
                        <div class="flex gap-1 p-1 bg-card-alt rounded-xl mb-6">
                            {tabs.map((tab) => (
                                <button
                                    onClick={() => setActiveTab(tab.id)}
                                    onMouseEnter={() => handleTabHover(tab.id)}
                                    onFocus={() => handleTabHover(tab.id)}
                                    class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium"
                                    classList={{
                                        'bg-surface shadow-sm text-heading': activeTab() === tab.id,
                                        'text-muted hover:text-heading hover:bg-surface/50': activeTab() !== tab.id,
                                    }}
                                >
                                    <tab.Icon class="w-4 h-4" />
                                    <span class="hidden sm:inline">{tab.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* 
                            Tab Content - Simple approach with display:none
                            All tabs are always mounted but only one is displayed.
                            Using 'hidden' class = display:none = instant, no transitions
                            w-full ensures consistent width regardless of tab content
                        */}
                        <div class="w-full bg-card border border-border rounded-2xl p-6 shadow-card-soft">
                            {/* Account Tab */}
                            <div classList={{ 'hidden': activeTab() !== 'account' }}>
                                <AccountSection
                                    profile={profile}
                                    onUpdate={handleUpdateProfile}
                                    isUpdating={updateProfileMutation.isPending}
                                />
                            </div>

                            {/* Security Tab */}
                            <div classList={{ 'hidden': activeTab() !== 'security' }}>
                                <SecuritySection
                                    onChangePassword={handleChangePassword}
                                    isChanging={changePasswordMutation.isPending}
                                />
                            </div>

                            {/* Sessions Tab */}
                            <div classList={{ 'hidden': activeTab() !== 'sessions' }}>
                                <SessionsSection />
                            </div>
                        </div>
                    </>
                )}
            </Show>
        </div>
    );
};

export default ProfilePage;