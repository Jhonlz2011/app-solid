import { Component, ParentComponent, splitProps, type ComponentProps } from 'solid-js';
import { SegmentedControl as KSegmentedControl } from "@kobalte/core/segmented-control";
import type { 
    SegmentedControlRootProps, 
    SegmentedControlIndicatorProps, 
    SegmentedControlItemProps, 
    SegmentedControlItemInputProps
} from "@kobalte/core/segmented-control";
import { cn } from '../lib/utils';

// Kobalte has a package export bug where SegmentedControlItemLabelProps is not exported directly.
// We extract it elegantly using SolidJS ComponentProps to preserve 100% strict type safety.
type SegmentedControlItemLabelProps = ComponentProps<typeof KSegmentedControl.ItemLabel>;

// 1. ROOT (Accepts children, uses Tailwind CSS v4 container query responsive @sm:)
export const SegmentedControl: ParentComponent<SegmentedControlRootProps & { class?: string }> = (props) => {
    const [local, others] = splitProps(props, ['class']);
    return (
        <KSegmentedControl 
            {...others}
            class={cn(
                "group relative flex w-full @sm:w-fit m-0 p-0 rounded-xl bg-card-alt ring-1 ring-inset ring-border/80 select-none",
                local.class
            )} 
        />
    );
};

// 2. INDICATOR (Self-closing)
export const SegmentedControlIndicator: Component<SegmentedControlIndicatorProps & { class?: string }> = (props) => {
    const [local, others] = splitProps(props, ['class']);
    return (
        <KSegmentedControl.Indicator 
            {...others}
            class={cn(
                "absolute z-0 bg-surface rounded-xl shadow-[0px_1px_3px_rgba(0,0,0,0.08),_0px_2px_8px_rgba(0,0,0,0.12)] ring-1 ring-inset ring-border-strong",
                "transition-[box-shadow,width,height,transform,opacity] duration-200 ease-in-out opacity-100",
                // Hide indicator if nothing is checked
                "group-[&:not(:has(:checked))]:opacity-0",
                local.class
            )} 
        />
    );
};

// 3. ITEM ROOT (Accepts children, stretches to equal flex-1 to perfectly fill the container)
export const SegmentedControlItem: ParentComponent<SegmentedControlItemProps & { class?: string }> = (props) => {
    const [local, others] = splitProps(props, ['class']);
    return (
        <KSegmentedControl.Item 
            {...others}
            class={cn(
                "group/item relative z-10 flex flex-1 cursor-pointer items-center justify-center outline-none transition-colors",
                // Micro-separators on the right of unselected items precisely positioned
                "after:absolute after:right-0 after:top-[0.563rem] after:bottom-[0.563rem] after:w-px after:bg-border after:transition-opacity after:duration-200",
                "last:after:opacity-0", // No separator on the last item
                "data-checked:after:opacity-0", // No separator if this item is checked
                "has-[+_[data-checked]]:after:opacity-0", // No separator if the NEXT item is checked
                local.class
            )} 
        />
    );
};

// 4. ITEM INPUT (Self-closing)
export const SegmentedControlItemInput: Component<SegmentedControlItemInputProps & { class?: string }> = (props) => {
    // Kobalte natively suppresses this visually via sr-only 
    return <KSegmentedControl.ItemInput {...props} class={cn("peer", props.class)} />;
};

// 5. ITEM LABEL (Accepts children)
export const SegmentedControlItemLabel: ParentComponent<SegmentedControlItemLabelProps & { class?: string }> = (props) => {
    const [local, others] = splitProps(props, ['class']);
    return (
        <KSegmentedControl.ItemLabel 
            {...others} 
            class={cn(
                "relative z-10 flex w-full flex-nowrap items-center justify-center gap-1 cursor-pointer select-none rounded-xl font-medium leading-none",
                "px-4 py-[0.563rem] text-sm text-muted",
                "transition-[color,opacity] duration-200 ease-in-out",
                "peer-checked:text-heading",
                "peer-disabled:opacity-50 peer-disabled:cursor-not-allowed",
                "peer-hover:opacity-75 peer-checked:hover:opacity-100",
                local.class
            )} 
        />
    );
};
