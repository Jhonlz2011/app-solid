import { ParentComponent } from 'solid-js';
import { Outlet } from '@tanstack/solid-router';
import { useBranding } from '../modules/auth/store/branding.store';

const AuthLayout: ParentComponent = () => {
    const branding = useBranding();

    return (
        <div 
            class="h-screen flex items-center justify-center bg-bg overflow-hidden transition-all duration-300 overflow-y-auto"
            style={branding.tenant()?.loginBgUrl ? { 
                "background-image": `url(${branding.tenant()?.loginBgUrl})`,
                "background-size": "cover",
                "background-position": "center"
            } : undefined}
        >
            <div class="w-full max-w-2xl p-4 max-h-screen">
                <Outlet />
            </div>
        </div>
    );
};

export default AuthLayout;
