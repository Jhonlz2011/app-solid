import { Component, For, JSX, Show } from 'solid-js';

export interface Tab {
    key: string;
    label: string;
    icon?: JSX.Element;
    count?: number;
}

interface TabPillsProps {
    tabs: Tab[];
    active: string;
    onChange: (key: string) => void;
}

export const TabPills: Component<TabPillsProps> = (props) => (
    <div class="flex items-center gap-1.5">
        <For each={props.tabs}>
            {(tab) => (
                <button
                    class={`filter-pill flex items-center gap-2 ${props.active === tab.key ? 'filter-pill--active' : ''}`}
                    onClick={() => props.onChange(tab.key)}
                >
                    {tab.icon}
                    {tab.label}
                    <Show when={tab.count !== undefined}>
                        <span class="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-surface/50">{tab.count}</span>
                    </Show>
                </button>
            )}
        </For>
    </div>
);

export default TabPills;
