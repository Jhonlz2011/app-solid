// Profile Page - My Account View (Optimized for 0ms UX)
import { Component, Show, onMount, onCleanup, createMemo } from 'solid-js';
import { useQueryClient } from '@tanstack/solid-query';
import { toast } from 'solid-sonner';
import { actions as authActions } from '@modules/auth/store/auth.store';
import { useProfile, useUpdateProfile, useChangePassword, profileKeys } from '../data/profile.api';
import { ProfileHeader, ProfileHeaderSkeleton } from '../components/ProfileHeader';
import { AccountSection } from '../components/AccountSection';
import { SecuritySection } from '../components/SecuritySection';
import { SessionsSection } from '../components/SessionsSection';
import { ShieldIcon, UserIcon, DeviceIcon } from '@shared/ui/icons';
import { broadcast, BroadcastEvents } from '@shared/store/broadcast.store';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@shared/ui/Tabs';
import { Skeleton } from '@shared/ui/Skeleton';

export const ProfilePendingComponent: Component = () => (
    <div class="w-full p-4 sm:p-6 max-w-3xl mx-auto">
        <div class="animate-in fade-in duration-300">
            <ProfileHeaderSkeleton />
            <div class="mt-6 mb-6 relative flex w-full gap-1 p-1 rounded-xl bg-card-alt border border-border/50">
                <Skeleton class="h-9 flex-1 rounded-lg" />
                <Skeleton class="h-9 flex-1 rounded-lg" />
                <Skeleton class="h-9 flex-1 rounded-lg" />
            </div>
            <div class="bg-card border border-border rounded-xl p-6 shadow-sm mt-6">
                <Skeleton class="h-6 w-1/2 max-w-[12rem] mb-2 rounded" />
                <Skeleton class="h-4 w-3/4 max-w-[16rem] mb-6 rounded" />
                <div class="space-y-4">
                    <Skeleton class="h-12 w-full rounded-xl" />
                    <Skeleton class="h-12 w-full rounded-xl" />
                    <Skeleton class="h-12 w-1/2 max-w-[12rem] mt-4 rounded-xl" />
                </div>
            </div>
        </div>
    </div>
);

const ProfilePage: Component = () => {
    const queryClient = useQueryClient();

    const profileQuery = useProfile();
    const updateProfileMutation = useUpdateProfile();
    const changePasswordMutation = useChangePassword();

    // Stable profile reference - prevents re-renders on refetch when data hasn't changed
    const profile = createMemo(() => profileQuery.data);

    // Listen for profile updates from other tabs (via centralized broadcast store)
    onMount(() => {
        const cleanup = broadcast.on(BroadcastEvents.PROFILE_UPDATE, () => {
            queryClient.invalidateQueries({ queryKey: profileKeys.me() });
        });

        onCleanup(cleanup);
    });

    const handleUpdateProfile = async (data: { username?: string; email?: string }) => {
        try {
            const result = await updateProfileMutation.mutateAsync(data);
            if (result.success) {
                // Update auth store immediately for sidebar reactivity + broadcast to other tabs
                authActions.updateUser(data);
                // Invalidate query in background (won't cause flash because we don't use keyed)
                queryClient.invalidateQueries({ queryKey: profileKeys.me() });
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
            // Don't throw - let the promise resolve so form exits isSubmitting
        }
    };

    return (
        <div class="w-full p-4 sm:p-6 max-w-3xl mx-auto">
            {/* Loading State - Graceful fallback if loader was bypassed */}
            <Show when={profileQuery.isLoading && !profile()}>
                <div class="animate-in fade-in duration-300 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6">
                    <ProfilePendingComponent />
                </div>
            </Show>

            {/* Error State */}
            <Show when={profileQuery.isError && !profile()}>
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

            {/* Content - Use profile() memo instead of keyed Show */}
            <Show when={profile()}>
                {(profileData) => (
                    <>
                        {/* Profile Header */}
                        <ProfileHeader profile={profileData()} />

                        {/* IMPLEMENTACIÓN GLOBAL */}
                        <Tabs defaultValue="account">

                            {/* Navegación */}
                            <TabsList>
                                <TabsTrigger value="account">
                                    <UserIcon class="size-4" />
                                    <span class="hidden sm:inline">Cuenta</span>
                                </TabsTrigger>

                                <TabsTrigger value="security">
                                    <ShieldIcon class="size-4" />
                                    <span class="hidden sm:inline">Seguridad</span>
                                </TabsTrigger>

                                <TabsTrigger value="sessions">
                                    <DeviceIcon class="size-4" />
                                    <span class="hidden sm:inline">Sesiones</span>
                                </TabsTrigger>
                            </TabsList>

                            {/* Paneles */}
                            <div class="mt-6 bg-card border border-border rounded-xl p-6 shadow-sm">
                                <TabsContent value="account" forceMount>
                                    <AccountSection
                                        profile={profileData()}
                                        onUpdate={handleUpdateProfile}
                                        isUpdating={updateProfileMutation.isPending}
                                    />
                                </TabsContent>
                                <TabsContent value="security" forceMount>
                                    <SecuritySection
                                        onChangePassword={handleChangePassword}
                                        isChanging={changePasswordMutation.isPending}
                                    />
                                </TabsContent>
                                <TabsContent value="sessions" forceMount>
                                    <SessionsSection />
                                </TabsContent>
                            </div>
                        </Tabs>
                    </>
                )}
             </Show>
        </div>
    );
};

export default ProfilePage;