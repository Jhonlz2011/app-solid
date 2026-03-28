import { Component, For, Show, createSignal } from 'solid-js';
import type { AuditLogEntry } from '../../models/users.types';
import { formatSessionDate } from '@shared/utils/session.utils';
import { AUDIT_ACTION_LABELS, TABLE_NAME_LABELS, computeDiff } from '@shared/utils/audit.utils';
import Button from '@shared/ui/Button';
import { ListItemSkeleton } from '@shared/ui/SkeletonLoader';
import ErrorState from '@shared/ui/ErrorState';
import { UserHistoryIcon } from '@shared/ui/icons';
import { useUserAuditLog } from '../../data/users.queries';

// ─── Inline Diff Table ───────────────────────────────────────────────────────

const AuditDiffView: Component<{ entry: AuditLogEntry }> = (props) => {
    const action = () => props.entry.action;
    const oldData = () => props.entry.oldData as Record<string, unknown> | null | undefined;
    const newData = () => props.entry.newData as Record<string, unknown> | null | undefined;

    const changes = () => computeDiff(oldData(), newData());
    const hasData = () => oldData() || newData();

    return (
        <Show when={hasData() && changes().length > 0}>
            <div class="mt-2 rounded-lg border border-border/40 overflow-hidden text-[11px]">
                {/* Header row */}
                <div class="grid grid-cols-3 bg-surface/50 px-3 py-1.5 font-semibold text-muted/80 border-b border-border/30">
                    <span>Campo</span>
                    <Show when={action() === 'UPDATE'} fallback={<span class="col-span-2">Valor</span>}>
                        <span>Antes</span>
                        <span>Después</span>
                    </Show>
                </div>

                {/* Rows */}
                <For each={changes()}>
                    {(change) => (
                        <div class="grid grid-cols-3 px-3 py-1.5 border-b border-border/20 last:border-b-0 hover:bg-surface/20 transition-colors">
                            <span class="font-medium text-text/70 truncate" title={change.key}>
                                {change.label}
                            </span>

                            <Show when={action() === 'UPDATE'} fallback={
                                <span class={`col-span-2 font-mono truncate ${action() === 'INSERT' ? 'text-emerald-600' : 'text-red-500'}`} title={action() === 'INSERT' ? change.newVal : change.oldVal}>
                                    {action() === 'INSERT' ? change.newVal : change.oldVal}
                                </span>
                            }>
                                <span class="font-mono text-red-500/80 truncate line-through" title={change.oldVal}>
                                    {change.oldVal}
                                </span>
                                <span class="font-mono text-emerald-600 truncate" title={change.newVal}>
                                    {change.newVal}
                                </span>
                            </Show>
                        </div>
                    )}
                </For>
            </div>
        </Show>
    );
};

// ─── Activity Tab ────────────────────────────────────────────────────────────

