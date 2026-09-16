import { Component, createSignal, For, Show } from 'solid-js';
import type { ProductVariantFormData } from '@app/schema/frontend';
import { BARCODE_TYPES, type BarcodeType } from '@app/schema/enums';
import { CloseIcon } from '@icons/CloseIcon';
import { FloppyDiskIcon } from '@icons/FloppyDiskIcon';
import { SparklesIcon } from '@icons/SparklesIcon';

export interface BulkVariantEditorModalProps {
    isOpen: boolean;
    variants: ProductVariantFormData[];
    onClose: () => void;
    onSave: (updatedVariants: ProductVariantFormData[]) => void;
}

export const BulkVariantEditorModal: Component<BulkVariantEditorModalProps> = (props) => {
    const [localVariants, setLocalVariants] = createSignal<ProductVariantFormData[]>([]);
    const [bulkPrice, setBulkPrice] = createSignal<string>('');
    const [bulkBarcodeType, setBulkBarcodeType] = createSignal<BarcodeType>('CUSTOM');

    // Sync from props on open
    createSignal(() => {
        if (props.isOpen) {
            setLocalVariants(JSON.parse(JSON.stringify(props.variants)));
        }
    });

    const updateVariantField = <K extends keyof ProductVariantFormData>(
        index: number,
        field: K,
        value: ProductVariantFormData[K]
    ) => {
        setLocalVariants((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const setDefaultVariant = (selectedIndex: number) => {
        setLocalVariants((prev) =>
            prev.map((v, idx) => ({
                ...v,
                is_default: idx === selectedIndex,
            }))
        );
    };

    const applyBulkPrice = () => {
        const priceNum = parseFloat(bulkPrice());
        if (isNaN(priceNum) || priceNum < 0) return;
        setLocalVariants((prev) =>
            prev.map((v) => ({
                ...v,
                unit_price: priceNum,
            }))
        );
    };

    const applyBulkBarcodeType = () => {
        setLocalVariants((prev) =>
            prev.map((v) => ({
                ...v,
                barcode_type: bulkBarcodeType(),
            }))
        );
    };

    const handleSave = () => {
        props.onSave(localVariants());
        props.onClose();
    };

    return (
        <Show when={props.isOpen}>
            <div
                class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in duration-150"
                role="dialog"
                aria-modal="true"
                aria-labelledby="bulk-editor-title"
            >
                <div class="relative w-full max-w-5xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                    {/* Header */}
                    <div class="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                        <div>
                            <h3 id="bulk-editor-title" class="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                                Editor Masivo de Variantes
                            </h3>
                            <p class="text-xs text-zinc-500 dark:text-zinc-400">
                                Edita rápidamente SKUs, precios, códigos de barra y estados de todas las variantes.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={props.onClose}
                            class="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                            <CloseIcon class="w-5 h-5" />
                        </button>
                    </div>

                    {/* Quick Bulk Actions Toolbar */}
                    <div class="px-6 py-2.5 bg-zinc-50 dark:bg-zinc-800/40 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center gap-4 text-xs">
                        <div class="flex items-center gap-2">
                            <span class="text-zinc-500 font-medium">Asignar Precio Masivo:</span>
                            <div class="relative w-28">
                                <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400">$</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    value={bulkPrice()}
                                    onInput={(e) => setBulkPrice(e.currentTarget.value)}
                                    class="w-full pl-6 pr-2 py-1 text-xs rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-primary-500"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={applyBulkPrice}
                                class="px-2.5 py-1 rounded-md bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200 font-medium transition-colors"
                            >
                                Aplicar a Todas
                            </button>
                        </div>

                        <div class="h-4 w-px bg-zinc-300 dark:bg-zinc-700" />

                        <div class="flex items-center gap-2">
                            <span class="text-zinc-500 font-medium">Tipo de Código:</span>
                            <select
                                value={bulkBarcodeType()}
                                onChange={(e) => setBulkBarcodeType(e.currentTarget.value as BarcodeType)}
                                class="py-1 px-2 text-xs rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                            >
                                <For each={BARCODE_TYPES}>
                                    {(type) => <option value={type}>{type}</option>}
                                </For>
                            </select>
                            <button
                                type="button"
                                onClick={applyBulkBarcodeType}
                                class="px-2.5 py-1 rounded-md bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200 font-medium transition-colors"
                            >
                                Aplicar Tipo
                            </button>
                        </div>
                    </div>

                    {/* Spreadsheet Table */}
                    <div class="flex-1 overflow-auto p-6">
                        <table class="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr class="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-medium">
                                    <th class="pb-2 w-12 text-center">Activo</th>
                                    <th class="pb-2 w-14 text-center">Default</th>
                                    <th class="pb-2 min-w-[140px]">Variante</th>
                                    <th class="pb-2 min-w-[150px]">SKU</th>
                                    <th class="pb-2 min-w-[110px]">Precio Unitario ($)</th>
                                    <th class="pb-2 min-w-[110px]">Último Costo ($)</th>
                                    <th class="pb-2 min-w-[140px]">Código de Barras</th>
                                    <th class="pb-2 min-w-[110px]">Tipo Código</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
                                <For each={localVariants()}>
                                    {(variant, idx) => (
                                        <tr class="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition-colors">
                                            {/* Is Active */}
                                            <td class="py-2 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={variant.is_active}
                                                    onChange={(e) => updateVariantField(idx(), 'is_active', e.currentTarget.checked)}
                                                    class="rounded text-primary-600 focus:ring-primary-500 cursor-pointer"
                                                />
                                            </td>

                                            {/* Is Default */}
                                            <td class="py-2 text-center">
                                                <input
                                                    type="radio"
                                                    name="bulk-default-variant"
                                                    checked={variant.is_default}
                                                    onChange={() => setDefaultVariant(idx())}
                                                    class="text-primary-600 focus:ring-primary-500 cursor-pointer"
                                                />
                                            </td>

                                            {/* Variant Name */}
                                            <td class="py-2 font-medium text-zinc-900 dark:text-zinc-100 pr-2">
                                                {variant.variant_name || `Variante #${idx() + 1}`}
                                            </td>

                                            {/* SKU */}
                                            <td class="py-2 pr-2">
                                                <input
                                                    type="text"
                                                    value={variant.sku}
                                                    onInput={(e) => updateVariantField(idx(), 'sku', e.currentTarget.value)}
                                                    class="w-full px-2 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-primary-500"
                                                />
                                            </td>

                                            {/* Unit Price */}
                                            <td class="py-2 pr-2">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={variant.unit_price ?? ''}
                                                    onInput={(e) => {
                                                        const val = e.currentTarget.value;
                                                        updateVariantField(idx(), 'unit_price', val === '' ? null : parseFloat(val));
                                                    }}
                                                    placeholder="Heredar"
                                                    class="w-full px-2 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-primary-500"
                                                />
                                            </td>

                                            {/* Last Cost */}
                                            <td class="py-2 pr-2">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={variant.last_cost ?? ''}
                                                    onInput={(e) => {
                                                        const val = e.currentTarget.value;
                                                        updateVariantField(idx(), 'last_cost', val === '' ? null : parseFloat(val));
                                                    }}
                                                    class="w-full px-2 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-primary-500"
                                                />
                                            </td>

                                            {/* Barcode */}
                                            <td class="py-2 pr-2">
                                                <input
                                                    type="text"
                                                    value={variant.barcode ?? ''}
                                                    onInput={(e) => updateVariantField(idx(), 'barcode', e.currentTarget.value || null)}
                                                    placeholder="Ej: 7861234567890"
                                                    class="w-full px-2 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-primary-500"
                                                />
                                            </td>

                                            {/* Barcode Type */}
                                            <td class="py-2">
                                                <select
                                                    value={variant.barcode_type ?? 'CUSTOM'}
                                                    onChange={(e) => updateVariantField(idx(), 'barcode_type', e.currentTarget.value as BarcodeType)}
                                                    class="w-full px-2 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                                                >
                                                    <For each={BARCODE_TYPES}>
                                                        {(type) => <option value={type}>{type}</option>}
                                                    </For>
                                                </select>
                                            </td>
                                        </tr>
                                    )}
                                </For>
                            </tbody>
                        </table>
                    </div>

                    {/* Footer */}
                    <div class="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-between">
                        <span class="text-xs text-zinc-500">
                            Total: {localVariants().length} variantes
                        </span>
                        <div class="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={props.onClose}
                                class="px-4 py-2 text-xs font-medium rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                class="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-primary-600 hover:bg-primary-500 text-white transition-colors shadow-xs"
                            >
                                <FloppyDiskIcon class="w-3.5 h-3.5" />
                                Guardar Cambios
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Show>
    );
};

export default BulkVariantEditorModal;
