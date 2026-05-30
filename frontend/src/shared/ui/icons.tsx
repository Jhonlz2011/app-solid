import { Component, JSX, splitProps } from 'solid-js';

export interface IconProps extends JSX.SvgSVGAttributes<SVGSVGElement> {
    class?: string;
    strokeWidth?: number; // Nueva propiedad para el grosor
}

const BaseIcon = (props: IconProps & { children: JSX.Element }) => {
    // Separamos 'class' y 'children' para manejarlos manualmente, el resto se pasa directo (...others)
    const [local, others] = splitProps(props, ['class', 'children', 'strokeWidth']);
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            class={local.class ?? 'size-5'}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width={local.strokeWidth ?? 2} stroke-linecap="round"
            stroke-linejoin="round"
            {...others}
        >
            {local.children}
        </svg>
    );
};


export const UserHistoryIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        {/* Cabeza del usuario, Cuerpo recortado, Reloj, Manecillas */}
        <path d="M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z M2 21v-2a4 4 0 0 1 4-4h3.5 M22 16a5 5 0 1 1-10 0 5 5 0 0 1 10 0z M17 13.5v2.5l1.5 1.5" />
    </BaseIcon>
);

export const UserMinusIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="22" x2="16" y1="11" y2="11" />
    </BaseIcon>
);

export const BriefcaseIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <rect x="2" y="7" width="20" height="14" rx="3" ry="3" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <line x1="2" y1="13" x2="22" y2="13" />
        <rect x="10" y="11" width="4" height="5" rx="1" />
    </BaseIcon>
);


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

export const InboxIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M7.2 4a2 2 0 0 0-1.8 1L2 12v6q.2 1.8 2 2h16q1.8-.2 2-2v-6l-3.4-7a2 2 0 0 0-1.8-1zm0 0h9.6a2 2 0 0 1 1.7 1.1L22 12H16l-2 3h-4l-2-3H2l3.5-6.8q.5-1 1.7-1m-5.1 8H8l2 3h4l2-3h6v6c0 1-1 2-2 2H4c-1 0-2-1-2-2z" />
    </BaseIcon>
);


export const ShelvesIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M4 2v20-2h16v2V2v2H4zm0 2h16v8h-8V9q0-1-1-1H9a1 1 0 0 0-1 1v3H4zm5 4h2q.9.1 1 1v3H8V9q.1-.9 1-1m-5 4h16v8h-4v-3q0-1-1-1h-2a1 1 0 0 0-1 1v3H4zm9 4h2q.9.1 1 1v3h-4v-3q.1-.9 1-1" />
    </BaseIcon>
);



export const SearchXIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        <path d="M7.5 7.5l5 5M12.5 7.5l-5 5" />
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
        <path d="M4 20L20 4M4 4l16 16" />
    </BaseIcon>
);

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


export const IdCardIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M13.5 8h-3" /><path d="m15 2-1 2h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3" /><path d="M16.899 22A5 5 0 0 0 7.1 22" /><path d="m9 2 3 6" /><circle cx="12" cy="15" r="3" />
    </BaseIcon>
);

export const UsersKeysIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M8.5 7a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z M2 18v-1a3 3 0 0 1 3-3h2a3 3 0 0 1 3 3v1 M13 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0z M9 11a2.5 2.5 0 0 1 2-1h2a2.5 2.5 0 0 1 2.5 2.5v1.5 M22 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0z M20 8v12 M20 16h2 M20 19h2" />
    </BaseIcon>
);

export const UserKeyIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        {/* User matching the exact style and thickness of UsersIcon */}
        <path d="M13 7a4 4 0 11-8 0 4 4 0 018 0z M15 21H3v-1a6 6 0 0112 0v1z" />
        {/* Key with consistent weight, solid stem and outline head (no inner circle overlapping stroke) */}
        <path d="M22 8a3 3 0 11-6 0 3 3 0 016 0z M19 11v10 M19 17h3 M19 21h3" />
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

// Location pin icon
export const MapPinIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
        <circle cx="12" cy="10" r="3" />
    </BaseIcon>
);

// Document/fiscal icon
export const FileTextIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
    </BaseIcon>
);
export const ScalesIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M12 3v18M19 8l3 8a5 5 0 0 1-6 0zV7" /><path d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1M5 8l3 8a5 5 0 0 1-6 0zV7M7 21h10" />
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

export const CopyIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </BaseIcon>
);

// Upload icon
export const UploadIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" x2="12" y1="3" y2="15" />
    </BaseIcon>
);

// Restore / undo action icon (counter-clockwise arrow)
export const RotateCcwIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
    </BaseIcon>
);

// Warning triangle (used for reference warnings in delete dialogs)
export const AlertTriangleIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
    </BaseIcon>
);


export const MoreVerticalIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <circle cx="12" cy="12" r="1" />
        <circle cx="12" cy="5" r="1" />
        <circle cx="12" cy="19" r="1" />
    </BaseIcon>
);

