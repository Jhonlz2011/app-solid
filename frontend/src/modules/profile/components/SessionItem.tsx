import { Component, Show } from 'solid-js';
import { UAParser } from 'ua-parser-js';
import Button from '@shared/ui/Button';
import { LogoutIcon } from '@shared/ui/icons';


export interface Session {
    id: string;
    user_agent: string | null;
    ip_address: string | null;
    location: string | null;
    created_at: string;
    is_current: boolean;
}

interface SessionItemProps {
    session: Session;
    onRevoke: (id: string) => void;
    isRevoking: boolean;
}

const parseUserAgent = (ua: string | null): { browser: string; os: string; icon: string } => {
    if (!ua) return { browser: 'Desconocido', os: 'Desconocido', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' };

    const parser = new UAParser(ua);
    const result = parser.getResult();

    let browserName = result.browser.name || 'Navegador Web';
    let osName = result.os.name || 'Desconocido';
    let deviceType = result.device.type;
    let vendor = result.device.vendor;
    let model = result.device.model;

    let displayName = osName;

    if (vendor && model) {
        displayName = `${vendor} ${model}`;
    } else if (model) {
        displayName = model;
    }

    if (model && model.length <= 2) {
        displayName = osName;
    } else if (displayName === 'Desconocido') {
        displayName = osName;
    }

    let icon = 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z';

    if (deviceType === 'mobile' || deviceType === 'tablet' || osName === 'Android' || osName === 'iOS') {
        icon = 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z';
    }

    return { browser: browserName, os: displayName, icon };
};

const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr);
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
                ' rounded-xl p-4 border': true,
                'border-primary/30 bg-primary/5 ring-1 ring-primary/20': props.session.is_current,
                'border-surface hover:border-border': !props.session.is_current,
            }}
        >
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div class="flex items-center gap-3 sm:gap-4">
                    <div
                        class={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-colors shrink-0 ${props.session.is_current ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-surface-alt text-muted'
                            }`}
                    >
                        <svg class="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d={icon} />
                        </svg>
                    </div>
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="font-semibold text-heading text-base sm:text-lg truncate">{os}</span>
                            <Show when={props.session.is_current}>
                                <span class="text-[10px] uppercase tracking-wider bg-primary text-white px-2 py-0.5 rounded-full font-bold shadow-sm shrink-0">
                                    Actual
                                </span>
                            </Show>
                        </div>
                        <div class="text-sm text-muted mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>{browser}</span>
                            <span class="w-1 h-1 rounded-full bg-border shrink-0"></span>
                            <span class="truncate">
                                {props.session.location ? `${props.session.location} · ` : ''}
                                {props.session.ip_address || 'IP desconocida'}
                            </span>
                        </div>
                        <div class="text-xs text-muted/70 mt-1">
                            Ultima vez iniciado el {formatDate(props.session.created_at)}
                        </div>
                    </div>
                </div>
                <Show when={!props.session.is_current}>
                    <Button
                        variant="ghost"
                        onClick={() => props.onRevoke(props.session.id)}
                        disabled={props.isRevoking}
                        loading={props.isRevoking}
                        loadingText={<span class="sm:hidden lg:inline">Revocando...</span>}
                        class="self-center sm:self-auto text-danger hover:text-danger hover:bg-danger/10 shrink-0 px-3"
                        title="Cerrar sesión"
                    >
                        <Show when={!props.isRevoking}>
                            <LogoutIcon class="size-5" />
                            <span class="sm:hidden lg:inline">Cerrar Sesión</span>
                        </Show>
                    </Button>
                </Show>
            </div>
        </div>
    );
};
