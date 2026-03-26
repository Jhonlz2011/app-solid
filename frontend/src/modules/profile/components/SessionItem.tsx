import { Component, Show } from 'solid-js';
import { parseUserAgent, formatSessionDate } from '@shared/utils/session.utils';
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
    /** Compact mode for narrower contexts like Sheets */
    compact?: boolean;
}

export const SessionItem: Component<SessionItemProps> = (props) => {
    const { browser, os, icon } = parseUserAgent(props.session.user_agent);

    return (
        <div
            classList={{
                'rounded-xl p-4 border': !props.compact,
                'rounded-xl p-3 border': props.compact,
                'border-primary/30 bg-primary/5 ring-1 ring-primary/20': props.session.is_current,
                'border-surface hover:border-border': !props.session.is_current && !props.compact,
                'border-border/50 bg-surface/30 hover:border-border': !props.session.is_current && props.compact,
            }}
        >
            <div classList={{
                'flex gap-3': true,
                'flex-col sm:flex-row sm:items-center sm:justify-between sm:gap-4': !props.compact,
                'items-center justify-between': props.compact,
            }}>
                <div classList={{
                    'flex items-center min-w-0 flex-1': true,
                    'gap-3 sm:gap-4': !props.compact,
                    'gap-3': props.compact,
                }}>
                    <div
                        classList={{
                            'rounded-xl flex items-center justify-center shrink-0 transition-colors': true,
                            'w-10 h-10 sm:w-12 sm:h-12': !props.compact,
                            'size-9': props.compact,
                            'bg-primary text-white shadow-lg shadow-primary/20': props.session.is_current,
                            'bg-surface-alt text-muted': !props.session.is_current,
                        }}
                    >
                        <svg classList={{ 'w-5 h-5 sm:w-6 sm:h-6': !props.compact, 'size-4': props.compact }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d={icon} />
                        </svg>
                    </div>
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span classList={{
                                'font-semibold truncate': true,
                                'text-heading text-base sm:text-lg': !props.compact,
                                'text-text text-sm': props.compact,
                            }}>{os}</span>
                            <Show when={props.session.is_current}>
                                <span classList={{
                                    'uppercase tracking-wider bg-primary text-white rounded-full font-bold shrink-0': true,
                                    'text-[10px] px-2 py-0.5 shadow-sm': !props.compact,
                                    'text-[9px] px-1.5 py-px': props.compact,
                                }}>
                                    Actual
                                </span>
                            </Show>
                        </div>
                        <div classList={{
                            'text-muted mt-0.5 flex items-center gap-1.5 flex-wrap': true,
                            'text-sm gap-2': !props.compact,
                            'text-xs': props.compact,
                        }}>
                            <span>{browser}</span>
                            <span class="size-1 rounded-full bg-border shrink-0" />
                            <span class="truncate">
                                {props.session.location ? `${props.session.location} · ` : ''}
                                {props.session.ip_address || 'IP desconocida'}
                            </span>
                        </div>
                        <div classList={{
                            'text-muted/70 mt-0.5': true,
                            'text-xs mt-1': !props.compact,
                            'text-[11px]': props.compact,
                        }}>
                            {props.compact ? 'Iniciada' : 'Ultima vez iniciado el'} {formatSessionDate(props.session.created_at)}
                        </div>
                    </div>
                </div>
                <Show when={!props.session.is_current}>
                    <Button
                        variant="ghost"
                        size={props.compact ? 'sm' : undefined}
                        onClick={() => props.onRevoke(props.session.id)}
                        disabled={props.isRevoking}
                        loading={props.isRevoking}
                        loadingText={props.compact ? undefined : <span class="sm:hidden lg:inline">Revocando...</span>}
                        class="self-center sm:self-auto text-danger hover:text-danger hover:bg-danger/10 shrink-0 px-3"
                        title="Cerrar sesión"
                    >
                        <Show when={!props.isRevoking}>
                            <LogoutIcon classList={{ 'size-5': !props.compact, 'size-4': props.compact }} />
                            <Show when={!props.compact}>
                                <span class="sm:hidden lg:inline">Cerrar Sesión</span>
                            </Show>
                        </Show>
                    </Button>
                </Show>
            </div>
        </div>
    );
};
