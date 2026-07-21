import { ParentComponent, Show } from 'solid-js';
import { Outlet } from '@tanstack/solid-router';
import { useBranding } from '../modules/auth/store/branding.store';

const AuthLayout: ParentComponent = () => {
    const branding = useBranding();

    return (
        <div 
            class="relative min-h-screen flex items-center justify-center bg-bg overflow-x-hidden overflow-y-auto transition-all duration-300"
            style={branding.tenant()?.loginBgUrl ? { 
                "background-image": `url(${branding.tenant()?.loginBgUrl})`,
                "background-size": "cover",
                "background-position": "center"
            } : undefined}
        >
            {/* Gradient overlay for background images */}
            <Show when={branding.tenant()?.loginBgUrl}>
                <div 
                    class="absolute inset-0 pointer-events-none z-0"
                    style={{
                        "background": "radial-gradient(ellipse at center, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.65) 100%)"
                    }}
                />
            </Show>

            {/* Decorative background when no loginBgUrl */}
            <Show when={!branding.tenant()?.loginBgUrl}>
                <div class="absolute inset-0 pointer-events-none z-0 overflow-hidden">
                    {/* Subtle radial tint from primary color */}
                    <div 
                        class="absolute inset-0 opacity-[0.04]"
                        style={{
                            "background": "radial-gradient(ellipse 80% 50% at 50% 40%, var(--primary, #1f86c2), transparent)"
                        }}
                    />
                    {/* Decorative orb — top right */}
                    <div 
                        class="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-[0.045] blur-3xl"
                        style={{ "background": "var(--primary, #1f86c2)" }}
                    />
                    {/* Decorative orb — bottom left */}
                    <div 
                        class="absolute -bottom-24 -left-24 w-80 h-80 rounded-full opacity-[0.03] blur-3xl"
                        style={{ "background": "var(--primary, #1f86c2)" }}
                    />
                </div>
            </Show>

            {/* Main content */}
            <div class="w-full max-w-xl px-4 py-8 relative z-10">
                <Outlet />
            </div>

            {/* Subtle platform branding */}
            <div class="absolute bottom-3 left-0 right-0 z-10 flex justify-center pointer-events-none">
                <span class="text-[11px] text-muted/45 tracking-wide select-none pointer-events-auto">
                    Powered by{' '}
                    <a 
                        href="https://zelys.app" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        class="hover:text-muted/50 transition-colors duration-200"
                    >
                        zelys.app
                    </a>
                </span>
            </div>
        </div>
    );
};

export default AuthLayout;
