import { Component, For, Show, createSignal, createEffect, onMount, onCleanup, JSX } from 'solid-js';
import { cn } from '@shared/lib/utils';
import { CounterBadge } from '@display/Badge';

export interface ScrollSpyItem {
    id: string; // target DOM id, e.g. 'section-general'
    label: string;
    icon?: Component<{ class?: string }> | ((props: any) => JSX.Element);
    hasError?: boolean;
    badge?: string | number;
}

export type ScrollSpyTab = ScrollSpyItem;

export interface ScrollSpyNavProps {
    items?: ScrollSpyItem[];
    tabs?: ScrollSpyTab[];
    activeId?: string;
    onChange?: (id: string) => void;
    onTabSelect?: (id: string) => void;
    class?: string;
}

export const ScrollSpyNav: Component<ScrollSpyNavProps> = (props) => {
    let navRef: HTMLElement | undefined;
    const items = () => props.items ?? props.tabs ?? [];
    const [activeSection, setActiveSection] = createSignal<string>(
        props.activeId || (items()[0]?.id ?? '')
    );

    // Sync active section if controlled from outside
    createEffect(() => {
        if (props.activeId) {
            setActiveSection(props.activeId);
        }
    });

    // Detect parent scroll container (SimpleBar or scrollable ancestor)
    const getScrollContainer = (): HTMLElement | null => {
        if (!navRef) return null;

        // 1. Direct parent/ancestor SimpleBar wrapper
        const simpleBarWrapper = navRef.closest('.simplebar-content-wrapper') as HTMLElement | null;
        if (simpleBarWrapper) return simpleBarWrapper;

        // 2. Check if a SimpleBar wrapper contains this element
        const allWrappers = document.querySelectorAll('.simplebar-content-wrapper');
        for (const wrapper of Array.from(allWrappers)) {
            if (wrapper.contains(navRef)) {
                return wrapper as HTMLElement;
            }
        }

        // 3. Fallback: nearest scrollable parent
        let parent = navRef.parentElement;
        while (parent && parent !== document.body) {
            const { overflowY } = window.getComputedStyle(parent);
            if (overflowY === 'auto' || overflowY === 'scroll') {
                return parent;
            }
            parent = parent.parentElement;
        }

        // 4. Fallback: if there's any active sheet/modal SimpleBar
        if (allWrappers.length > 0) {
            return allWrappers[allWrappers.length - 1] as HTMLElement;
        }

        return null;
    };

    const scrollToSection = (id: string) => {
        setActiveSection(id);
        props.onChange?.(id);
        props.onTabSelect?.(id);

        const element = document.getElementById(id);
        if (!element) return;

        const container = getScrollContainer();
        if (container) {
            const navHeight = navRef ? navRef.offsetHeight : 44;
            const containerRect = container.getBoundingClientRect();
            const elementRect = element.getBoundingClientRect();
            const relativeTop = elementRect.top - containerRect.top;
            const targetScrollTop = container.scrollTop + relativeTop - navHeight - 12;

            container.scrollTo({
                top: Math.max(0, targetScrollTop),
                behavior: 'smooth',
            });
        } else {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    onMount(() => {
        let observer: IntersectionObserver | null = null;
        const scrollContainer = getScrollContainer();

        const handleIntersect: IntersectionObserverCallback = (entries) => {
            const visibleEntries = entries.filter((e) => e.isIntersecting);
            if (visibleEntries.length > 0) {
                visibleEntries.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                setActiveSection(visibleEntries[0].target.id);
            }
        };

        observer = new IntersectionObserver(handleIntersect, {
            root: scrollContainer,
            rootMargin: '-80px 0px -50% 0px',
            threshold: [0, 0.25, 0.5],
        });

        items().forEach((tab) => {
            const el = document.getElementById(tab.id);
            if (el) observer?.observe(el);
        });

        onCleanup(() => {
            observer?.disconnect();
        });
    });

    return (
        <nav
            ref={navRef}
            aria-label="Navegación de secciones"
            class={cn(
                "relative flex w-full select-none items-center gap-1 p-1 rounded-xl bg-card-alt border border-border/50 overflow-x-auto no-scrollbar transition-colors",
                props.class
            )}
        >
            <For each={items()}>
                {(item) => {
                    const isActive = () => (props.activeId ? props.activeId === item.id : activeSection() === item.id);
                    return (
                        <button
                            type="button"
                            onClick={() => scrollToSection(item.id)}
                            data-selected={isActive() ? "" : undefined}
                            data-active={isActive() ? "true" : "false"}
                            class={cn(
                                "group relative z-10 flex cursor-pointer items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-lg outline-none transition-all select-none whitespace-nowrap",
                                isActive()
                                    ? "bg-surface text-heading font-medium shadow-sm border border-border/10"
                                    : "text-muted hover:text-heading hover:bg-surface/40",
                                item.hasError && !isActive() && "text-danger border border-danger/40 hover:text-danger-strong hover:bg-danger/10 hover:border-danger/60",
                                item.hasError && isActive() && "text-danger-strong border-danger/60"
                            )}
                        >
                            <Show when={item.icon}>
                                {(Icon) => {
                                    const ComponentIcon = Icon();
                                    return <ComponentIcon class="size-4 shrink-0" />;
                                }}
                            </Show>
                            <span>{item.label}</span>
                            <Show when={item.badge !== undefined}>
                                <Show
                                    when={typeof item.badge === 'number' || !isNaN(Number(item.badge))}
                                    fallback={
                                        <span class="px-1.5 py-0.5 text-xs font-semibold rounded-full bg-surface/50 text-muted border border-border/50">
                                            {item.badge}
                                        </span>
                                    }
                                >
                                    <CounterBadge
                                        count={typeof item.badge === 'number' ? item.badge : Number(item.badge)}
                                        variant="tab"
                                        class={cn(
                                            "px-1.5 py-0.5",
                                            item.hasError && "animate-pulse bg-danger/15! text-danger! border-danger/30!"
                                        )}
                                    />
                                </Show>
                            </Show>
                            <Show when={item.hasError && item.badge === undefined}>
                                <span class="absolute top-0 right-0 -mr-1 -mt-1 h-3 w-3 flex group-data-selected:hidden">
                                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75"></span>
                                    <span class="relative inline-flex rounded-full h-3 w-3 bg-danger border border-surface"></span>
                                </span>
                            </Show>
                        </button>
                    );
                }}
            </For>
        </nav>
    );
};

export default ScrollSpyNav;

