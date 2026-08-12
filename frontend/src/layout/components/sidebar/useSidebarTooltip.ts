import { createSignal, onCleanup } from 'solid-js';
import { useSidebar } from './SidebarContext';

export function useSidebarTooltip(tooltipId: string) {
    const { collapsed, activeTooltipId, setActiveTooltipId } = useSidebar();
    
    const [tooltipRect, setTooltipRect] = createSignal<{ top: number, left: number } | null>(null);
    let triggerRef: HTMLElement | undefined;
    let tooltipRef: HTMLElement | undefined;
    let hoverTimeout: ReturnType<typeof setTimeout>;

    const handleMouseEnter = () => {
        if (!collapsed()) return;
        clearTimeout(hoverTimeout);
        if (triggerRef) {
            const rect = triggerRef.getBoundingClientRect();
            setTooltipRect({ top: rect.top + rect.height / 2, left: rect.right + 12 });
        }
        setActiveTooltipId(tooltipId);
    };

    const handleMouseLeave = () => {
        if (!collapsed()) return;
        hoverTimeout = setTimeout(() => {
            if (activeTooltipId() === tooltipId) setActiveTooltipId(null);
        }, 150);
    };

    const cancelHide = () => clearTimeout(hoverTimeout);
    const hideTooltip = () => setActiveTooltipId(null);

    onCleanup(() => {
        clearTimeout(hoverTimeout);
    });

    const shouldShowTooltip = () => collapsed() && activeTooltipId() === tooltipId && tooltipRect() !== null;

    return {
        tooltipRect,
        setTriggerRef: (el: HTMLElement) => { triggerRef = el; },
        setTooltipRef: (el: HTMLElement) => { tooltipRef = el; },
        handleMouseEnter,
        handleMouseLeave,
        cancelHide,
        hideTooltip,
        shouldShowTooltip,
        getTooltipRef: () => tooltipRef,
        getTriggerRef: () => triggerRef
    };
}
