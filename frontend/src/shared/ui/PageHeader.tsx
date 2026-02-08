import { Component, JSX, Show } from 'solid-js';
import { Tooltip } from './Tooltip';
import { InfoIcon } from './icons';

interface PageHeaderProps {
    icon: JSX.Element;
    iconBg?: string;
    title: string;
    /** Total count to display in a pill badge */
    count?: number;
    /** Info tooltip content */
    info?: string;
    actions?: JSX.Element;
}

export const PageHeader: Component<PageHeaderProps> = (props) => (
    <div class="flex flex-col sm:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 class="text-3xl font-bold flex items-center gap-3">
                {/* Icon container with hover info overlay */}
                <Show
                    when={props.info}
                    fallback={
                        <div
                            class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                            style={{ background: props.iconBg ?? 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))' }}
                        >
                            {props.icon}
                        </div>
                    }
                >
                    <Tooltip content={props.info} placement="bottom">
                        <div
                            class="group relative w-10 h-10 rounded-xl flex items-center justify-center shrink-0 cursor-help"
                            style={{ background: props.iconBg ?? 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))' }}
                        >
                            {/* Main icon - visible by default, hidden on hover */}
                            <span class="transition-opacity duration-200 group-hover:opacity-0">
                                {props.icon}
                            </span>
                            {/* Info icon - hidden by default, visible on hover */}
                            <span class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-white">
                                <InfoIcon class="size-5" />
                            </span>
                        </div>
                    </Tooltip>
                </Show>

                <span>{props.title}</span>

                {/* Count pill */}
                <Show when={props.count !== undefined}>
                    <span class="px-2.5 py-0.5 text-sm font-semibold rounded-full bg-primary/15 text-primary">
                        {props.count?.toLocaleString()}
                    </span>
                </Show>
            </h1>
        </div>
        {props.actions && (
            <div class="flex items-center gap-2">
                {props.actions}
            </div>
        )}
    </div>
);

export default PageHeader;
