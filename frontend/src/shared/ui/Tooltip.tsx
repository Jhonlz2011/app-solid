import { Component, JSX, splitProps, Show, createSignal, onMount } from 'solid-js';
import { Tooltip as KobalteTooltip } from '@kobalte/core/tooltip';
import { Popover as KobaltePopover } from '@kobalte/core/popover';

interface TooltipProps {
    children: JSX.Element;
    content?: JSX.Element | string | null;
    placement?: 'top' | 'top-start' | 'top-end' | 'right' | 'right-start' | 'right-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'left' | 'left-start' | 'left-end';
    delay?: number;
    skipDelayDuration?: number;
    gutter?: number;
    triggerMode?: 'hover' | 'click' | 'responsive';
}

export const Tooltip: Component<TooltipProps> = (props) => {
    const [local, others] = splitProps(props, ['children', 'content', 'placement', 'delay', 'skipDelayDuration', 'gutter', 'triggerMode']);

    const [isHoverable, setIsHoverable] = createSignal(true); // Asumimos escritorio por defecto

    onMount(() => {
        // Detecta si el dispositivo principal tiene capacidad de hacer hover (ratón) vs touch
        setIsHoverable(window.matchMedia('(hover: hover)').matches);
    });

    const activeMode = () => {
        if (local.triggerMode === 'click') return 'click';
        if (local.triggerMode === 'hover') return 'hover';
        return isHoverable() ? 'hover' : 'click'; // 'responsive' por defecto
    };

    const contentClasses = "z-[100] px-3 py-2 text-sm rounded-lg shadow-lg max-w-xs bg-surface border border-border text-text animate-in fade-in-0 zoom-in-95 data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95";

    return (
        <Show when={local.content} fallback={local.children}>
            <Show 
                when={activeMode() === 'click'}
                fallback={
                    <KobalteTooltip 
                        placement={local.placement ?? 'top'} 
                        openDelay={local.delay ?? 100} 
                        skipDelayDuration={local.skipDelayDuration ?? 0}
                        gutter={local.gutter ?? 0}
                    >
                        <KobalteTooltip.Trigger as="span" class="inline-flex cursor-default">
                            {local.children}
                        </KobalteTooltip.Trigger>
                        <KobalteTooltip.Portal>
                            <KobalteTooltip.Content class={contentClasses}>
                                <KobalteTooltip.Arrow />
                                {local.content}
                            </KobalteTooltip.Content>
                        </KobalteTooltip.Portal>
                    </KobalteTooltip>
                }
            >
                <KobaltePopover placement={local.placement ?? 'top'} gutter={local.gutter ?? 0}>
                    <KobaltePopover.Trigger as="span" class="inline-flex cursor-pointer">
                        {local.children}
                    </KobaltePopover.Trigger>
                    <KobaltePopover.Portal>
                        <KobaltePopover.Content class={contentClasses}>
                            <KobaltePopover.Arrow />
                            {local.content}
                        </KobaltePopover.Content>
                    </KobaltePopover.Portal>
                </KobaltePopover>
            </Show>
        </Show>
    );
};

export default Tooltip;
