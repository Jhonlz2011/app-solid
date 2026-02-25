import { Component, JSX, splitProps } from 'solid-js';

export interface IconProps extends JSX.SvgSVGAttributes<SVGSVGElement> {
    class?: string;
}


const BaseIcon = (props: IconProps & { children: JSX.Element }) => {
    // Separamos 'class' y 'children' para manejarlos manualmente, el resto se pasa directo (...others)
    const [local, others] = splitProps(props, ['class', 'children']);

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            class={local.class ?? 'size-5'}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            {...others}
        >
            {local.children}
        </svg>
    );
};

export const ChevronsUpDownIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="m7 15 5 5 5-5" />
        <path d="m7 9 5-5 5 5" />
    </BaseIcon>
);

// Common action icons
export const PlusIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M12 4v16m8-8H4" />
    </BaseIcon>
);

export const EditIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </BaseIcon>
);

export const TrashIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </BaseIcon>
);

export const CloseIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M6 18L18 6M6 6l12 12" />
    </BaseIcon>
);

export const SearchIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </BaseIcon>
);

export const FloppyDiskIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
        <polyline points="17 21 17 13 7 13 7 21" />
        <polyline points="7 3 7 8 15 8" />
    </BaseIcon>
);

// Navigation icons
export const ChevronDownIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M19 9l-7 7-7-7" />
    </BaseIcon>
);

export const ChevronLeftIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M15 19l-7-7 7-7" />
    </BaseIcon>
);

export const ChevronRightIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M9 5l7 7-7 7" />
    </BaseIcon>
);

export const ChevronsLeftIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
    </BaseIcon>
);

export const ChevronsRightIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M13 5l7 7-7 7M5 5l7 7-7 7" />
    </BaseIcon>
);

export const ColumnsIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
    </BaseIcon>
);

export const FilterIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </BaseIcon>
);

// Entity icons
export const UsersIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </BaseIcon>
);

export const ProductIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </BaseIcon>
);

// Security icons
export const ShieldIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </BaseIcon>
);

export const KeyIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </BaseIcon>
);

// Status icons
export const CheckIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M5 13l4 4L19 7" />
    </BaseIcon>
);

export const XIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M6 18L18 6M6 6l12 12" />
    </BaseIcon>
);

// Sidebar specific icons
export const UserIcon: Component<IconProps> = (props) => (
    <BaseIcon class="size-4" {...props}>
        <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </BaseIcon>
);

export const LogoutIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </BaseIcon>
);

export const SidebarCollapseIcon: Component<IconProps> = (props) => (
    <BaseIcon stroke="none" fill="currentColor" viewBox="0 0 20 20" {...props}>
        <path d="M6.83496 3.99992C6.38353 4.00411 6.01421 4.0122 5.69824 4.03801C5.31232 4.06954 5.03904 4.12266 4.82227 4.20012L4.62207 4.28606C4.18264 4.50996 3.81498 4.85035 3.55859 5.26848L3.45605 5.45207C3.33013 5.69922 3.25006 6.01354 3.20801 6.52824C3.16533 7.05065 3.16504 7.71885 3.16504 8.66301V11.3271C3.16504 12.2712 3.16533 12.9394 3.20801 13.4618C3.25006 13.9766 3.33013 14.2909 3.45605 14.538L3.55859 14.7216C3.81498 15.1397 4.18266 15.4801 4.62207 15.704L4.82227 15.79C5.03904 15.8674 5.31234 15.9205 5.69824 15.9521C6.01398 15.9779 6.383 15.986 6.83398 15.9902L6.83496 3.99992ZM18.165 11.3271C18.165 12.2493 18.1653 12.9811 18.1172 13.5702C18.0745 14.0924 17.9916 14.5472 17.8125 14.9648L17.7295 15.1415C17.394 15.8 16.8834 16.3511 16.2568 16.7353L15.9814 16.8896C15.5157 17.1268 15.0069 17.2285 14.4102 17.2773C13.821 17.3254 13.0893 17.3251 12.167 17.3251H7.83301C6.91071 17.3251 6.17898 17.3254 5.58984 17.2773C5.06757 17.2346 4.61294 17.1508 4.19531 16.9716L4.01855 16.8896C3.36014 16.5541 2.80898 16.0434 2.4248 15.4169L2.27051 15.1415C2.03328 14.6758 1.93158 14.167 1.88281 13.5702C1.83468 12.9811 1.83496 12.2493 1.83496 11.3271V8.66301C1.83496 7.74072 1.83468 7.00898 1.88281 6.41985C1.93157 5.82309 2.03329 5.31432 2.27051 4.84856L2.4248 4.57317C2.80898 3.94666 3.36012 3.436 4.01855 3.10051L4.19531 3.0175C4.61285 2.83843 5.06771 2.75548 5.58984 2.71281C6.17898 2.66468 6.91071 2.66496 7.83301 2.66496H12.167C13.0893 2.66496 13.821 2.66468 14.4102 2.71281C15.0069 2.76157 15.5157 2.86329 15.9814 3.10051L16.2568 3.25481C16.8833 3.63898 17.394 4.19012 17.7295 4.84856L17.8125 5.02531C17.9916 5.44285 18.0745 5.89771 18.1172 6.41985C18.1653 7.00898 18.165 7.74072 18.165 8.66301V11.3271ZM8.16406 15.995H12.167C13.1112 15.995 13.7794 15.9947 14.3018 15.9521C14.8164 15.91 15.1308 15.8299 15.3779 15.704L15.5615 15.6015C15.9797 15.3451 16.32 14.9774 16.5439 14.538L16.6299 14.3378C16.7074 14.121 16.7605 13.8478 16.792 13.4618C16.8347 12.9394 16.835 12.2712 16.835 11.3271V8.66301C16.835 7.71885 16.8347 7.05065 16.792 6.52824C16.7605 6.14232 16.7073 5.86904 16.6299 5.65227L16.5439 5.45207C16.32 5.01264 15.9796 4.64498 15.5615 4.3886L15.3779 4.28606C15.1308 4.16013 14.8165 4.08006 14.3018 4.03801C13.7794 3.99533 13.1112 3.99504 12.167 3.99504H8.16406C8.16407 3.99667 8.16504 3.99829 8.16504 3.99992L8.16406 15.995Z" />
    </BaseIcon>
);

// Form icons
export const AlertCircleIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </BaseIcon>
);

export const WarningIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </BaseIcon>
);

export const EyeIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </BaseIcon>
);

export const EyeOffIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </BaseIcon>
);

export const DeviceIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </BaseIcon>
);

// Table column header icons
export const ArrowUpIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M5 15l7-7 7 7" />
    </BaseIcon>
);

export const ArrowDownIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M19 9l-7 7-7-7" />
    </BaseIcon>
);

export const PinOffIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <line x1="2" x2="22" y1="2" y2="22" />
        <line x1="12" x2="12" y1="17" y2="22" />
        <path d="M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h12" />
        <path d="M15 9.34V6h1a2 2 0 0 0 0-4H7.89" />
    </BaseIcon>
);

// Pin icon (thumbtack style)
export const PinIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <line x1="12" x2="12" y1="17" y2="22" />
        <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
    </BaseIcon>
);

// Info icon
export const InfoIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </BaseIcon>
);



// Download icon
export const DownloadIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" x2="12" y1="15" y2="3" />
    </BaseIcon>
);