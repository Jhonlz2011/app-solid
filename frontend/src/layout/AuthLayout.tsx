import { ParentComponent } from 'solid-js';
import { Outlet } from '@tanstack/solid-router';

const AuthLayout: ParentComponent = () => {
    return (
        <div class="min-h-screen flex items-center justify-center bg-background p-4">
            <div class="w-full max-w-md">
                <Outlet />
            </div>
        </div>
    );
};

export default AuthLayout;
