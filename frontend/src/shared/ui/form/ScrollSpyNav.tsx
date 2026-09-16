import { Component, For, Show, createSignal, onMount, onCleanup } from 'solid-js';

export interface ScrollSpyTab {
    id: string; // target DOM id, e.g. 'section-general'
    label: string;
    icon?: Component<{ class?: string }>;
    hasError?: boolean;
    badge?: string | number;
}

export interface ScrollSpyNavProps {
    tabs: ScrollSpyTab[];
    activeId?: string;
    onTabSelect?: (id: string) => void;
    class?: string;
}

export const ScrollSpyNav: Component<ScrollSpyNavProps> = (props) => {
    const [activeSection, setActiveSection] = createSignal<string>(props.activeId || (props.tabs[0]?.id ?? ''));

    const scrollToSection = (id: string) => {
        setActiveSection(id);
        props.onTabSelect?.(id);
        const element = document.getElementById(id);
        if (element) {
            const yOffset = -90; // offset for sticky nav + page headers
            const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
    };

    onMount(() => {
        let observer: IntersectionObserver | null = null;
        const handleIntersect: IntersectionObserverCallback = (entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    setActiveSection(entry.target.id);
                    break;
                }
            }
        };

        observer = new IntersectionObserver(handleIntersect, {
            root: null,
            rootMargin: '-100px 0px -60% 0px',
            threshold: 0,
        });

        props.tabs.forEach((tab) => {
            const el = document.getElementById(tab.id);
            if (el) observer?.observe(el);
        });

        onCleanup(() => {
            observer?.disconnect();
        });
    });

    return (
        <nav
            aria-label="Navegación de secciones"
            class={`sticky top-0 z-20 backdrop-blur-md bg-surface/85 border border-border/80 px-2 py-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar shadow-2xs rounded-xl transition-all ${props.class ?? ''}`}
        >
            <For each={props.tabs}>
                {(tab) => {
                    const isActive = () => (props.activeId ? props.activeId === tab.id : activeSection() === tab.id);
                    return (
                        <button
                            type="button"
                            onClick={() => scrollToSection(tab.id)}
                            class="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer select-none whitespace-nowrap"
                            classList={{
                                'bg-card text-primary font-semibold border border-border/80 shadow-2xs': isActive(),
                                'text-muted hover:text-text hover:bg-surface-hover/80': !isActive(),
                                'border-destructive/40 text-destructive': !!tab.hasError && !isActive(),
                            }}
                        >
                            <Show when={tab.icon}>
                                {(Icon) => {
                                    const ComponentIcon = Icon();
                                    return <ComponentIcon class="w-3.5 h-3.5 shrink-0" />;
                                }}
                            </Show>
                            <span>{tab.label}</span>
                            <Show when={tab.badge !== undefined}>
                                <span
                                    class="px-1.5 py-0.2 rounded-full text-[10px] font-semibold"
                                    classList={{
                                        'bg-primary/10 text-primary': isActive(),
                                        'bg-surface border border-border text-muted': !isActive(),
                                    }}
                                >
                                    {tab.badge}
                                </span>
                            </Show>
                            <Show when={tab.hasError}>
                                <span class="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                            </Show>
                        </button>
                    );
                }}
            </For>
        </nav>
    );
};

export default ScrollSpyNav;
