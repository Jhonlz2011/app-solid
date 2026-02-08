import { Component, JSX, splitProps } from 'solid-js';
import { Tooltip as KobalteTooltip } from '@kobalte/core/tooltip';

interface TooltipProps {
    children: JSX.Element;
    content: JSX.Element | string;
    placement?: 'top' | 'right' | 'bottom' | 'left';
    delay?: number;
}

export const Tooltip: Component<TooltipProps> = (props) => {
    const [local, others] = splitProps(props, ['children', 'content', 'placement', 'delay']);

    return (
        <KobalteTooltip placement={local.placement ?? 'top'} openDelay={local.delay ?? 300} gutter={8}>
            <KobalteTooltip.Trigger as="span" class="inline-flex cursor-default">
                {local.children}
            </KobalteTooltip.Trigger>
            <KobalteTooltip.Portal>
                <KobalteTooltip.Content
                    class="z-50 px-3 py-2 text-sm rounded-lg shadow-lg max-w-xs
                           bg-surface border border-border text-text
                           animate-in fade-in-0 zoom-in-95
                           data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95"
                >
                    <KobalteTooltip.Arrow />
                    {local.content}
                </KobalteTooltip.Content>
            </KobalteTooltip.Portal>
        </KobalteTooltip>
    );
};

export default Tooltip;
