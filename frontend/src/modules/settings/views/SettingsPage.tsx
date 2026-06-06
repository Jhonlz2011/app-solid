/**
 * SettingsPage — Configuración General with URL-driven sidebar navigation.
 * Each section is a TanStack Router child route rendered via <Outlet />.
 *
 * Redesign v2:
 *  - Grouped sidebar with collapsible section groups
 *  - SVG icons (no emojis) — inherits currentColor, scales properly
 *  - Mobile: horizontal scrollable tabs at the top
 *  - Desktop: vertical grouped sidebar
 */
import { Component, For, Show, createSignal, JSX } from 'solid-js';
import { Outlet, Link, useMatches } from '@tanstack/solid-router';
import { PageHeader } from '@shared/ui/PageHeader';
import Button from '@shared/ui/Button';
import { cn } from '@shared/lib/utils';
import type { IconProps } from '@shared/ui/icons';
import {
    PlusIcon,
    LayersIcon,
    LayoutIcon,
    WarehouseIcon,
    PercentIcon,
    HashIcon,
    LockIcon,
    ChevronDownIcon,
    PaintBrushIcon,
    BriefcaseIcon,
    ShieldIcon,
} from '@shared/ui/icons';

// ── Page header icon ──
const GearIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);

// ── Section / Group type definitions ──
interface Section {
    key: string;
    path: string;
    label: string;
    icon: Component<IconProps>;
    available: boolean;
    newAction?: string;
    newLabel?: string;
}

interface SectionGroup {
    key: string;
    label: string;
    sections: Section[];
}

// ── Grouped sections data ──
const SECTION_GROUPS: SectionGroup[] = [
    {
        key: 'company_group',
        label: 'Empresa',
        sections: [
            { key: 'company', path: '/settings/company', label: 'Perfil Comercial', icon: BriefcaseIcon, available: true },
            { key: 'fiscal_settings', path: '/settings/fiscal', label: 'Datos Fiscales', icon: ShieldIcon, available: true },
        ],
    },
    {
        key: 'appearance',
        label: 'Apariencia',
        sections: [
            { key: 'branding', path: '/settings/branding', label: 'Colores de Marca', icon: PaintBrushIcon, available: true },
        ],
    },
    {
        key: 'warehouse',
        label: 'Almacen',
        sections: [
            { key: 'warehouses', path: '/settings/warehouses', label: 'Bodegas', icon: WarehouseIcon, available: true, newAction: '/settings/warehouses/new', newLabel: 'Nueva Bodega' },
        ],
    },
    {
        key: 'fiscal_group',
        label: 'Fiscal',
        sections: [
            { key: 'taxes', path: '/settings/taxes', label: 'Impuestos', icon: PercentIcon, available: false },
            { key: 'sequences', path: '/settings/sequences', label: 'Secuencias', icon: HashIcon, available: false },
        ],
    },
];

// Flat array for quick lookup
const ALL_SECTIONS: Section[] = SECTION_GROUPS.flatMap(g => g.sections);

