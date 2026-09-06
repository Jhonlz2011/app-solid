import { Show } from 'solid-js';
import type { ColumnDef } from '@tanstack/solid-table';
import { Badge, CounterBadge } from '@display/Badge';
import ActionMenu from '@/shared/ui/overlay/ActionMenu';
import { UndoIcon } from '@icons/UndoIcon';
import type { ToolLoanNode } from './tools.api';

export interface ToolLoanColumnHandlers {
    onViewDetail: (loan: ToolLoanNode) => void;
    onRecordReturn: (loan: ToolLoanNode) => void;
}

export function createToolLoanColumns(handlers: ToolLoanColumnHandlers): ColumnDef<ToolLoanNode>[] {
    return [
        {
            accessorKey: 'code',
            header: 'Vale #',
            size: 110,
            cell: ({ row }) => (
                <span class="font-mono text-xs font-bold text-text bg-surface/60 px-2 py-1 rounded-lg border border-border/40">
                    {row.original.code}
                </span>
            ),
        },
        {
            accessorKey: 'borrower_name',
            header: 'Custodio (Empleado)',
            size: 180,
            cell: ({ row }) => (
                <div class="flex flex-col min-w-0">
                    <span class="text-sm font-semibold text-text truncate" title={row.original.borrower_name}>
                        {row.original.borrower_name}
                    </span>
                    <span class="text-[11px] text-muted truncate">
                        Entregado por: {row.original.dispatched_by_name}
                    </span>
                </div>
            ),
        },
        {
            accessorKey: 'destination_type',
            header: 'Destino',
            size: 140,
            cell: ({ row }) => (
                <div class="flex flex-col min-w-0">
                    <span class="text-xs font-medium text-text">
                        {row.original.destination_type === 'WORKSHOP' ? 'Taller Interno' : 'Obra / Sitio Externo'}
                    </span>
                    <Show when={row.original.location_detail}>
                        <span class="text-[11px] text-muted truncate" title={row.original.location_detail!}>
                            {row.original.location_detail}
                        </span>
                    </Show>
                </div>
            ),
        },
        {
            accessorKey: 'loan_date',
            header: 'Fecha Préstamo',
            size: 130,
            cell: ({ row }) => {
                const d = new Date(row.original.loan_date);
                return (
                    <span class="text-xs text-muted font-mono">
                        {d.toLocaleDateString('es-EC', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                );
            },
        },
        {
            accessorKey: 'expected_return_date',
            header: 'Devolución Prevista',
            size: 150,
            cell: ({ row }) => {
                const d = new Date(row.original.expected_return_date);
                const isOverdue = row.original.is_overdue;
                return (
                    <div class="flex items-center gap-1.5">
                        <span class={`text-xs font-mono ${isOverdue ? 'text-danger font-bold' : 'text-text'}`}>
                            {d.toLocaleDateString('es-EC', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </span>
                        <Show when={isOverdue}>
                            <Badge variant="danger" class="text-[9px] uppercase px-1 py-0 font-bold">
                                Vencido
                            </Badge>
                        </Show>
                    </div>
                );
            },
        },
        {
            id: 'items',
            header: 'Herramientas',
            size: 130,
            cell: ({ row }) => {
                const total = row.original.items_count;
                const pending = row.original.pending_items_count;
                return (
                    <div class="flex items-center gap-1.5">
                        <CounterBadge
                            count={total}
                            variant="default"
                            class="text-[11px] font-mono"
                            title="Total de herramientas en este vale"
                        />
                        <Show when={pending > 0} fallback={<span class="text-xs text-success font-medium">Completas</span>}>
                            <Badge variant="warning" class="text-[10px] px-1.5 py-0.5">
                                {pending} pendientes
                            </Badge>
                        </Show>
                    </div>
                );
            },
        },
        {
            accessorKey: 'status',
            header: 'Estado',
            size: 130,
            cell: ({ row }) => {
                const status = row.original.status;
                if (status === 'COMPLETED') {
                    return <Badge variant="success" class="text-xs">Devuelto</Badge>;
                }
                if (status === 'PARTIALLY_RETURNED') {
                    return <Badge variant="orange" class="text-xs">Retorno Parcial</Badge>;
                }
                if (status === 'CANCELLED') {
                    return <Badge variant="default" class="text-xs">Cancelado</Badge>;
                }
                if (row.original.is_overdue) {
                    return <Badge variant="danger" class="text-xs">Vencido</Badge>;
                }
                if (status === 'DISPATCHED') {
                    return <Badge variant="warning" class="text-xs">En Custodia</Badge>;
                }
                return <Badge variant="default" class="text-xs">{status}</Badge>;
            },
        },
        {
            id: 'actions',
            header: '',
            size: 50,
            enableSorting: false,
            enableHiding: false,
            cell: ({ row }) => {
                const isCompleted = row.original.status === 'COMPLETED' || row.original.status === 'CANCELLED';
                return (
                    <ActionMenu
                        module="tool_loans"
                        isActive={!isCompleted}
                        onView={() => handlers.onViewDetail(row.original)}
                        showLabel="Ver Detalle"
                    >
                        <Show when={!isCompleted}>
                            <ActionMenu.Item onSelect={() => handlers.onRecordReturn(row.original)}>
                                <UndoIcon class="size-4 mr-2 text-warning" />
                                <span>Registrar Devolución</span>
                            </ActionMenu.Item>
                        </Show>
                    </ActionMenu>
                );
            },
        },
    ];
}
