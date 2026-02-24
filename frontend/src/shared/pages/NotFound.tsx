import { Component } from 'solid-js';
import { useNavigate } from '@tanstack/solid-router';
import Button from '@shared/ui/Button';

const NotFound: Component = () => {
    const navigate = useNavigate();

    const HomeIcon = () => (
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
    );

    const BackIcon = () => (
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
        </svg>
    );

    // Shared style for the gradient "4" digits
    const digitClass = "text-[9rem] sm:text-[12rem] font-black leading-[0.7] tracking-tighter bg-gradient-to-br from-primary to-primary-strong bg-clip-text [-webkit-text-fill-color:transparent] select-none";

    return (
        <div class="h-screen flex items-center justify-center bg-background overflow-hidden px-4">
            <div class="text-center max-w-lg space-y-8">
                {/* 4 😞 4 — the face replaces the "0" */}
                <div class="flex items-center justify-center gap-2 sm:gap-3">
                    <span class={digitClass}>4</span>

                    {/* Sad face replacing the "0" */}
                    <div class="relative flex items-center justify-center shrink-0">
                        <div class="absolute size-36 sm:size-44 rounded-full bg-primary/20 blur-2xl" />
                        <div
                            class="relative size-24 sm:size-32 rounded-full flex items-center justify-center border-3 bg-gradient-to-br from-card to-surface"
                            style={{
                                'border-color': 'color-mix(in srgb, var(--color-primary) 35%, var(--color-border))',
                                'box-shadow': '0 8px 32px color-mix(in srgb, var(--color-primary) 15%, transparent)',
                            }}
                        >
                            {/* Eyes */}
                            <div class="absolute top-[28%] flex gap-4 sm:gap-5">
                                <div class="size-3 sm:size-4 rounded-full bg-primary" />
                                <div class="size-3 sm:size-4 rounded-full bg-primary" />
                            </div>
                            {/* Sad mouth */}
                            <svg class="absolute bottom-[20%] w-9 h-5 sm:w-11 sm:h-6" viewBox="0 0 32 18" fill="none">
                                <path d="M6 14C10 6 22 6 26 14" stroke="var(--color-primary)" stroke-width="3" stroke-linecap="round" />
                            </svg>
                        </div>
                    </div>

                    <span class={digitClass}>4</span>
                </div>

                {/* Text */}
                <div class="space-y-3">
                    <h1 class="text-2xl sm:text-3xl font-bold text-heading">Página no encontrada</h1>
                    <p class="text-muted text-base sm:text-lg leading-relaxed max-w-md mx-auto">
                        La página que buscas no existe o fue movida. Verifica la URL o regresa al inicio.
                    </p>
                </div>

                {/* Actions */}
                <div class="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <Button variant="primary" size="lg" icon={<HomeIcon />} onClick={() => navigate({ to: '/dashboard' })} class="w-full sm:w-auto">
                        Ir al Dashboard
                    </Button>
                    <Button variant="outline" size="lg" icon={<BackIcon />} onClick={() => window.history.back()} class="w-full sm:w-auto">
                        Volver atrás
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default NotFound;
