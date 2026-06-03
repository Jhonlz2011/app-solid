import { Component } from 'solid-js';

export const OfflineBanner: Component = () => {
  return (
    <div 
      id="pwa-offline-banner"
      class="w-full bg-warning/10 border-b border-warning/20 text-warning px-4 py-2.5 flex items-center justify-between text-sm transition-all duration-300 animate-in fade-in slide-in-from-top-4"
    >
      <div class="flex items-center gap-2.5">
        <div class="flex items-center justify-center size-5 bg-warning/20 text-warning rounded-full shrink-0">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            class="size-3.5 animate-pulse" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor" 
            stroke-width="2.5"
          >
            <path 
              stroke-linecap="round" 
              stroke-linejoin="round" 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
            />
          </svg>
        </div>
        <span class="font-medium text-xs sm:text-sm">
          <strong>Modo sin conexión activo:</strong> Estás trabajando localmente. Las modificaciones se guardarán en tu dispositivo y se sincronizarán al recuperar la red.
        </span>
      </div>
      <button 
        type="button" 
        onClick={() => window.location.reload()} 
        class="text-xs font-semibold underline hover:text-warning-strong transition-colors cursor-pointer ml-4 shrink-0"
      >
        Reintentar
      </button>
    </div>
  );
};

export default OfflineBanner;