export const SparklesIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
        <path d="M5 3v4" />
        <path d="M19 17v4" />
        <path d="M3 5h4" />
        <path d="M17 19h4" />
    </BaseIcon>
);

// Catalog / hierarchy icons
export const FolderIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </BaseIcon>
);

export const FolderOpenIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />
    </BaseIcon>
);

export const TagIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M 7 1.75 C 6.3126052 1.75 5.75 2.3126052 5.75 3 L 5.75 9.171875 C 5.7501274 9.7684673 5.9882382 10.341881 6.4101562 10.763672 L 13.119141 17.472656 C 14.15362 18.515654 15.84638 18.515654 16.880859 17.472656 L 21.472656 12.880859 C 22.515654 11.84638 22.515654 10.15362 21.472656 9.1191406 L 14.763672 2.4101562 C 14.341881 1.988238 13.768467 1.7501274 13.171875 1.75 L 7 1.75 z M 7 2.25 L 13.171875 2.25 C 13.636062 2.2500991 14.081976 2.4353926 14.410156 2.7636719 L 21.119141 9.4726562 C 21.969253 10.315826 21.969253 11.684174 21.119141 12.527344 L 16.527344 17.119141 C 15.684174 17.969253 14.315826 17.969253 13.472656 17.119141 L 6.7636719 10.410156 C 6.4353926 10.081976 6.2500991 9.6360619 6.25 9.171875 L 6.25 3 C 6.25 2.5828253 6.5828253 2.25 7 2.25 z M 10.5 5.75 C 10.088748 5.75 9.75 6.0887476 9.75 6.5 C 9.75 6.9112524 10.088748 7.25 10.5 7.25 C 10.911252 7.25 11.25 6.9112524 11.25 6.5 C 11.25 6.0887476 10.911252 5.75 10.5 5.75 z M 2 6.75 A 0.25 0.25 0 0 0 1.75 7 L 1.75 13.171875 C 1.7501274 13.768467 1.9882381 14.341881 2.4101562 14.763672 L 9.1191406 21.472656 C 10.06707 22.427919 11.586427 22.519597 12.642578 21.685547 A 0.25 0.25 0 0 0 12.683594 21.333984 A 0.25 0.25 0 0 0 12.332031 21.292969 C 11.472237 21.971954 10.244348 21.896803 9.4726562 21.119141 L 2.7636719 14.410156 C 2.4353926 14.081976 2.2500991 13.636062 2.25 13.171875 L 2.25 7 A 0.25 0.25 0 0 0 2 6.75 z " />
    </BaseIcon>
);

export const Collapse: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M12 22v-6M12 8V2M4 12H2M10 12H8M16 12h-2M22 12h-2M15 19l-3-3-3 3M15 5l-3 3-3-3"/>
    </BaseIcon>
)

export const Expand: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M12 22v-6M12 8V2M4 12H2M10 12H8M16 12h-2M22 12h-2M15 19l-3 3-3-3M15 5l-3-3-3 3"/>
    </BaseIcon>
)

export const GripVerticalIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <circle cx="9" cy="12" r="1" /><circle cx="9" cy="5" r="1" /><circle cx="9" cy="19" r="1" />
        <circle cx="15" cy="12" r="1" /><circle cx="15" cy="5" r="1" /><circle cx="15" cy="19" r="1" />
    </BaseIcon>
);

export const WeightIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <circle cx="12" cy="5" r="3"/><path d="M6.5 8a2 2 0 0 0-2 1.5l-2.4 9A2 2 0 0 0 4 21h16a2 2 0 0 0 2-2.5l-2.6-9a2 2 0 0 0-2-1.5Z"/>
    </BaseIcon>
);

// ── Settings Module Icons ──

export const RulerIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0ZM14.5 12.5l2-2M11.5 9.5l2-2M8.5 6.5l2-2M17.5 15.5l2-2" />
    </BaseIcon>
);

export const LayersIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
        <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
        <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
    </BaseIcon>
);

export const SlidersIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <line x1="4" x2="4" y1="21" y2="14" />
        <line x1="4" x2="4" y1="10" y2="3" />
        <line x1="12" x2="12" y1="21" y2="12" />
        <line x1="12" x2="12" y1="8" y2="3" />
        <line x1="20" x2="20" y1="21" y2="16" />
        <line x1="20" x2="20" y1="12" y2="3" />
        <line x1="2" x2="6" y1="14" y2="14" />
        <line x1="10" x2="14" y1="8" y2="8" />
        <line x1="18" x2="22" y1="16" y2="16" />
    </BaseIcon>
);

export const ArrowUpAZIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
    <path d="m3 8 4-4 4 4"/><path d="M7 4v16"/><path d="M20 8h-5"/><path d="M15 10V6.5a2.5 2.5 0 0 1 5 0V10"/><path d="M15 14h5l-5 6h5"/>
    </BaseIcon>
);