const UserActivityTab: Component<{ userId: number }> = (props) => {
    const [page, setPage] = createSignal(1);
    const [expandedIds, setExpandedIds] = createSignal<Set<string>>(new Set());
    const auditQuery = useUserAuditLog(() => props.userId, page);

    const entries = () => auditQuery.data?.data ?? [];
    const meta = () => auditQuery.data?.meta;
    const isLoading = () => auditQuery.isLoading;

    const toggleExpand = (id: string) => {
        const next = new Set(expandedIds());
        if (next.has(id)) next.delete(id); else next.add(id);
        setExpandedIds(next);
    };

    const hasDiffData = (entry: AuditLogEntry) => {
        return entry.oldData || entry.newData;
    };

    return (
        <div>
            <div class="flex items-center justify-between mb-4">
                <div>
                    <h3 class="text-sm font-semibold text-text">Registro de actividad</h3>
                    <p class="text-xs text-muted mt-0.5">Acciones realizadas por este usuario</p>
                </div>
                <Show when={meta()}>
                    <span class="text-xs text-muted">
                        {meta()!.total} entradas
                    </span>
                </Show>
            </div>

            <Show when={isLoading() && entries().length === 0}>
                <div class="space-y-3">
                    <For each={[0, 1, 2]}>{() => <ListItemSkeleton />}</For>
                </div>
            </Show>

            <Show when={auditQuery.isError && entries().length === 0}>
                <ErrorState size="sm" description="Error al cargar el historial" onRetry={() => auditQuery.refetch()} />
            </Show>

            <Show when={!isLoading() && entries().length === 0 && !auditQuery.isError}>
                <div class="text-center py-10 bg-surface/30 rounded-2xl border border-dashed border-border/60">
                    <UserHistoryIcon class="size-8 mx-auto mb-3 opacity-20" />
                    <p class="text-muted text-sm">Sin actividad registrada</p>
                </div>
            </Show>

            <Show when={entries().length > 0}>
                {/* Timeline */}
                <div class="relative">
                    {/* Vertical line */}
                    <div class="absolute left-[19px] top-2 bottom-2 w-px bg-border/40" />

                    <div class="space-y-1">
                        <For each={entries()}>
                            {(entry: AuditLogEntry) => {
                                const actionInfo = () => AUDIT_ACTION_LABELS[entry.action] ?? {
                                    label: entry.action,
                                    color: 'bg-gray-500/15 text-gray-600',
                                };
                                const tableName = () => TABLE_NAME_LABELS[entry.tableName] ?? entry.tableName;
                                const entryId = () => `${entry.id}-${entry.createdAt}`;
                                const isExpanded = () => expandedIds().has(entryId());

                                return (
                                    <div class="relative flex items-start gap-3 py-2.5 pl-1">
                                        {/* Dot */}
                                        <div class="size-[10px] rounded-full bg-card border-2 border-border mt-1.5 shrink-0 z-10" />

                                        {/* Content */}
                                        <div class="flex-1 min-w-0">
                                           <div class="flex items-center gap-2 flex-wrap">
                                                <span class={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${actionInfo().color}`}>
                                                    {actionInfo().label}
                                                </span>
                                                <span class="text-[11px] text-muted/80 font-medium">
                                                    {tableName()}
                                                </span>
                                                <span class="text-[11px] text-muted/50 font-mono">
                                                    #{entry.recordId}
                                                </span>
                                                <span class="text-[11px] text-muted/60" title={formatSessionDate(entry.createdAt)}>
                                                    {formatSessionDate(entry.createdAt)}
                                                </span>

                                                {/* Expand/collapse button for diff */}
                                                <Show when={hasDiffData(entry)}>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleExpand(entryId())}
                                                        class="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-surface/50 hover:bg-surface text-muted hover:text-text transition-colors cursor-pointer"
                                                    >
                                                        {isExpanded() ? '▲ Ocultar' : '▼ Ver cambios'}
                                                    </button>
                                                </Show>
                                            </div>
                                            <Show when={entry.performedByUsername}>
                                                <p class="text-xs text-muted mt-0.5">
                                                    por <span class="font-medium text-text/80">{entry.performedByUsername}</span>
                                                </p>
                                            </Show>
                                            <Show when={entry.ipAddress}>
                                                <p class="text-[11px] text-muted/50 mt-0.5">IP: {entry.ipAddress}</p>
                                            </Show>

                                            {/* Expandable diff view */}
                                            <Show when={isExpanded()}>
                                                <AuditDiffView entry={entry} />
                                            </Show>
                                        </div>
                                    </div>
                                );
                            }}
                        </For>
                    </div>
                </div>

                {/* Pagination */}
                <Show when={meta() && meta()!.pageCount > 1}>
                    <div class="flex items-center justify-between mt-4 pt-4 border-t border-border/40">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={!meta()!.hasPrevPage || auditQuery.isFetching}
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                        >
                            Anterior
                        </Button>
                        <span class="text-xs text-muted">
                            Página {meta()!.page} de {meta()!.pageCount}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={!meta()!.hasNextPage || auditQuery.isFetching}
                            onClick={() => setPage(p => p + 1)}
                        >
                            Siguiente
                        </Button>
                    </div>
                </Show>
            </Show>
        </div>
    );
};

export default UserActivityTab;
