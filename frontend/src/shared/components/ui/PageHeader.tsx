import { Component, JSX } from 'solid-js';

interface PageHeaderProps {
    icon: JSX.Element;
    iconBg?: string;
    title: string;
    subtitle?: string;
    actions?: JSX.Element;
}

export const PageHeader: Component<PageHeaderProps> = (props) => (
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
            <h1 class="text-2xl font-bold title-primary flex items-center gap-3">
                <div
                    class="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: props.iconBg ?? 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))' }}
                >
                    {props.icon}
                </div>
                {props.title}
            </h1>
            {props.subtitle && (
                <p class="text-muted text-sm mt-1 ml-13">{props.subtitle}</p>
            )}
        </div>
        {props.actions && (
            <div class="flex items-center gap-2">
                {props.actions}
            </div>
        )}
    </div>
);

export default PageHeader;
