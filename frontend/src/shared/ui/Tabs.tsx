import { Component, splitProps } from 'solid-js';
import { Tabs as KTabs } from "@kobalte/core/tabs";

// 1. ROOT
export const Tabs: Component<Parameters<typeof KTabs>[0] & { class?: string }> = (props) => {
    const [local, others] = splitProps(props, ['class']);
    return <KTabs {...others} class={`w-full ${local.class ?? ''}`} />;
};

// 2. TABS LIST (El corazón del arreglo)
export const TabsList: Component<Parameters<typeof KTabs.List>[0] & { class?: string }> = (props) => {
    const [local, others] = splitProps(props, ['class', 'children']);
    return (
        <KTabs.List
            {...others}
            class={`
        relative flex w-full 
        gap-1 
        p-1 
        rounded-xl
        bg-card-alt border border-border/50 select-none
        ${local.class ?? ''}
      `}
        >
            {/* INDICADOR (FONDO MÓVIL) */}
            <KTabs.Indicator
                class="
          absolute
          left-0
          inset-y-1
          bg-surface shadow-sm rounded-lg border border-border/10
          transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
          z-0
        "
            />

            {/* RENDERIZADO DE BOTONES */}
            {local.children}
        </KTabs.List>
    );
};

// 3. TABS TRIGGER (Los botones)
export const TabsTrigger: Component<Parameters<typeof KTabs.Trigger>[0] & { class?: string }> = (props) => {
    const [local, others] = splitProps(props, ['class', 'children']);
    return (
        <KTabs.Trigger
            {...others}
            class={`
        flex-1 
        flex items-center justify-center gap-2 
        py-2 px-3
        relative z-10 cursor-pointer
        
        text-sm font-medium rounded-lg outline-none
        
        text-muted 
        hover:text-heading 
        hover:bg-surface/50
        data-[selected]:text-heading
       
        focus-visible:ring-2 focus-visible:ring-primary/50
        
        ${local.class ?? ''}
      `}
        >
            {local.children}
        </KTabs.Trigger>
    );
};

// 4. CONTENT
export const TabsContent: Component<Parameters<typeof KTabs.Content>[0] & { class?: string }> = (props) => {
    const [local, others] = splitProps(props, ['class']);
    return (
        <KTabs.Content
            {...others}
            class={`
        hidden data-[selected]:block
        outline-none
        ${local.class ?? ''}
      `}
        />
    );
};