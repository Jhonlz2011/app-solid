import { Component, createSignal, createEffect, For, Show } from 'solid-js';
import { FormDialog } from '@shared/ui/overlay/FormDialog';
import { useToolLoanDetail } from '../data/tools.queries';
import { useRecordToolReturn } from '../data/tools.mutations';
import { toast } from 'solid-sonner';
import { SkeletonLoader } from '@display/SkeletonLoader';
import { Badge } from '@display/Badge';
import Checkbox from '@form/Checkbox';
import type { Condition } from '@app/schema/enums';

interface ToolReturnDialogProps {
    loanId: number | null;
    isOpen: boolean;
    onClose: () => void;
}

interface ReturnItemState {
    loanItemId: number;
    productName: string;
    sku: string;
    quantityLoaned: number;
    quantityPending: number;
    quantityReturned: number;
    condition: Condition;
    damageNotes: string;
    requiresMaintenance: boolean;
}

export const ToolReturnDialog: Component<ToolReturnDialogProps> = (props) => {
    const loanQuery = useToolLoanDetail(() => props.loanId);
    const returnMutation = useRecordToolReturn();

    const [itemsState, setItemsState] = createSignal<ReturnItemState[]>([]);
    const [receiptNotes, setReceiptNotes] = createSignal('');

    createEffect(() => {
        const loan = loanQuery.data;
        if (loan && props.isOpen) {
            const initial: ReturnItemState[] = loan.items
                .filter((item) => item.pending_quantity > 0)
                .map((item) => ({
                    loanItemId: item.id,
                    productName: item.product_name || 'Herramienta',
                    sku: item.sku || '',
                    quantityLoaned: Number(item.quantity_loaned),
                    quantityPending: item.pending_quantity,
                    quantityReturned: item.pending_quantity, // Default to returning all pending
                    condition: 'GOOD',
                    damageNotes: '',
                    requiresMaintenance: false,
                }));
            setItemsState(initial);
            setReceiptNotes('');
        }
    });

    const updateItem = (index: number, patch: Partial<ReturnItemState>) => {
        setItemsState((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], ...patch };
            return next;
        });
    };

    const handleSubmit = async (e: Event) => {
        e.preventDefault();
        if (!props.loanId) return;

        const itemsToReturn = itemsState().filter((i) => i.quantityReturned > 0);
        if (itemsToReturn.length === 0) {
            toast.error('Debe ingresar al menos una cantidad a devolver');
            return;
        }

        try {
            await returnMutation.mutateAsync({
                id: props.loanId,
                body: {
                    notes: receiptNotes() || undefined,
                    items: itemsToReturn.map((i) => ({
                        loanItemId: i.loanItemId,
                        quantityReturned: i.quantityReturned,
                        condition: i.condition,
                        damageNotes: i.damageNotes || undefined,
                        requiresMaintenance: i.requiresMaintenance,
                    })),
                },
            });
            toast.success('Devolución e inspección registradas correctamente');
            props.onClose();
        } catch (err: any) {
            toast.error(err?.message || 'Error al registrar la devolución');
        }
    };

    return (
        <FormDialog
            isOpen={props.isOpen}
            onClose={props.onClose}
            title={`Registrar Devolución — ${loanQuery.data?.code || 'Cargando...'}`}
            subtitle={loanQuery.data ? `Custodio: ${loanQuery.data.borrower_name}` : undefined}
            maxWidth="2xl"
            submitLabel="Confirmar Devolución"
            isLoading={returnMutation.isPending}
            onSubmit={handleSubmit}
        >
            <Show
                when={!loanQuery.isLoading}
                fallback={
                    <div class="space-y-4 py-4">
                        <SkeletonLoader type="text" count={3} />
                    </div>
                }
            >
                <div class="space-y-5 py-2">
                    <p class="text-xs text-muted">
                        Inspecciona cada herramienta devuelta. Si el equipo presenta daños o requiere calibración/mantenimiento, especifícalo a continuación.
                    </p>

                    <div class="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
                        <For each={itemsState()}>
                            {(item, idx) => (
                                <div class="p-4 rounded-2xl bg-surface/40 border border-border/50 space-y-3">
                                    <div class="flex items-start justify-between gap-2">
                                        <div>
                                            <h4 class="text-sm font-bold text-text">{item.productName}</h4>
                                            <span class="text-xs font-mono text-muted">SKU: {item.sku}</span>
                                        </div>
                                        <div class="text-right">
                                            <span class="text-xs text-muted block">Pendiente:</span>
                                            <span class="text-sm font-bold text-warning font-mono">
                                                {item.quantityPending}
                                            </span>
                                        </div>
                                    </div>

                                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-border/30">
                                        <div>
                                            <label class="text-xs font-medium text-muted block mb-1">
                                                Cantidad a Devolver
                                            </label>
                                            <input
                                                type="number"
                                                step="any"
                                                min="0"
                                                max={item.quantityPending}
                                                value={item.quantityReturned}
                                                onInput={(e) =>
                                                    updateItem(idx(), { quantityReturned: Number(e.currentTarget.value) })
                                                }
                                                class="w-full h-9 px-3 text-sm rounded-xl bg-card border border-border/60 focus:border-primary focus:outline-hidden font-mono"
                                            />
                                        </div>

                                        <div>
                                            <label class="text-xs font-medium text-muted block mb-1">
                                                Condición Física
                                            </label>
                                            <select
                                                value={item.condition}
                                                onChange={(e) =>
                                                    updateItem(idx(), {
                                                        condition: e.currentTarget.value as Condition,
                                                        requiresMaintenance:
                                                            e.currentTarget.value === 'DAMAGED' ||
                                                            e.currentTarget.value === 'UNUSABLE',
                                                    })
                                                }
                                                class="w-full h-9 px-3 text-sm rounded-xl bg-card border border-border/60 focus:border-primary focus:outline-hidden"
                                            >
                                                <option value="GOOD">Buen Estado (Operativo)</option>
                                                <option value="DAMAGED">Con Daño / Desgaste</option>
                                                <option value="UNUSABLE">Inservible / Destruido</option>
                                            </select>
                                        </div>
                                    </div>

                                    <Show when={item.condition !== 'GOOD'}>
                                        <div class="space-y-2 pt-1 animate-in fade-in duration-150">
                                            <input
                                                type="text"
                                                placeholder="Detalle del daño o peritaje..."
                                                value={item.damageNotes}
                                                onInput={(e) =>
                                                    updateItem(idx(), { damageNotes: e.currentTarget.value })
                                                }
                                                class="w-full h-9 px-3 text-xs rounded-xl bg-card border border-warning/40 focus:border-warning focus:outline-hidden"
                                            />
                                            <div class="flex items-center gap-2">
                                                <Checkbox
                                                    checked={item.requiresMaintenance}
                                                    onChange={(checked) =>
                                                        updateItem(idx(), { requiresMaintenance: checked })
                                                    }
                                                />
                                                <span class="text-xs text-muted">
                                                    Enviar a mantenimiento / revisión técnica
                                                </span>
                                            </div>
                                        </div>
                                    </Show>
                                </div>
                            )}
                        </For>
                    </div>

                    <div>
                        <label class="text-xs font-medium text-muted block mb-1">
                            Notas Generales del Acta de Recepción
                        </label>
                        <textarea
                            rows="2"
                            placeholder="Observaciones generales sobre la entrega (opcional)..."
                            value={receiptNotes()}
                            onInput={(e) => setReceiptNotes(e.currentTarget.value)}
                            class="w-full p-3 text-xs rounded-xl bg-surface/30 border border-border/50 focus:border-primary focus:outline-hidden resize-none"
                        />
                    </div>
                </div>
            </Show>
        </FormDialog>
    );
};
