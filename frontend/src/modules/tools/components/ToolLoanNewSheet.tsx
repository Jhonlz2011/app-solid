import { Component, createSignal, For, Show } from 'solid-js';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { useCreateToolLoan } from '../data/tools.mutations';
import { useEmployees } from '@modules/employees/data/employees.queries';
import { useProducts } from '@modules/products/data/products.queries';
import { toast } from 'solid-sonner';
import Sheet from '@overlay/Sheet';
import Button from '@form/Button';
import { FloppyDiskIcon } from '@icons/FloppyDiskIcon';
import { PlusIcon } from '@icons/PlusIcon';
import { TrashIcon } from '@icons/TrashIcon';
import type { RequestDestination } from '@app/schema/enums';

interface ToolLoanNewSheetProps {
    onClose?: () => void;
}

interface NewLoanItem {
    variantId: number;
    quantityLoaned: number;
    notes: string;
}

export const ToolLoanNewSheet: Component<ToolLoanNewSheetProps> = (props) => {
    const { bindDismiss, close } = useSheetNavigation(props);
    const createMutation = useCreateToolLoan();

    // Data queries
    const employeesQuery = useEmployees(() => ({ limit: 100 }));
    const productsQuery = useProducts(() => ({ limit: 100 }));

    // Form state
    const [borrowerId, setBorrowerId] = createSignal('');
    const [destinationType, setDestinationType] = createSignal<RequestDestination>('WORKSHOP');
    const [locationDetail, setLocationDetail] = createSignal('');
    
    // Default expected return date = tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const defaultDateStr = tomorrow.toISOString().split('T')[0];
    const [expectedReturnDate, setExpectedReturnDate] = createSignal(defaultDateStr);

    const [generalNotes, setGeneralNotes] = createSignal('');
    const [items, setItems] = createSignal<NewLoanItem[]>([
        { variantId: 0, quantityLoaned: 1, notes: '' },
    ]);

    const addItem = () => {
        setItems((prev) => [...prev, { variantId: 0, quantityLoaned: 1, notes: '' }]);
    };

    const removeItem = (index: number) => {
        if (items().length <= 1) return;
        setItems((prev) => prev.filter((_, i) => i !== index));
    };

    const updateItem = (index: number, patch: Partial<NewLoanItem>) => {
        setItems((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], ...patch };
            return next;
        });
    };

    const handleSubmit = async (e: Event) => {
        e.preventDefault();

        if (!borrowerId()) {
            toast.error('Debe seleccionar un custodio (empleado)');
            return;
        }

        const validItems = items().filter((i) => i.variantId > 0 && i.quantityLoaned > 0);
        if (validItems.length === 0) {
            toast.error('Debe seleccionar al menos una herramienta válida');
            return;
        }

        try {
            await createMutation.mutateAsync({
                borrowerId: borrowerId(),
                destinationType: destinationType(),
                locationDetail: locationDetail() || undefined,
                expectedReturnDate: expectedReturnDate(),
                notes: generalNotes() || undefined,
                items: validItems.map((i) => ({
                    variantId: i.variantId,
                    quantityLoaned: i.quantityLoaned,
                    notes: i.notes || undefined,
                })),
            });
            toast.success('Vale de préstamo de herramientas creado exitosamente');
            close();
        } catch (err: any) {
            toast.error(err?.message || 'Error al emitir el préstamo');
        }
    };

    // Flatten all variants from products
    const availableVariants = () => {
        const prods = productsQuery.data?.data || [];
        const result: Array<{ id: number; label: string }> = [];
        for (const p of prods) {
            const variantId = (p as any).default_variant_id || p.id;
            const sku = (p as any).default_sku ? ` [${(p as any).default_sku}]` : '';
            result.push({
                id: variantId,
                label: `${p.name}${sku}`,
            });
        }
        return result;
    };

    return (
        <Sheet
            isOpen={true}
            onClose={close}
            bindDismiss={bindDismiss}
            title="Nuevo Vale de Préstamo"
            description="Asigna herramientas y equipos a un empleado custodio"
            size="lg"
            footer={
                <>
                    <Button variant="outline" onClick={close} disabled={createMutation.isPending}>
                        Cancelar
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        disabled={createMutation.isPending}
                        icon={<FloppyDiskIcon />}
                    >
                        {createMutation.isPending ? 'Guardando...' : 'Emitir Préstamo'}
                    </Button>
                </>
            }
        >
            <form onSubmit={handleSubmit} class="space-y-5 p-1">
                {/* 1. Custodian & Destination */}
                <div class="p-4 rounded-2xl bg-surface/30 border border-border/50 space-y-4">
                    <h3 class="text-xs font-bold uppercase tracking-wider text-muted">
                        Datos del Custodio y Destino
                    </h3>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label class="text-xs font-medium text-muted block mb-1">
                                Custodio Responsable (Empleado) *
                            </label>
                            <select
                                value={borrowerId()}
                                onChange={(e) => setBorrowerId(e.currentTarget.value)}
                                class="w-full h-10 px-3 text-sm rounded-xl bg-card border border-border/60 focus:border-primary focus:outline-hidden"
                            >
                                <option value="">Seleccionar empleado...</option>
                                <For each={employeesQuery.data?.data || []}>
                                    {(emp) => (
                                        <option value={emp.id}>
                                            {emp.business_name} ({emp.tax_id || ''})
                                        </option>
                                    )}
                                </For>
                            </select>
                        </div>

                        <div>
                            <label class="text-xs font-medium text-muted block mb-1">
                                Destino del Equipo
                            </label>
                            <select
                                value={destinationType()}
                                onChange={(e) => setDestinationType(e.currentTarget.value as RequestDestination)}
                                class="w-full h-10 px-3 text-sm rounded-xl bg-card border border-border/60 focus:border-primary focus:outline-hidden"
                            >
                                <option value="WORKSHOP">Taller Interno</option>
                                <option value="FIELD_SITE">Obra / Sitio Externo</option>
                            </select>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Show when={destinationType() === 'FIELD_SITE'}>
                            <div>
                                <label class="text-xs font-medium text-muted block mb-1">
                                    Dirección / Obra
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ej: Proyecto Edificio Sky, Piso 4"
                                    value={locationDetail()}
                                    onInput={(e) => setLocationDetail(e.currentTarget.value)}
                                    class="w-full h-10 px-3 text-sm rounded-xl bg-card border border-border/60 focus:border-primary focus:outline-hidden"
                                />
                            </div>
                        </Show>

                        <div>
                            <label class="text-xs font-medium text-muted block mb-1">
                                Fecha Estimada de Devolución *
                            </label>
                            <input
                                type="date"
                                value={expectedReturnDate()}
                                onInput={(e) => setExpectedReturnDate(e.currentTarget.value)}
                                class="w-full h-10 px-3 text-sm rounded-xl bg-card border border-border/60 focus:border-primary focus:outline-hidden font-mono"
                            />
                        </div>
                    </div>
                </div>

                {/* 2. Items List */}
                <div class="p-4 rounded-2xl bg-surface/30 border border-border/50 space-y-3">
                    <div class="flex items-center justify-between">
                        <h3 class="text-xs font-bold uppercase tracking-wider text-muted">
                            Herramientas y Equipos a Despachar
                        </h3>
                        <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={addItem}
                            icon={<PlusIcon class="size-4" />}
                        >
                            Agregar Fila
                        </Button>
                    </div>

                    <div class="space-y-3">
                        <For each={items()}>
                            {(item, idx) => (
                                <div class="flex flex-col sm:flex-row items-center gap-2 p-2 rounded-xl bg-card border border-border/40">
                                    <div class="flex-1 w-full">
                                        <select
                                            value={item.variantId}
                                            onChange={(e) =>
                                                updateItem(idx(), { variantId: Number(e.currentTarget.value) })
                                            }
                                            class="w-full h-9 px-3 text-xs rounded-lg bg-surface/40 border border-border/60 focus:border-primary focus:outline-hidden"
                                        >
                                            <option value={0}>Seleccionar herramienta...</option>
                                            <For each={availableVariants()}>
                                                {(v) => <option value={v.id}>{v.label}</option>}
                                            </For>
                                        </select>
                                    </div>

                                    <div class="w-full sm:w-28">
                                        <input
                                            type="number"
                                            min="1"
                                            step="1"
                                            placeholder="Cant."
                                            value={item.quantityLoaned}
                                            onInput={(e) =>
                                                updateItem(idx(), { quantityLoaned: Number(e.currentTarget.value) })
                                            }
                                            class="w-full h-9 px-3 text-xs rounded-lg bg-surface/40 border border-border/60 focus:border-primary focus:outline-hidden font-mono text-center"
                                        />
                                    </div>

                                    <div class="flex-1 w-full">
                                        <input
                                            type="text"
                                            placeholder="Observaciones / nro de serie..."
                                            value={item.notes}
                                            onInput={(e) => updateItem(idx(), { notes: e.currentTarget.value })}
                                            class="w-full h-9 px-3 text-xs rounded-lg bg-surface/40 border border-border/60 focus:border-primary focus:outline-hidden"
                                        />
                                    </div>

                                    <Show when={items().length > 1}>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            type="button"
                                            onClick={() => removeItem(idx())}
                                            class="text-muted hover:text-danger p-1 h-8 w-8 shrink-0"
                                        >
                                            <TrashIcon class="size-4" />
                                        </Button>
                                    </Show>
                                </div>
                            )}
                        </For>
                    </div>
                </div>

                {/* 3. General Notes */}
                <div>
                    <label class="text-xs font-medium text-muted block mb-1">
                        Notas del Vale de Salida
                    </label>
                    <textarea
                        rows="2"
                        placeholder="Observaciones generales para el pañolero o custodio..."
                        value={generalNotes()}
                        onInput={(e) => setGeneralNotes(e.currentTarget.value)}
                        class="w-full p-3 text-xs rounded-xl bg-surface/30 border border-border/50 focus:border-primary focus:outline-hidden resize-none"
                    />
                </div>
            </form>
        </Sheet>
    );
};

export default ToolLoanNewSheet;
