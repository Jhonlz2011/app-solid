// Profile Page - My Account View (Optimized for 0ms UX)
import { Component, Show, onMount, onCleanup, createMemo } from 'solid-js';
import { useQueryClient } from '@tanstack/solid-query';
import { toast } from 'solid-sonner';
import { useProfile, useMySessions } from '../data/profile.queries';
import { useUpdateProfile, useChangeEmail, useChangePassword } from '../data/profile.mutations';
import { profileKeys } from '../data/profile.keys';
import { ScrollArea } from '@/layout/components/ScrollArea';
import { ProfileHeader, ProfileHeaderSkeleton } from '../components/ProfileHeader';
import { AccountSection } from '../components/AccountSection';
import { SecuritySection } from '../components/SecuritySection';
import { SessionsSection } from '../components/SessionsSection';
import { ShieldIcon } from '@icons/ShieldIcon';
import { UserIcon } from '@icons/UserIcon';
import { DeviceIcon } from '@icons/DeviceIcon';

import { broadcast, BroadcastEvents } from '@shared/store/broadcast.store';
import { RealtimeEvents } from '@app/schema/realtime-events';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/ui/form/Tabs';
import { Skeleton } from '@display/Skeleton';
import ErrorState from '@/shared/ui/display/ErrorState';

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
    const sessionsQuery = useMySessions();
    const updateProfileMutation = useUpdateProfile();
    const changeEmailMutation = useChangeEmail();
    const changePasswordMutation = useChangePassword();

    // Stable profile reference - prevents re-renders on refetch when data hasn't changed
    const profile = createMemo(() => profileQuery.data);
    const sessionsCount = () => sessionsQuery.data?.length;

    // Listen for profile and session updates from other tabs (via BroadcastChannel) and SSE (cross-device)
    onMount(() => {
        const cleanupProfile = broadcast.on(BroadcastEvents.PROFILE_UPDATE, () => {
            queryClient.invalidateQueries({ queryKey: profileKeys.me() });
        });

        const cleanupSessions = broadcast.on(BroadcastEvents.SESSIONS_REFRESH, () => {
            queryClient.invalidateQueries({ queryKey: profileKeys.sessions() });
        });

        const handleSessionsChanged = () => {
            queryClient.invalidateQueries({ queryKey: profileKeys.sessions() });
        };

        const handleProfileChanged = () => {
            queryClient.invalidateQueries({ queryKey: profileKeys.me() });
        };

        window.addEventListener(RealtimeEvents.USER.SESSION_REVOKED, handleSessionsChanged);
        window.addEventListener(RealtimeEvents.USER.SESSION_CREATED, handleSessionsChanged);
        window.addEventListener(RealtimeEvents.USER.PROFILE_UPDATED, handleProfileChanged);
        window.addEventListener(RealtimeEvents.USER.EMAIL_VERIFIED, handleProfileChanged);

        onCleanup(() => {
            cleanupProfile();
            cleanupSessions();
            window.removeEventListener(RealtimeEvents.USER.SESSION_REVOKED, handleSessionsChanged);
            window.removeEventListener(RealtimeEvents.USER.SESSION_CREATED, handleSessionsChanged);
            window.removeEventListener(RealtimeEvents.USER.PROFILE_UPDATED, handleProfileChanged);
            window.removeEventListener(RealtimeEvents.USER.EMAIL_VERIFIED, handleProfileChanged);
        });
    });

    const handleUpdateProfile = async (data: { username?: string; name?: string }) => {
        try {
            await updateProfileMutation.mutateAsync(data);
            toast.success('Perfil actualizado correctamente');
        } catch (error: any) {
            toast.error(error?.message || 'Error al actualizar el perfil');
            throw error;
        }
    };

    const handleChangeEmail = async (newEmail: string) => {
        try {
            await changeEmailMutation.mutateAsync(newEmail);
            toast.info(`Hemos enviado un enlace de confirmación a ${newEmail}. Revisa tu bandeja de entrada.`);
        } catch (error: any) {
            toast.error(error?.message || 'Error al solicitar cambio de correo');
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
        <ScrollArea>
            <div class="w-full p-4 sm:p-6 max-w-3xl mx-auto">
                {/* Loading State - Graceful fallback if loader was bypassed */}
            <Show when={profileQuery.isLoading && !profile()}>
                <div class="animate-in fade-in duration-300 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6">
                    <ProfilePendingComponent />
                </div>
            </Show>

            {/* Error State */}
            <Show when={profileQuery.isError && !profile()}>
                <ErrorState 
                    description="Error al cargar el perfil" 
                    onRetry={() => profileQuery.refetch()} 
                />
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

                                <TabsTrigger value="sessions" count={sessionsCount()}>
                                    <DeviceIcon class="size-4" />
                                    <span class="hidden sm:inline">Sesiones</span>
                                </TabsTrigger>
                            </TabsList>

                            {/* Paneles */}
                            <div class="mt-6 bg-card border border-border rounded-xl p-5 shadow-sm">
                                <TabsContent value="account" forceMount>
                                    <AccountSection
                                        profile={profileData()}
                                        onUpdateProfile={handleUpdateProfile}
                                        onChangeEmail={handleChangeEmail}
                                        isUpdatingProfile={updateProfileMutation.isPending}
                                        isChangingEmail={changeEmailMutation.isPending}
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
        </ScrollArea>
    );
};

export default ProfilePage;