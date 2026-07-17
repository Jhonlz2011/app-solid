import { ParentComponent } from 'solid-js';
import { Outlet } from '@tanstack/solid-router';
import { useBranding } from '../modules/auth/store/branding.store';

const AuthLayout: ParentComponent = () => {
    const branding = useBranding();

    return (
        <div 
            class="relative h-screen flex items-center justify-center bg-bg overflow-x-hidden overflow-y-auto transition-all duration-300"
            style={branding.tenant()?.loginBgUrl ? { 
                "background-image": `url(${branding.tenant()?.loginBgUrl})`,
                "background-size": "cover",
                "background-position": "center"
            } : undefined}
        >
            <Show when={branding.tenant()?.loginBgUrl}>
                <div class="absolute inset-0 bg-black/40 dark:bg-black/60 pointer-events-none z-0" />
            </Show>
            <div class="w-full max-w-xl p-4 max-h-screen relative z-10">
                <Outlet />
            </div>
        </div>
    );
};

export default AuthLayout;
