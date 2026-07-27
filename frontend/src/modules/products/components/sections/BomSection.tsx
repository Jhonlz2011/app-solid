/**
 * BomSection — Bill of Materials (BOM) / Composition section for COMPUESTO and FABRICADO products.
 * Manages parent-child product components stored in `product_components`.
 */
import { Component, For, Show, createSignal, createMemo } from 'solid-js';
import type { ProductComponentFormData } from '@app/schema/frontend';
import type { Product } from '@/modules/products/data/products.api';
import TextField from '@shared/ui/TextField';
import Button from '@shared/ui/Button';
import Switch from '@shared/ui/Switch';
import { ProductSelect } from '@shared/ui/selectors';
import { PlusIcon, TrashIcon } from '@shared/ui/icons';
import SectionHeader from '../ui/SectionHeader';

interface BomSectionProps {
    form: any;
    currentProductId?: number;
}

export const BomSection: Component<BomSectionProps> = (props) => {
    const components = props.form.useStore((s: any) => s.values.components ?? []) as () => ProductComponentFormData[];

    // New component input draft
    const [selectedProduct, setSelectedProduct] = createSignal<Product | null>(null);
    const [quantity, setQuantity] = createSignal(1);
    const [isReversible, setIsReversible] = createSignal(true);
    const [notes, setNotes] = createSignal('');

    const addComponent = () => {
        const prod = selectedProduct();
        if (!prod || quantity() <= 0) return;

        const current = props.form.getFieldValue('components') as ProductComponentFormData[] ?? [];
        
        // Prevent duplicate components
        if (current.some(c => c.component_product_id === prod.id)) {
            return;
        }

        const newEntry: ProductComponentFormData = {
            id: null,
            component_product_id: prod.id,
            quantity_per_parent: quantity(),
            is_reversible: isReversible(),
            notes: notes() || null,
        };

        props.form.setFieldValue('components', [...current, newEntry]);

        // Reset draft
        setSelectedProduct(null);
        setQuantity(1);
        setNotes('');
    };

    const removeComponent = (index: number) => {
        const current = props.form.getFieldValue('components') as ProductComponentFormData[] ?? [];
        props.form.setFieldValue('components', current.filter((_, i) => i !== index));
    };

    return (
        <fieldset class="space-y-4 bg-surface/30 p-4 sm:p-5 rounded-2xl border border-border/40">
            <SectionHeader
                color="accent"
                title="Lista de Materiales / Componentes (BOM)"
                description="Especifica los productos que componen este ítem (Kit, Combo o Fórmula)"
            />

            {/* List of current components */}
            <Show
                when={components().length > 0}
                fallback={
                    <div class="py-6 text-center border border-dashed border-border/60 rounded-xl bg-card/50">
                        <span class="text-2xl mb-1 block">🧩</span>
                        <p class="text-xs font-semibold text-text">Sin componentes asignados</p>
                        <p class="text-[11px] text-muted">Agrega productos al kit o combo utilizando el formulario de abajo.</p>
                    </div>
                }
            >
                <div class="space-y-2">
                    <div class="hidden sm:grid grid-cols-[1fr_100px_100px_36px] gap-3 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                        <div>Componente</div>
                        <div>Cantidad</div>
                        <div>Reversible</div>
                        <div />
                    </div>

                    <For each={components()}>
                        {(comp, idx) => (
                            <div class="grid grid-cols-1 sm:grid-cols-[1fr_100px_100px_36px] gap-3 items-center px-3 py-2.5 rounded-xl bg-card border border-border/40">
                                <div>
                                    <p class="text-sm font-semibold text-text">
                                        Producto #{comp.component_product_id}
                                    </p>
                                    <Show when={comp.notes}>
                                        <p class="text-[11px] text-muted">{comp.notes}</p>
                                    </Show>
                                </div>

                                <div class="text-sm font-mono font-medium">
                                    {comp.quantity_per_parent}
                                </div>

                                <div>
                                    <Show
                                        when={comp.is_reversible}
                                        fallback={
                                            <span class="text-[10px] px-2 py-0.5 rounded-md bg-muted/10 text-muted font-semibold uppercase">No</span>
                                        }
                                    >
                                        <span class="text-[10px] px-2 py-0.5 rounded-md bg-success/10 text-success font-semibold uppercase">Sí</span>
                                    </Show>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => removeComponent(idx())}
                                    class="p-1.5 rounded-lg text-muted/40 hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                                    title="Eliminar componente"
                                >
                                    <TrashIcon class="size-4" />
                                </button>
                            </div>
                        )}
                    </For>
                </div>
            </Show>

            {/* Add new component draft row */}
            <div class="pt-2 border-t border-border/30 space-y-3">
                <p class="text-xs font-semibold text-text">Agregar Componente</p>

                <div class="grid grid-cols-1 sm:grid-cols-[1fr_100px_auto] gap-3 items-end">
                    <ProductSelect
                        value={selectedProduct()?.id}
                        onChange={setSelectedProduct}
                        excludeProductId={props.currentProductId}
                        placeholder="Buscar producto para agregar al BOM..."
                    />

                    <TextField.Root value={String(quantity())} onChange={(v) => setQuantity(Number(v) || 1)}>
                        <TextField.Label>Cantidad</TextField.Label>
                        <TextField.Input type="number" min={0.01} step="0.01" />
                    </TextField.Root>

                    <Button
                        type="button"
                        size="sm"
                        onClick={addComponent}
                        disabled={!selectedProduct()}
                        icon={<PlusIcon class="size-3.5" />}
                    >
                        Agregar
                    </Button>
                </div>
            </div>
        </fieldset>
    );
};

export default BomSection;
