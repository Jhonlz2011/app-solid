import { Component, splitProps, Show } from 'solid-js';
import { Tabs as KTabs } from "@kobalte/core/tabs";
import { cn } from '../lib/utils';
import { CounterBadge, type CounterVariant } from './Badge';

export type TabsVariant = 'default' | 'pills';

// 1. ROOT
export const Tabs: Component<Parameters<typeof KTabs>[0] & { class?: string }> = (props) => {
    const [local, others] = splitProps(props, ['class']);
    return <KTabs {...others} class={cn("w-full", local.class)} />;
};

// 2. TABS LIST (El corazón del arreglo)
export const TabsList: Component<Parameters<typeof KTabs.List>[0] & { class?: string; variant?: TabsVariant }> = (props) => {
    const [local, others] = splitProps(props, ['class', 'children', 'variant']);
    const isPills = () => local.variant === 'pills';
    
    return (
        <KTabs.List
            {...others}
            class={cn(
                "relative flex w-full select-none",
                isPills() 
                    ? "gap-1.5" // Pills: sin fondo, solo gap
                    : "gap-1 p-1 rounded-xl bg-card-alt border border-border/50", // Default
                local.class
            )}
        >
            {/* INDICADOR (FONDO MÓVIL) */}
            <KTabs.Indicator
                class={cn(
                    "absolute left-0 transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] z-0",
                    isPills()
                        ? "inset-y-0 bg-primary-soft border border-primary/50 rounded-full shadow-[0_10px_30px_color-mix(in_srgb,var(--color-primary)_35%,transparent)]"
                        : "inset-y-1 bg-surface shadow-sm rounded-lg border border-border/10"
                )}
            />

            {/* RENDERIZADO DE BOTONES */}
            {local.children}
        </KTabs.List>
    );
};

// 3. TABS TRIGGER (Los botones)
type TabsTriggerProps = Parameters<typeof KTabs.Trigger>[0] & { 
    class?: string;
    variant?: TabsVariant;
    count?: number;
    countVariant?: CounterVariant;
};

export const TabsTrigger: Component<TabsTriggerProps> = (props) => {
    const [local, others] = splitProps(props, ['class', 'children', 'variant', 'count', 'countVariant']);
    const isPills = () => local.variant === 'pills';

    return (
        <KTabs.Trigger
            {...others}
            class={cn(
                "group relative z-10 flex cursor-pointer items-center justify-center gap-2 outline-none transition-colors",
                isPills()
                    ? "font-semibold rounded-full border border-border-strong px-[1.15rem] py-[0.45rem] text-[0.9rem] text-muted hover:border-primary/50 hover:bg-card-alt hover:text-heading data-[selected]:border-transparent data-[selected]:text-primary-strong"
                    : "flex-1 py-2 px-3 text-sm font-medium rounded-lg text-muted hover:text-heading hover:bg-surface/40 data-[selected]:text-heading focus-visible:ring-2 focus-visible:ring-primary/50",
                local.class
            )}
        >
            {local.children}
            <Show when={local.count !== undefined}>
                <CounterBadge count={local.count} variant={local.countVariant ?? (isPills() ? "tab-pill" : "tab")} class={isPills() ? "ml-0.5" : "px-1.5 py-0.5"} />
            </Show>
        </KTabs.Trigger>
    );
};

// 4. CONTENT
export const TabsContent: Component<Parameters<typeof KTabs.Content>[0] & { class?: string; forceMount?: boolean }> = (props) => {
    const [local, others] = splitProps(props, ['class', 'forceMount']);
    return (
        <KTabs.Content
            {...others}
            forceMount={local.forceMount}
            class={cn("hidden data-[selected]:block outline-none", local.class)}
        />
    );
};