const SettingsPage: Component = () => {
    const matches = useMatches();

    // Derive the active section key from the current URL
    const activeSection = () => {
        const pathname = matches().at(-1)?.pathname ?? '';
        const section = ALL_SECTIONS.find(s => pathname.startsWith(s.path));
        return section?.key ?? 'company';
    };

    // Get the "new" action + label for the current section
    const currentNewAction = () => ALL_SECTIONS.find(s => s.key === activeSection())?.newAction;
    const currentNewLabel = () => ALL_SECTIONS.find(s => s.key === activeSection())?.newLabel;

    return (
        <div class="h-full flex flex-col bg-linear-to-br from-background via-background to-surface/20">
            {/* Header */}
            <div class="shrink-0 p-3 sm:p-4">
                <PageHeader
                    icon={<GearIcon />}
                    iconBg="linear-gradient(135deg, #6366f1, #4f46e5)"
                    title="Configuración General"
                    info="Gestiona las bodegas, ubicaciones y demás configuraciones del sistema."
                    actions={
                        <Show when={currentNewAction()}>
                            {(action) => (
                                <Button
                                    icon={<PlusIcon />}
                                    to={action()}
                                    preload="intent"
                                >
                                    <span class="hidden sm:inline">
                                        {currentNewLabel()}
                                    </span>
                                </Button>
                            )}
                        </Show>
                    }
                />
            </div>

            {/* ── Mobile: horizontal scrollable tabs ── */}
            <div class="flex-shrink-0 md:hidden px-3 pb-2 overflow-x-auto">
                <nav class="flex gap-1 min-w-max" role="tablist">
                    <For each={ALL_SECTIONS.filter(s => s.available)}>
                        {(section) => {
                            const Icon = section.icon;
                            return (
                                <Link
                                    to={section.path as any}
                                    preload="intent"
                                    role="tab"
                                    aria-selected={activeSection() === section.key}
                                    class={cn(
                                        'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all border',
                                        activeSection() === section.key
                                            ? 'bg-primary/10 text-primary border-primary/20 shadow-sm'
                                            : 'text-muted hover:bg-surface/50 hover:text-text border-transparent',
                                    )}
                                >
                                    <Icon class="size-3.5" />
                                    <span>{section.label}</span>
                                </Link>
                            );
                        }}
                    </For>
                </nav>
            </div>

            {/* ── Content: sidebar + main ── */}
            <div class="flex-1 min-h-0 px-3 pb-3 sm:px-4 sm:pb-4 flex gap-4 overflow-hidden">
                {/* ── Desktop: grouped vertical sidebar ── */}
                <nav class="hidden md:flex w-56 shrink-0 flex-col gap-0.5 overflow-y-auto pr-1">
                    <For each={SECTION_GROUPS}>
                        {(group) => (
                            <SidebarGroup
                                group={group}
                                activeSection={activeSection()}
                            />
                        )}
                    </For>
                </nav>

                {/* Main content — renders the active child route */}
                <div class="flex-1 min-w-0 overflow-y-auto rounded-2xl bg-card border border-border shadow-card-soft p-4 sm:p-6">
                    <Outlet />
                </div>
            </div>
        </div>
    );
};

// ── Sidebar Group (collapsible) ──
const SidebarGroup: Component<{ group: SectionGroup; activeSection: string }> = (props) => {
    // Groups with any active section start expanded, others start collapsed if all unavailable
    const hasActiveSectionInGroup = () =>
        props.group.sections.some(s => s.key === props.activeSection);
    const allUnavailable = () => props.group.sections.every(s => !s.available);

    const [isOpen, setIsOpen] = createSignal(
        allUnavailable() ? false : true
    );

    return (
        <div class="mb-1">
            {/* Group label — clickable to collapse */}
            <button
                type="button"
                onClick={() => setIsOpen(v => !v)}
                class={cn(
                    'w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-colors',
                    hasActiveSectionInGroup()
                        ? 'text-primary'
                        : 'text-muted hover:text-text',
                )}
            >
                <span>{props.group.label}</span>
                <ChevronDownIcon
                    class={cn(
                        'size-3 transition-transform duration-200',
                        !isOpen() && '-rotate-90',
                    )}
                />
            </button>

            {/* Section links */}
            <Show when={isOpen()}>
                <div class="flex flex-col gap-0.5 mt-0.5">
                    <For each={props.group.sections}>
                        {(section) => (
                            <SidebarItem
                                section={section}
                                isActive={props.activeSection === section.key}
                            />
                        )}
                    </For>
                </div>
            </Show>
        </div>
    );
};

// ── Sidebar Item ──
const SidebarItem: Component<{ section: Section; isActive: boolean }> = (props) => {
    const Icon = props.section.icon;

    if (!props.section.available) {
        return (
            <div class="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-muted/40 cursor-not-allowed select-none">
                <Icon class="size-4 shrink-0" />
                <span class="flex-1 truncate">{props.section.label}</span>
                <LockIcon class="size-3 shrink-0 opacity-40" />
            </div>
        );
    }

    return (
        <Link
            to={props.section.path as any}
            preload="intent"
            class={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-left',
                props.isActive
                    ? 'bg-on-primary text-primary font-semibold border border-on-primary/20 shadow-sm'
                    : 'text-text hover:bg-surface/50 hover:text-heading border border-transparent',
            )}
        >
            <Icon class="size-4 shrink-0" />
            <span class="flex-1 truncate">{props.section.label}</span>
        </Link>
    );
};

export default SettingsPage;
