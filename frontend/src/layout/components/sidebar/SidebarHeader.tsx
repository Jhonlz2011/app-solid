import { Component, Show, For, createSignal, onMount, createMemo } from 'solid-js';
import { toast } from 'solid-sonner';
import { useSidebar } from './SidebarContext';
import { SidebarCollapseIcon } from '@icons/SidebarCollapseIcon';
import { CloseIcon } from '@icons/CloseIcon';
import { ChevronsUpDownIcon } from '@icons/ChevronsUpDownIcon';
import { CheckIcon } from '@icons/CheckIcon';
import { PlusIcon } from '@icons/PlusIcon';
import { DropdownMenu } from '@display/DropdownMenu';
import { authClient } from '@shared/lib/auth-client';
import { actions, useAuth } from '@modules/auth/store/auth.store';
import { useBranding } from '@modules/auth/store/branding.store';

const BASE_DOMAIN = import.meta.env.VITE_BASE_DOMAIN || 'zelys.app';

interface OrganizationItem {
    id: string;
    name: string;
    slug: string;
    logo?: string | null;
}

interface SidebarHeaderProps {
    toggleCollapse: () => void;
}

export const SidebarHeader: Component<SidebarHeaderProps> = (props) => {
    const { collapsed, setIsMobileOpen } = useSidebar();
    const auth = useAuth();
    const branding = useBranding();

    const [organizations, setOrganizations] = createSignal<OrganizationItem[]>([]);
    const [loading, setLoading] = createSignal(false);
    const [switchingId, setSwitchingId] = createSignal<string | null>(null);

    // Derived reactive getters
    const currentSlug = () => branding.tenant()?.slug || auth.user()?.companySlug || null;
    const currentTradeName = () =>
        branding.tenant()?.tradeName ||
        branding.tenant()?.businessName ||
        auth.user()?.companySlug?.toUpperCase() ||
        'Mi Empresa';
    const currentSubtitle = () =>
        branding.tenant()?.tradeName
            ? branding.tenant()?.businessName
            : currentSlug()
              ? `${currentSlug()}.zelys.app`
              : 'Plataforma';
    const currentLogo = () => branding.tenant()?.logoUrl;
    const initialLetter = createMemo(() => currentTradeName().substring(0, 1).toUpperCase());

    const loadOrganizations = async () => {
        try {
            setLoading(true);
            const res = await authClient.organization.list();
            if (res?.data) {
                setOrganizations(res.data as OrganizationItem[]);
            }
        } catch (error) {
            console.error('[SidebarHeader] Failed to load organizations:', error);
        } finally {
            setLoading(false);
        }
    };

    onMount(() => {
        loadOrganizations();
    });

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
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : typeof err === 'object' && err !== null && 'message' in err ? String((err as { message: unknown }).message) : 'Error al cambiar de empresa';
            toast.error(message);
            setSwitchingId(null);
        }
    };

    return (
        <header
            class="border-b border-border relative h-18 shrink-0"
            data-collapsed={collapsed()}
        >
            {/* LAYER 1: Logo Layer — Always visible & stationary at the exact same position */}
            <div class="absolute inset-0 flex items-center px-4 sm:pl-5 pointer-events-none z-10">
                <Show
                    when={currentLogo()}
                    fallback={
                        <div class="size-10 bg-linear-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                            <span class="text-white font-bold text-lg">
                                {initialLetter()}
                            </span>
                        </div>
                    }
                >
                    <img
                        src={currentLogo()!}
                        alt={`Logo de ${currentTradeName()}`}
                        loading="eager"
                        class="size-10 rounded-xl object-contain shrink-0"
                    />
                </Show>
            </div>

            {/* LAYER 2: Collapsed State — Hover Expand Button over logo */}
            <div
                class="absolute inset-0 flex items-center px-4 sm:pl-5 transition-opacity duration-200 z-20"
                classList={{
                    'opacity-100': collapsed(),
                    'opacity-0 pointer-events-none': !collapsed(),
                }}
                inert={!collapsed()}
            >
                <div class="relative size-10 shrink-0">
                    <button
                        onClick={props.toggleCollapse}
                        class="peer absolute inset-0 size-10 hidden sm:flex items-center justify-center 
                               opacity-0 hover:opacity-100 focus-visible:opacity-100 
                               rounded-xl hover:bg-card-alt
                               focus:outline-none focus-visible:bg-card-alt focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-transparent
                               z-10 pointer-events-auto hover:scale-105 focus-visible:scale-105 cursor-pointer transition-all text-muted hover:text-heading"
                        title="Expandir sidebar"
                        aria-label="Expandir sidebar"
                    >
                        <SidebarCollapseIcon class="size-5" />
                    </button>
                </div>
            </div>

            {/* LAYER 3: Expanded State — Company Switcher Dropdown + Collapse & Close Buttons */}
            <div
                class="absolute inset-0 flex items-center justify-between px-4 sm:pl-5 sm:pr-4 transition-opacity duration-200 z-20"
                classList={{
                    'opacity-100': !collapsed(),
                    'opacity-0 pointer-events-none': collapsed(),
                }}
                inert={collapsed()}
            >
                {/* Company Switcher Dropdown */}
                <div class="flex-1 min-w-0 pr-2">
                    <DropdownMenu placement="bottom-start" gutter={8}>
                        <DropdownMenu.Trigger
                            variant="none"
                            class="flex items-center gap-3 w-full text-left rounded-xl p-1 -ml-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer group"
                            aria-label="Cambiar de empresa"
                            onClick={() => loadOrganizations()}
                        >
                            {/* Spacer matching stationary logo underneath */}
                            <div class="size-10 shrink-0 opacity-0 pointer-events-none" />

                            {/* Company Name & Subtitle */}
                            <div class="flex-1 min-w-0 flex flex-col justify-center overflow-hidden">
                                <h2 class="font-bold text-sm text-heading whitespace-nowrap truncate group-hover:text-primary leading-tight">
                                    {currentTradeName()}
                                </h2>
                                <p class="text-muted text-[10px] whitespace-nowrap truncate leading-tight mt-0.5">
                                    {currentSubtitle()}
                                </p>
                            </div>

                            <ChevronsUpDownIcon class="size-4 text-muted shrink-0 group-hover:text-heading transition-colors" />
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
                </div>

                {/* Right side buttons */}
                <div class="flex items-center gap-1 shrink-0">
                    <button
                        onClick={props.toggleCollapse}
                        class="hidden sm:flex items-center justify-center text-muted hover:bg-card-alt hover:text-heading p-1.5 rounded-lg
                               focus-visible:text-heading focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 cursor-pointer transition-colors"
                        title="Colapsar sidebar"
                        aria-label="Colapsar sidebar"
                    >
                        <SidebarCollapseIcon class="size-5" />
                    </button>

                    {/* Close button - Mobile only */}
                    <button
                        onClick={() => setIsMobileOpen(false)}
                        class="sm:hidden text-muted hover:bg-card-alt hover:text-heading p-1.5 rounded-xl 
                               focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer transition-colors"
                        aria-label="Cerrar menú"
                    >
                        <CloseIcon class="size-5" />
                    </button>
                </div>
            </div>
        </header>
    );
};
