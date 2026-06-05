import { ParentComponent, onMount } from 'solid-js';
import { Outlet } from '@tanstack/solid-router';
import { brandingActions, useBranding } from '../modules/auth/store/branding.store';

const AuthLayout: ParentComponent = () => {
    const branding = useBranding();

    onMount(() => {
        brandingActions.loadBranding();
    });

    return (
        <div 
            class="h-screen flex items-center justify-center bg-bg overflow-hidden transition-all duration-500"
            style={branding.tenant()?.loginBgUrl ? { 
                "background-image": `url(${branding.tenant()?.loginBgUrl})`,
                "background-size": "cover",
                "background-position": "center"
            } : undefined}
        >
            <div class="w-full max-w-xl p-4 max-h-full overflow-y-auto">
                <Outlet />
            </div>
        </div>
    );
};

export default AuthLayout;
