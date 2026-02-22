import { Component, JSX, splitProps } from 'solid-js';
import { Popover as KobaltePopover } from '@kobalte/core/popover';
import { cn } from '../lib/utils';

// ============================================================================
// Popover - Styled wrapper around Kobalte's Popover
// Compound component pattern matching DropdownMenu.tsx
// ============================================================================

interface PopoverProps {
    children: JSX.Element;
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    placement?: 'top' | 'bottom' | 'left' | 'right' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';
    gutter?: number;
}

interface PopoverTriggerProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
    children: JSX.Element;
    class?: string;
}

interface PopoverContentProps {
    children: JSX.Element;
    class?: string;
}

// Root
const Root: Component<PopoverProps> = (props) => {
    const [local, others] = splitProps(props, ['children', 'placement', 'gutter']);
    return (
        <KobaltePopover
            placement={local.placement ?? 'bottom-start'}
            gutter={local.gutter ?? 4}
            {...others}
        >
            {local.children}
        </KobaltePopover>
    );
};

// Trigger
const Trigger: Component<PopoverTriggerProps> = (props) => {
    const [local, others] = splitProps(props, ['children', 'class']);
    return (
        <KobaltePopover.Trigger
            class={cn(
                'inline-flex items-center justify-center transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                'disabled:pointer-events-none disabled:opacity-50',
                local.class
            )}
            {...others}
        >
            {local.children}
        </KobaltePopover.Trigger>
    );
};

// Content
const Content: Component<PopoverContentProps> = (props) => {
    const [local, others] = splitProps(props, ['children', 'class']);
    return (
        <KobaltePopover.Portal>
            <KobaltePopover.Content
                class={cn(
                    'z-50 overflow-hidden rounded-xl',
                    'bg-card border border-border shadow-card-soft',
                    'origin-[var(--kb-popover-content-transform-origin)]',
                    'animate-in fade-in-0 zoom-in-95 data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95',
                    'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
                    'data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2',
                    local.class
                )}
                {...others}
            >
                {local.children}
            </KobaltePopover.Content>
        </KobaltePopover.Portal>
    );
};

// Export compound component
export const Popover = Object.assign(Root, {
    Trigger,
    Content,
});

export default Popover;
