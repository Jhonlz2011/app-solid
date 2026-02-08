import { Component, JSX, splitProps } from 'solid-js';
import { DropdownMenu as KobalteDropdownMenu } from '@kobalte/core/dropdown-menu';
import { cn } from '../lib/utils';

// ============================================================================
// DropdownMenu - Styled wrapper around Kobalte's DropdownMenu
// Based on Kobalte's new API where DropdownMenu is the root (no .Root needed)
// Colors use Tailwind v4 design tokens from index.css
// ============================================================================

interface DropdownMenuProps {
    children: JSX.Element;
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    placement?: 'top' | 'bottom' | 'left' | 'right' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';
    gutter?: number;
}

interface DropdownMenuTriggerProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
    children: JSX.Element;
    class?: string;
    asChild?: boolean;
}

interface DropdownMenuContentProps {
    children: JSX.Element;
    class?: string;
}

interface DropdownMenuItemProps {
    children: JSX.Element;
    class?: string;
    onSelect?: () => void;
    disabled?: boolean;
    destructive?: boolean;
}

interface DropdownMenuSeparatorProps {
    class?: string;
}

interface DropdownMenuLabelProps {
    children: JSX.Element;
    class?: string;
}

interface DropdownMenuGroupProps {
    children: JSX.Element;
    class?: string;
}

// Root component - wraps Kobalte's DropdownMenu
const Root: Component<DropdownMenuProps> = (props) => {
    const [local, others] = splitProps(props, ['children', 'placement', 'gutter']);
    return (
        <KobalteDropdownMenu
            placement={local.placement ?? 'bottom-start'}
            gutter={local.gutter ?? 4}
            {...others}
        >
            {local.children}
        </KobalteDropdownMenu>
    );
};

// Trigger component
const Trigger: Component<DropdownMenuTriggerProps> = (props) => {
    const [local, others] = splitProps(props, ['children', 'class', 'asChild']);
    return (
        <KobalteDropdownMenu.Trigger
            class={cn(
                'inline-flex items-center justify-center gap-1 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2',
                'disabled:pointer-events-none disabled:opacity-50',
                local.class
            )}
            {...others}
        >
            {local.children}
        </KobalteDropdownMenu.Trigger>
    );
};

// Content component with portal and animations
const Content: Component<DropdownMenuContentProps> = (props) => {
    const [local, others] = splitProps(props, ['children', 'class']);
    return (
        <KobalteDropdownMenu.Portal>
            <KobalteDropdownMenu.Content
                class={cn(
                    // Base styles
                    'z-50 min-w-[8rem] overflow-hidden rounded-xl p-1',
                    // Background and border - using design tokens
                    'bg-card border border-border shadow-card-soft',
                    // Animation
                    'origin-[var(--kb-menu-content-transform-origin)]',
                    'animate-in fade-in-0 zoom-in-95 data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95',
                    'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
                    'data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2',
                    local.class
                )}
                {...others}
            >
                {local.children}
            </KobalteDropdownMenu.Content>
        </KobalteDropdownMenu.Portal>
    );
};

// Item component
const Item: Component<DropdownMenuItemProps> = (props) => {
    const [local, others] = splitProps(props, ['children', 'class', 'onSelect', 'disabled', 'destructive']);
    return (
        <KobalteDropdownMenu.Item
            class={cn(
                // Base styles
                'relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-none transition-colors',
                // Normal state - text color
                'text-text',
                // Hover/Focus state - using card-alt for visibility
                'focus:bg-card-alt data-[highlighted]:bg-card-alt',
                // Disabled state
                'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                // Destructive variant - using danger semantic colors
                local.destructive && 'text-danger focus:bg-danger-bg data-[highlighted]:bg-danger-bg',
                local.class
            )}
            onSelect={local.onSelect}
            disabled={local.disabled}
            {...others}
        >
            {local.children}
        </KobalteDropdownMenu.Item>
    );
};

// Separator component
const Separator: Component<DropdownMenuSeparatorProps> = (props) => {
    return (
        <KobalteDropdownMenu.Separator
            class={cn('-mx-1 my-1 h-px text-border', props.class)}
        />
    );
};

// Group component - required for GroupLabel
const Group: Component<DropdownMenuGroupProps> = (props) => {
    const [local, others] = splitProps(props, ['children', 'class']);
    return (
        <KobalteDropdownMenu.Group class={local.class} {...others}>
            {local.children}
        </KobalteDropdownMenu.Group>
    );
};

// GroupLabel component - must be inside a Group
const GroupLabel: Component<DropdownMenuLabelProps> = (props) => {
    const [local, others] = splitProps(props, ['children', 'class']);
    return (
        <KobalteDropdownMenu.GroupLabel
            class={cn('px-2 py-1.5 text-xs font-semibold text-muted uppercase tracking-wider', local.class)}
            {...others}
        >
            {local.children}
        </KobalteDropdownMenu.GroupLabel>
    );
};

// Simple Label component - standalone, no Group context required
const Label: Component<DropdownMenuLabelProps> = (props) => {
    const [local, others] = splitProps(props, ['children', 'class']);
    return (
        <div
            class={cn('px-2 py-1.5 text-xs font-semibold text-muted uppercase tracking-wider', local.class)}
            {...others}
        >
            {local.children}
        </div>
    );
};

// Icon wrapper for menu items
interface DropdownMenuIconProps {
    children: JSX.Element;
    class?: string;
}

const Icon: Component<DropdownMenuIconProps> = (props) => (
    <span class={cn('size-4 text-muted', props.class)}>
        {props.children}
    </span>
);

// Export compound component
export const DropdownMenu = Object.assign(Root, {
    Trigger,
    Content,
    Item,
    Separator,
    Group,
    GroupLabel,
    Label,
    Icon,
});

export default DropdownMenu;
