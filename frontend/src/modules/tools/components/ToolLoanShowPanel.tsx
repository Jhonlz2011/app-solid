import { Component, Show, For } from 'solid-js';
import Sheet from '@overlay/Sheet';
import Button from '@form/Button';
import { Badge } from '@display/Badge';
import { SkeletonLoader } from '@display/SkeletonLoader';
import { UndoIcon } from '@icons/UndoIcon';
import { useToolLoanDetail } from '../data/tools.queries';
import type { ToolLoanNode } from '../data/tools.api';

interface ToolLoanShowPanelProps {
    loanId: number | null;
    isOpen: boolean;
    onClose: () => void;
    onRecordReturn?: (loan: ToolLoanNode) => void;
}

export const ToolLoanShowPanel: Component<ToolLoanShowPanelProps> = (props) => {
    const loanQuery = useToolLoanDetail(() => props.loanId);

    const isCompleted = () => {
        const status = loanQuery.data?.status;
        return status === 'COMPLETED' || status === 'CANCELLED';
    };

    return (
        <Sheet
            isOpen={props.isOpen}
            onClose={props.onClose}
            title={loanQuery.data ? `Vale de Custodia #${loanQuery.data.code}` : 'Detalles del Vale'}
            description="Control de entrega y devolución de herramientas"
            size="xxxl"
            footer={
                <div class="flex items-center justify-between w-full">
                    <Button variant="outline" onClick={props.onClose}>
                        Cerrar
                    </Button>
                    <Show when={loanQuery.data && !isCompleted() && props.onRecordReturn}>
                        <Button
                            variant="primary"
                            icon={<UndoIcon class="size-4" />}
                            onClick={() => {
                                if (loanQuery.data) {
                                    // Convert detail to ToolLoanNode format for handlers
                                    const node: ToolLoanNode = {
                                        ...loanQuery.data,
                                        is_overdue: false,
                                        items_count: loanQuery.data.items.length,
                                        pending_items_count: loanQuery.data.items.reduce(
                                            (acc, it) => acc + it.pending_quantity,
                                            0
                                        ),
                                    };
                                    props.onClose();
                                    props.onRecordReturn!(node);
                                }
                            }}
                        >
                            Registrar Devolución
                        </Button>
                    </Show>
                </div>
            }
        >
            <Show when={loanQuery.isLoading}>
                <div class="space-y-4 py-4">
                    <SkeletonLoader class="h-8 w-1/3 rounded-lg" />
                    <SkeletonLoader class="h-24 w-full rounded-xl" />
                    <SkeletonLoader class="h-40 w-full rounded-xl" />
                </div>
            </Show>

            <Show when={loanQuery.data} keyed>
                {(loan) => {
                    const loanDate = new Date(loan.loan_date);
                    const expDate = new Date(loan.expected_return_date);
                    const isOverdue = loan.status !== 'COMPLETED' && loan.status !== 'CANCELLED' && expDate < new Date();

                    return (
                        <div class="space-y-6 py-2">
                            {/* Status & Summary banner */}
                            <div class="p-4 rounded-2xl bg-surface/50 border border-border/60 flex flex-wrap items-center justify-between gap-3">
                                <div class="flex items-center gap-2.5">
                                    <Show when={loan.status === 'COMPLETED'}>
                                        <Badge variant="success" class="text-xs px-2.5 py-1 font-semibold">Devuelto Completo</Badge>
                                    </Show>
                                    <Show when={loan.status === 'PARTIALLY_RETURNED'}>
                                        <Badge variant="orange" class="text-xs px-2.5 py-1 font-semibold">Retorno Parcial</Badge>
                                    </Show>
                                    <Show when={loan.status === 'DISPATCHED' && !isOverdue}>
                                        <Badge variant="warning" class="text-xs px-2.5 py-1 font-semibold">En Custodia Activa</Badge>
                                    </Show>
                                    <Show when={isOverdue}>
                                        <Badge variant="danger" class="text-xs px-2.5 py-1 font-semibold uppercase">Vencido</Badge>
                                    </Show>
                                    <span class="font-mono text-xs text-muted">ID: {loan.id}</span>
                                </div>

                                <div class="text-right">
                                    <span class="text-xs text-muted block">Fecha de emisión</span>
                                    <span class="text-xs font-mono font-medium text-text">
                                        {loanDate.toLocaleDateString('es-EC', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>

                            {/* Key Custody Details Grid */}
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div class="p-4 rounded-xl border border-border/40 bg-card/40 space-y-3">
                                    <h4 class="text-xs font-bold uppercase tracking-wider text-muted">Información del Custodio</h4>
                                    <div>
                                        <span class="text-xs text-muted block">Empleado / Custodio</span>
                                        <span class="text-sm font-semibold text-text">{loan.borrower_name}</span>
                                    </div>
                                    <div>
                                        <span class="text-xs text-muted block">Entregado por (Pañolero)</span>
                                        <span class="text-xs font-medium text-text">{loan.dispatched_by_name}</span>
                                    </div>
                                </div>

                                <div class="p-4 rounded-xl border border-border/40 bg-card/40 space-y-3">
                                    <h4 class="text-xs font-bold uppercase tracking-wider text-muted">Destino y Plazo</h4>
                                    <div>
                                        <span class="text-xs text-muted block">Destino de Uso</span>
                                        <span class="text-sm font-semibold text-text">
                                            {loan.destination_type === 'WORKSHOP' ? 'Taller Interno' : 'Obra / Sitio Externo'}
                                            {loan.location_detail ? ` (${loan.location_detail})` : ''}
                                        </span>
                                    </div>
                                    <div>
                                        <span class="text-xs text-muted block">Fecha Límite Prevista</span>
                                        <span class={`text-xs font-mono font-bold ${isOverdue ? 'text-danger' : 'text-text'}`}>
                                            {expDate.toLocaleDateString('es-EC', { year: 'numeric', month: 'short', day: 'numeric' })}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Loan General Notes */}
                            <Show when={loan.notes}>
                                <div class="p-3.5 rounded-xl bg-surface/30 border border-border/40 text-xs">
                                    <span class="font-semibold text-muted block mb-1">Observaciones del Vale:</span>
                                    <p class="text-text whitespace-pre-wrap">{loan.notes}</p>
                                </div>
                            </Show>

                            {/* Section: Items Table */}
                            <div class="space-y-3">
                                <h4 class="text-xs font-bold uppercase tracking-wider text-muted">
                                    Herramientas en Préstamo ({loan.items.length})
                                </h4>

                                <div class="border border-border/50 rounded-xl overflow-hidden bg-card/60">
                                    <table class="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr class="border-b border-border/50 bg-surface/40 text-muted font-medium">
                                                <th class="p-3">Herramienta</th>
                                                <th class="p-3">SKU / Serie</th>
                                                <th class="p-3 text-center">Prestado</th>
                                                <th class="p-3 text-center">Devuelto</th>
                                                <th class="p-3 text-center">Pendiente</th>
                                                <th class="p-3">Notas</th>
                                            </tr>
                                        </thead>
                                        <tbody class="divide-y divide-border/30">
                                            <For each={loan.items}>
                                                {(item) => (
                                                    <tr class="hover:bg-surface/20 transition-colors">
                                                        <td class="p-3 font-semibold text-text">
                                                            {item.product_name}
                                                            <Show when={item.variant_name && item.variant_name !== 'Default'}>
                                                                <span class="text-muted text-[11px] block font-normal">
                                                                    {item.variant_name}
                                                                </span>
                                                            </Show>
                                                        </td>
                                                        <td class="p-3 font-mono text-[11px] text-muted">
                                                            {item.tool_item_code || item.sku || '-'}
                                                        </td>
                                                        <td class="p-3 text-center font-bold text-text">
                                                            {item.quantity_loaned}
                                                        </td>
                                                        <td class="p-3 text-center font-medium text-success">
                                                            {item.quantity_returned}
                                                        </td>
                                                        <td class="p-3 text-center">
                                                            <Show when={item.pending_quantity > 0} fallback={<span class="text-success text-[11px]">✓</span>}>
                                                                <span class="px-2 py-0.5 rounded-md font-bold text-[11px] bg-warning/15 text-warning">
                                                                    {item.pending_quantity}
                                                                </span>
                                                            </Show>
                                                        </td>
                                                        <td class="p-3 text-muted text-[11px] italic">
                                                            {item.notes || '-'}
                                                        </td>
                                                    </tr>
                                                )}
                                            </For>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Section: Returns History & Inspection */}
                            <div class="space-y-3 pt-2">
                                <h4 class="text-xs font-bold uppercase tracking-wider text-muted">
                                    Historial de Recepción e Inspección Técnica ({loan.returns.length})
                                </h4>

                                <Show
                                    when={loan.returns.length > 0}
                                    fallback={
                                        <div class="p-6 text-center rounded-xl border border-dashed border-border/60 text-muted text-xs">
                                            Aún no se han registrado recepciones ni inspecciones para este vale de salida.
                                        </div>
                                    }
                                >
                                    <div class="space-y-3">
                                        <For each={loan.returns}>
                                            {(ret) => {
                                                const retDate = new Date(ret.return_date);
                                                return (
                                                    <div class="p-4 rounded-xl border border-border/50 bg-card/40 space-y-3">
                                                        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-border/30 pb-2.5">
                                                            <div>
                                                                <span class="text-xs font-bold text-text">
                                                                    Recepción #{ret.id}
                                                                </span>
                                                                <span class="text-muted text-xs ml-2">
                                                                    por <span class="font-medium text-text">{ret.received_by_name}</span>
                                                                </span>
                                                            </div>
                                                            <span class="font-mono text-xs text-muted">
                                                                {retDate.toLocaleDateString('es-EC', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>

                                                        <Show when={ret.notes}>
                                                            <p class="text-xs text-muted italic">"{ret.notes}"</p>
                                                        </Show>

                                                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                                            <For each={ret.items}>
                                                                {(ri) => (
                                                                    <div class="p-2.5 rounded-lg bg-surface/40 border border-border/40 text-xs flex items-center justify-between">
                                                                        <div>
                                                                            <span class="font-medium text-text">
                                                                                Cant: {ri.quantity_returned}
                                                                            </span>
                                                                            <Show when={ri.damage_notes}>
                                                                                <span class="text-[11px] text-danger block mt-0.5">
                                                                                    Nota: {ri.damage_notes}
                                                                                </span>
                                                                            </Show>
                                                                        </div>
                                                                        <div class="flex items-center gap-1.5">
                                                                            <Show when={ri.condition === 'GOOD'}>
                                                                                <Badge variant="success" class="text-[10px]">Buen Estado</Badge>
                                                                            </Show>
                                                                            <Show when={ri.condition === 'DAMAGED'}>
                                                                                <Badge variant="warning" class="text-[10px]">Dañado</Badge>
                                                                            </Show>
                                                                            <Show when={ri.condition === 'UNUSABLE'}>
                                                                                <Badge variant="danger" class="text-[10px]">Inoperativo</Badge>
                                                                            </Show>
                                                                            <Show when={ri.requires_maintenance}>
                                                                                <Badge variant="orange" class="text-[10px]">Mantenimiento</Badge>
                                                                            </Show>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </For>
                                                        </div>
                                                    </div>
                                                );
                                            }}
                                        </For>
                                    </div>
                                </Show>
                            </div>
                        </div>
                    );
                }}
            </Show>
        </Sheet>
    );
};

export default ToolLoanShowPanel;
