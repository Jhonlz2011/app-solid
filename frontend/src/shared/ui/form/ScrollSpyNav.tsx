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
            class={`sticky top-0 z-20 backdrop-blur-md bg-white/90 dark:bg-zinc-900/90 border-b border-zinc-200 dark:border-zinc-800 px-4 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar shadow-xs transition-colors ${props.class ?? ''}`}
        >
            <For each={props.tabs}>
                {(tab) => {
                    const isActive = () => (props.activeId ? props.activeId === tab.id : activeSection() === tab.id);
                    return (
                        <button
                            type="button"
                            onClick={() => scrollToSection(tab.id)}
                            class={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer select-none whitespace-nowrap ${
                                isActive()
                                    ? 'bg-primary-600 text-white shadow-xs font-semibold'
                                    : 'text-zinc-650 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
                            } ${tab.hasError ? 'ring-1 ring-rose-500 text-rose-600 dark:text-rose-400' : ''}`}
                        >
                            <Show when={tab.icon}>
                                {(Icon) => {
                                    const ComponentIcon = Icon();
                                    return <ComponentIcon class="w-3.5 h-3.5" />;
                                }}
                            </Show>
                            <span>{tab.label}</span>
                            <Show when={tab.badge !== undefined}>
                                <span
                                    class={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                                        isActive()
                                            ? 'bg-white/20 text-white'
                                            : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                                    }`}
                                >
                                    {tab.badge}
                                </span>
                            </Show>
                            <Show when={tab.hasError}>
                                <span class="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                            </Show>
                        </button>
                    );
                }}
            </For>
        </nav>
    );
};

export default ScrollSpyNav;
