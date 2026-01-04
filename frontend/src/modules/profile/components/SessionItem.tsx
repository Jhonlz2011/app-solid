import { Component, Show } from 'solid-js';
import { UAParser } from 'ua-parser-js';

export interface Session {
    id: number;
    user_agent: string | null;
    ip_address: string | null;
    location: string | null;
    created_at: string;
    is_current: boolean;
}

interface SessionItemProps {
    session: Session;
    onRevoke: (id: number) => void;
    isRevoking: boolean;
}

const parseUserAgent = (ua: string | null): { browser: string; os: string; icon: string } => {
    if (!ua) return { browser: 'Desconocido', os: 'Desconocido', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' };

    const parser = new UAParser(ua);
    const result = parser.getResult();

    let browserName = result.browser.name || 'Navegador Web';
    let osName = result.os.name || 'Desconocido';
    let deviceType = result.device.type; // mobile, tablet, console, smarttv, wearable, embedded
    let vendor = result.device.vendor;
    let model = result.device.model;

    // Construct Device Name
    let displayName = osName;

    if (vendor && model) {
        displayName = `${vendor} ${model}`;
    } else if (model) {
        displayName = model;
    }

    // Fallback/Enhancement: If name is too short (like "K") or just generic, append OS for clarity
    // If model is very short (likely an artifact like "K"), ignore it and just show OS
    if (model && model.length <= 2) {
        displayName = osName;
    }
    // If we have a valid model but it's obscure, maybe append OS? 
    // For now, let's just stick to: if it's a good model name, show it. If not, show OS.
    else if (displayName === 'Desconocido') {
        displayName = osName;
    }

    // Icons
    // Icons
    let icon = 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'; // Monitor Icon (default)

    // Mobile/Tablet Icon
    if (deviceType === 'mobile' || deviceType === 'tablet' || osName === 'Android' || osName === 'iOS') {
        icon = 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z';
    }

    return { browser: browserName, os: displayName, icon };
};

const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr);
    // The server seems to be storing local time as UTC-agnostic timestamp, 
    // which gets sent as UTC. To display the correct local time (Ecuador),
    // we display the UTC components directly.
    return d.toLocaleDateString('es-EC', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC'
    });
};

export const SessionItem: Component<SessionItemProps> = (props) => {
    const { browser, os, icon } = parseUserAgent(props.session.user_agent);

    return (
        <div
            classList={{
                'surface-panel rounded-xl p-4 border transition-all': true,
                'border-primary/30 bg-primary/5 ring-1 ring-primary/20': props.session.is_current,
                'border-surface hover:border-border': !props.session.is_current,
            }}
        >
            <div class="flex items-center justify-between gap-4">
                <div class="flex items-center gap-4">
                    <div
                        class={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${props.session.is_current ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-surface-alt text-muted'
                            }`}
                    >
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d={icon} />
                        </svg>
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="font-semibold text-heading text-lg">{os}</span>
                            <Show when={props.session.is_current}>
                                <span class="text-[10px] uppercase tracking-wider bg-primary text-white px-2 py-0.5 rounded-full font-bold shadow-sm">
                                    Actual
                                </span>
                            </Show>
                        </div>
                        <div class="text-sm text-muted mt-0.5 flex items-center gap-2">
                            <span>{browser}</span>
                            <span class="w-1 h-1 rounded-full bg-border"></span>
                            <span>
                                {props.session.location ? `${props.session.location} · ` : ''}
                                {props.session.ip_address || 'IP desconocida'}
                            </span>
                        </div>
                        <div class="text-xs text-muted/70 mt-1">
                            Iniciado el {formatDate(props.session.created_at)}
                        </div>
                    </div>
                </div>
                <Show when={!props.session.is_current}>
                    <button
                        onClick={() => props.onRevoke(props.session.id)}
                        disabled={props.isRevoking}
                        class="px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50 active:scale-95"
                    >
                        {props.isRevoking ? 'Revocando...' : 'Cerrar Sesión'}
                    </button>
                </Show>
            </div>
        </div>
    );
};
