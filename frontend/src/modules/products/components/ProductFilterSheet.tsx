import { Component } from 'solid-js';
import Sheet from '@shared/ui/Sheet';

interface ProductFilterSheetProps {
    isOpen: boolean;
    onClose: () => void;
    filters: Record<string, {
        options: () => { value: string; label?: string; count: number }[];
        selected: () => string[];
        onChange: (selected: string[]) => void;
        isLoading: () => boolean;
    }>;
}

const filterLabels: Record<string, string> = {
    categoryId: 'Categoría',
    brandId: 'Marca',
    productType: 'Tipo',
    isActive: 'Estado',
};

export const ProductFilterSheet: Component<ProductFilterSheetProps> = (props) => {
    return (
        <Sheet
            isOpen={props.isOpen}
            onClose={props.onClose}
            title="Filtros"
            size="sm"
        >
            <div class="space-y-6">
                {Object.entries(props.filters).map(([key, config]) => (
                    <div>
                        <h4 class="text-sm font-semibold text-text mb-2">{filterLabels[key] || key}</h4>
                        <div class="space-y-1">
                            {config.options().map((option) => (
                                <label class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface/50 cursor-pointer text-sm">
                                    <input
                                        type="checkbox"
                                        class="rounded border-border"
                                        checked={config.selected().includes(option.value)}
                                        onChange={(e) => {
                                            const current = config.selected();
                                            if (e.currentTarget.checked) {
                                                config.onChange([...current, option.value]);
                                            } else {
                                                config.onChange(current.filter(v => v !== option.value));
                                            }
                                        }}
                                    />
                                    <span class="flex-1">{option.label || option.value}</span>
                                    <span class="text-xs text-muted tabular-nums bg-surface px-1.5 py-0.5 rounded">{option.count}</span>
                                </label>
                            ))}
                            {config.options().length === 0 && !config.isLoading() && (
                                <p class="text-xs text-muted py-2">Sin opciones</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </Sheet>
    );
};
