import { Component, createSignal, onMount, Show, For } from 'solid-js';
import { toast } from 'solid-sonner';
import { DropdownMenu } from '@display/DropdownMenu';
import { authClient } from '@shared/lib/auth-client';
import { actions, useAuth } from '@modules/auth/store/auth.store';
import { useBranding } from '@modules/auth/store/branding.store';
import { BuildingIcon } from '@icons/BuildingIcon';
import { CheckIcon } from '@icons/CheckIcon';
import { PlusIcon } from '@icons/PlusIcon';

const BASE_DOMAIN = import.meta.env.VITE_BASE_DOMAIN || 'zelys.app';

interface OrganizationItem {
    id: string;
    name: string;
    slug: string;
    logo?: string | null;
}

interface CompanySwitcherProps {
    collapsed?: boolean;
}

export const CompanySwitcher: Component<CompanySwitcherProps> = (props) => {
    const auth = useAuth();
    const branding = useBranding();
    const [organizations, setOrganizations] = createSignal<OrganizationItem[]>([]);
    const [loading, setLoading] = createSignal(false);
    const [switchingId, setSwitchingId] = createSignal<string | null>(null);

    const loadOrganizations = async () => {
        try {
            setLoading(true);
            const res = await authClient.organization.list();
            if (res?.data) {
                setOrganizations(res.data as OrganizationItem[]);
            }
        } catch (error) {
            console.error('[CompanySwitcher] Failed to load organizations:', error);
        } finally {
            setLoading(false);
        }
    };

    onMount(() => {
        loadOrganizations();
    });

    const currentSlug = () => branding.tenant()?.slug || auth.user()?.companySlug;
    const currentName = () => branding.tenant()?.tradeName || branding.tenant()?.businessName || 'Mi Empresa';
    const currentLogo = () => branding.tenant()?.logoUrl;

    const handleSwitch = async (org: OrganizationItem) => {
        if (org.slug === currentSlug() || switchingId()) return;

        setSwitchingId(org.id);
        try {
            await actions.switchOrganization(org.id);
            toast.success(`Cambiando a ${org.name}...`);

            const host = window.location.hostname;
            const port = window.location.port;
            const protocol = window.location.protocol;
            const ipRegex = /^[0-9.]+$/;

            if (host === 'localhost' || ipRegex.test(host)) {
                const url = new URL(window.location.origin + '/dashboard');
                url.searchParams.set('slug', org.slug);
                window.location.href = url.toString();
            } else {
                const domainParts = host.split('.');
                const baseDomain = host.includes(BASE_DOMAIN) ? BASE_DOMAIN : domainParts.slice(-2).join('.');
                const portStr = port ? `:${port}` : '';
                window.location.href = `${protocol}//${org.slug}.${baseDomain}${portStr}/dashboard`;
            }
        } catch (err: any) {
            toast.error(err?.message || 'Error al cambiar de empresa');
            setSwitchingId(null);
        }
    };

    return (
        <DropdownMenu placement={props.collapsed ? "right" : "bottom-start"} gutter={8}>
            <DropdownMenu.Trigger
                class="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-card-alt transition-colors w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer group"
                aria-label="Cambiar de empresa"
                onClick={() => loadOrganizations()}
            >
                {/* Logo / Icon */}
                <div class="size-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Show
                        when={currentLogo()}
                        fallback={
                            <span class="text-primary font-bold text-sm">
                                {currentName().charAt(0).toUpperCase()}
                            </span>
                        }
                    >
                        <img
                            src={currentLogo()!}
                            alt={`Logo de ${currentName()}`}
                            class="size-full object-contain"
                        />
                    </Show>
                </div>

                {/* Company Name & Chevron (Only in expanded state) */}
                <Show when={!props.collapsed}>
                    <div class="flex-1 min-w-0 flex flex-col">
                        <span class="font-semibold text-xs text-heading truncate leading-tight">
                            {currentName()}
                        </span>
                        <span class="text-[10px] text-muted truncate">
                            {currentSlug() ? `${currentSlug()}.zelys.app` : 'Plataforma'}
                        </span>
                    </div>

                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        class="size-4 text-muted shrink-0 group-hover:text-heading transition-colors"
                    >
                        <path
                            fill-rule="evenodd"
                            d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                            clip-rule="evenodd"
                        />
                    </svg>
                </Show>
            </DropdownMenu.Trigger>

            <DropdownMenu.Content class="w-64 p-1.5 shadow-xl border border-border bg-card rounded-2xl">
                <DropdownMenu.Label class="text-[10px] font-bold text-muted px-2 py-1 uppercase tracking-wider">
                    Empresas Disponibles
                </DropdownMenu.Label>

                <div class="flex flex-col gap-1 max-h-56 overflow-y-auto py-0.5">
                    <For each={organizations()}>
                        {(org) => {
                            const isActive = () => org.slug === currentSlug();
                            const isSwitching = () => switchingId() === org.id;

                            return (
                                <button
                                    type="button"
                                    disabled={isSwitching()}
                                    onClick={() => handleSwitch(org)}
                                    class="flex items-center gap-2.5 px-2 py-2 rounded-xl text-left text-sm transition-all cursor-pointer group disabled:opacity-50"
                                    classList={{
                                        "bg-primary/10 text-primary font-medium": isActive(),
                                        "hover:bg-card-alt text-text": !isActive(),
                                    }}
                                >
                                    <div
                                        class="size-7 rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
                                        classList={{
                                            "bg-primary text-white": isActive() && !org.logo,
                                            "bg-muted/20 text-muted": !isActive() && !org.logo,
                                        }}
                                    >
                                        <Show
                                            when={org.logo}
                                            fallback={
                                                <span class="font-bold text-xs">
                                                    {org.name.charAt(0).toUpperCase()}
                                                </span>
                                            }
                                        >
                                            <img src={org.logo!} alt="" class="size-full object-contain" />
                                        </Show>
                                    </div>

                                    <div class="flex-1 min-w-0">
                                        <p class="text-xs font-semibold truncate leading-snug">
                                            {org.name}
                                        </p>
                                        <p class="text-[10px] text-muted truncate">
                                            {org.slug}.zelys.app
                                        </p>
                                    </div>

                                    <Show when={isActive()}>
                                        <CheckIcon class="size-4 text-primary shrink-0" />
                                    </Show>
                                    <Show when={isSwitching()}>
                                        <div class="size-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
                                    </Show>
                                </button>
                            );
                        }}
                    </For>

                    <Show when={organizations().length === 0 && !loading()}>
                        <div class="px-3 py-2 text-xs text-muted text-center">
                            No perteneces a otras empresas
                        </div>
                    </Show>
                </div>

                <DropdownMenu.Separator />

                <DropdownMenu.Item
                    to="/register"
                    class="flex items-center gap-2 px-2 py-2 text-xs font-medium text-primary hover:bg-primary/10 rounded-xl"
                >
                    <PlusIcon class="size-3.5" />
                    <span>Registrar nueva empresa</span>
                </DropdownMenu.Item>
            </DropdownMenu.Content>
        </DropdownMenu>
    );
};

export default CompanySwitcher;
