import { ParentComponent } from 'solid-js';
import { Outlet } from '@tanstack/solid-router';

const AuthLayout: ParentComponent = () => {
    return (
        // Fixed: h-screen instead of min-h-screen prevents unwanted scroll
        // overflow-hidden ensures no scroll appears
        // overflow-y-auto on inner container allows scroll only if content grows
        <div class="h-screen flex items-center justify-center bg-background overflow-hidden">
            <div class="w-full max-w-md p-4 max-h-full">
                <Outlet />
            </div>
        </div>
    );
};

export default AuthLayout;