export const ArrowDownZAIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
   <path d="m3 16 4 4 4-4"/><path d="M7 4v16"/><path d="M15 4h5l-5 6h5"/><path d="M15 20v-3.5a2.5 2.5 0 0 1 5 0V20"/><path d="M20 18h-5"/>
    </BaseIcon>
);

export const LayoutIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
      <rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>
    </BaseIcon>
);

export const WarehouseIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M 12.000977 1.9379883 C 11.676223 1.9380674 11.351527 2.01488 11.054688 2.1679688 L 11.052734 2.1679688 L 3.1035156 6.140625 C 2.3903631 6.4848164 1.9370351 7.2080438 1.9375 8 L 1.9375 19 C 1.9375 20.138347 2.861653 21.0625 4 21.0625 L 6 21.0625 L 18 21.0625 L 20 21.0625 C 21.138347 21.0625 22.0625 20.138347 22.0625 19 L 22.0625 8 C 22.062775 7.2073051 21.608871 6.4842582 20.894531 6.140625 L 12.947266 2.1679688 C 12.650541 2.0145637 12.32573 1.9379092 12.000977 1.9379883 z M 12.000977 2.0629883 C 12.306259 2.0629883 12.611542 2.1350123 12.890625 2.2792969 L 20.839844 6.2519531 A 0.06250625 0.06250625 0 0 0 20.839844 6.2539062 C 21.511092 6.5768354 21.937758 7.2550728 21.9375 8 L 21.9375 19 C 21.9375 20.070792 21.070792 20.9375 20 20.9375 L 18.0625 20.9375 L 18.0625 17 L 18.0625 13 L 18.0625 10 C 18.0625 9.4139377 17.586062 8.9375 17 8.9375 L 7 8.9375 C 6.4139377 8.9375 5.9375 9.4139377 5.9375 10 L 5.9375 13 L 5.9375 17 L 5.9375 20.9375 L 4 20.9375 C 2.929208 20.9375 2.0625 20.070792 2.0625 19 L 2.0625 8 C 2.0620628 7.2552928 2.4872867 6.5771091 3.1582031 6.2539062 A 0.06250625 0.06250625 0 0 0 3.1601562 6.2519531 L 11.109375 2.2792969 A 0.06250625 0.06250625 0 0 0 11.111328 2.2792969 C 11.390412 2.1350123 11.695694 2.0629883 12.000977 2.0629883 z M 7 9.0625 L 17 9.0625 C 17.518507 9.0625 17.9375 9.4814928 17.9375 10 L 17.9375 12.9375 L 6.0625 12.9375 L 6.0625 10 C 6.0625 9.4814928 6.4814928 9.0625 7 9.0625 z M 6.0625 13.0625 L 17.9375 13.0625 L 17.9375 16.9375 L 6.0625 16.9375 L 6.0625 13.0625 z M 6.0625 17.0625 L 17.9375 17.0625 L 17.9375 20.9375 L 6.0625 20.9375 L 6.0625 17.0625 z" />
    </BaseIcon>
);

export const PercentIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <line x1="19" x2="5" y1="5" y2="19" />
        <circle cx="6.5" cy="6.5" r="2.5" />
        <circle cx="17.5" cy="17.5" r="2.5" />
    </BaseIcon>
);

export const HashIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <line x1="4" x2="20" y1="9" y2="9" />
        <line x1="4" x2="20" y1="15" y2="15" />
        <line x1="10" x2="8" y1="3" y2="21" />
        <line x1="16" x2="14" y1="3" y2="21" />
    </BaseIcon>
);

export const BeakerIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M21 7 6.8 21.2a3 3 0 0 1-4 0 3 3 0 0 1 0-4L17 3M16 2l6 6M12 16H4" />
    </BaseIcon>
);

export const GridIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="m12 8 6-3-6-3v10M8 12 2.5 15a1 1 0 0 0 0 1.8l8.5 4.8a2 2 0 0 0 2 0l8.5-4.8a1 1 0 0 0 0-1.8L16 12M6.5 12.9l11 6.2M17.5 12.9 6.5 19" />
    </BaseIcon>
);

export const BookmarkIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M7 3a2 2 0 0 0-2 2v15a1 1 0 0 0 1.5.9l4.5-2.6a2 2 0 0 1 2 0l4.5 2.6A1 1 0 0 0 19 20V5a2 2 0 0 0-2-2zm0 0h10a2 2 0 0 1 2 2v15a1 1 0 0 1-1.5.9L13 18.3a2 2 0 0 0-2 0l-4.5 2.6A1 1 0 0 1 5 20V5q.2-1.8 2-2" />
    </BaseIcon>
);

export const BoxIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="m3.3 7 8.7 5 8.7-5" />
        <path d="M12 22V12" />
    </BaseIcon>
);

export const ClockIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
    </BaseIcon>
);

export const ThermometerIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" />
    </BaseIcon>
);

export const DatabaseIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5V19A9 3 0 0 0 21 19V5" />
        <path d="M3 12A9 3 0 0 0 21 12" />
    </BaseIcon>
);

export const LockIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </BaseIcon>
);