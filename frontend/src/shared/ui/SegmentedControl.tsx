import { Component, splitProps } from 'solid-js';
import { SegmentedControl as KSegmentedControl } from "@kobalte/core/segmented-control";
import { cn } from '../lib/utils';

// 1. ROOT
export const SegmentedControl: Component<Parameters<typeof KSegmentedControl>[0] & { class?: string }> = (props) => {
    const [local, others] = splitProps(props, ['class']);
    return (
        <KSegmentedControl 
            {...others}
            class={cn(
                "group/wrapper relative flex w-full sm:w-fit m-0 p-0 rounded-xl bg-card-alt ring-1 ring-inset ring-border/80 select-none",
                local.class
            )} 
        />
    );
};

// 2. INDICATOR
export const SegmentedControlIndicator: Component<Parameters<typeof KSegmentedControl.Indicator>[0] & { class?: string }> = (props) => {
    const [local, others] = splitProps(props, ['class']);
    return (
        <KSegmentedControl.Indicator 
            {...others}
            class={cn(
                "absolute z-0 bg-surface rounded-xl shadow-[0px_1px_3px_rgba(0,0,0,0.08),_0px_2px_8px_rgba(0,0,0,0.12)] ring-1 ring-inset ring-border-strong",
                "transition-[box-shadow,width,height,transform,opacity] duration-200 ease-in-out opacity-100",
                // Hide indicator if nothing is checked
                "group-not-has-[:checked]/wrapper:opacity-0",
                local.class
            )} 
        />
    );
};

// 3. ITEM ROOT
export const SegmentedControlItem: Component<Parameters<typeof KSegmentedControl.Item>[0] & { class?: string }> = (props) => {
    const [local, others] = splitProps(props, ['class']);
    return (
        <KSegmentedControl.Item 
            {...others}
            class={cn(
                "group/item relative z-10 flex flex-1 sm:flex-none cursor-pointer items-center justify-center outline-none transition-colors",
                // Micro-separators on the right of unselected items precisely positioned
                "after:absolute after:right-0 after:top-[0.563rem] after:bottom-[0.563rem] after:w-[1px] after:bg-border after:transition-opacity after:duration-200",
                "last:after:opacity-0", // No separator on the last item
                "data-[checked]:after:opacity-0", // No separator if this item is checked
                "has-[+_[data-checked]]:after:opacity-0", // No separator if the NEXT item is checked
                local.class
            )} 
        />
    );
};

// 4. ITEM INPUT
export const SegmentedControlItemInput: Component<Parameters<typeof KSegmentedControl.ItemInput>[0] & { class?: string }> = (props) => {
    // Kobalte natively suppresses this visually via sr-only 
    return <KSegmentedControl.ItemInput {...props} class={cn("peer/input", props.class)} />;
};

// 5. ITEM LABEL
export const SegmentedControlItemLabel: Component<Parameters<typeof KSegmentedControl.ItemLabel>[0] & { class?: string }> = (props) => {
    const [local, others] = splitProps(props, ['class']);
    return (
        <KSegmentedControl.ItemLabel 
            {...others} 
            class={cn(
                "relative z-10 flex w-full flex-nowrap items-center justify-center gap-1 cursor-pointer select-none rounded-xl font-medium leading-none",
                "px-4 py-[0.563rem] text-sm text-muted",
                "transition-[color,opacity] duration-200 ease-in-out",
                "peer-checked/input:text-heading",
                "peer-disabled/input:opacity-50 peer-disabled/input:cursor-not-allowed",
                "peer-[:not(:checked):not(:disabled)]/input:hover:opacity-75",
                local.class
            )} 
        />
    );
};
