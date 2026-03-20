/**
 * SupplierCard — Mobile card representation of a single supplier.
 *
 * Displays the most important supplier data in a compact, tappable card.
 * Actions (Edit / Delete / Restore) are exposed via inline icon buttons.
 */
import { Component, Show } from 'solid-js';
import type { SupplierListItem } from '../data/suppliers.api';
import { useAuth } from '@/modules/auth/store/auth.store';
import { StatusBadge, Badge } from '@shared/ui/Badge';
import { EditIcon, TrashIcon, RotateCcwIcon} from '@shared/ui/icons';
import Checkbox from '@shared/ui/Checkbox';
import { cn } from '@shared/lib/utils';
import Button from '@shared/ui/Button';

export interface SupplierCardProps {
    supplier: SupplierListItem;
    isSelected: boolean;
    onSelect: (checked: boolean) => void;
    onView: (supplier: SupplierListItem) => void;
    onEdit: (supplier: SupplierListItem) => void;
    onDelete: (supplier: SupplierListItem) => void;
    onRestore: (supplier: SupplierListItem) => void;
}

export const SupplierCard: Component<SupplierCardProps> = (props) => {
    const auth = useAuth();
    const canDestroy = () => auth.hasPermission('suppliers.destroy');

    return (
        <div
            class={cn(
                'group relative flex items-start gap-3 px-3 py-3.5',
                'bg-card border-b border-border',
                'transition-colors duration-150',
                'active:bg-surface-2',
                props.isSelected && 'bg-row-selected',
            )}
            onClick={() => props.onView(props.supplier)}
        >
            {/* Left: checkbox + active accent */}
            <div
                class={cn(
                    'absolute left-0 top-0 bottom-0 w-0.5 rounded-r',
                    props.supplier.is_active ? 'bg-emerald-500' : 'bg-border',
                )}
            />

            {/* Checkbox — stops propagation so click doesn't trigger onView */}
            <div class="pt-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                    checked={props.isSelected}
                    onChange={props.onSelect}
                />
            </div>

            {/* Content */}
            <div class="flex-1 min-w-0">
                {/* Row 1: name + status */}
                <div class="flex items-start justify-between gap-2">
                    <span class="font-semibold text-text text-sm leading-tight truncate">
                        {props.supplier.business_name}
                    </span>
                    <StatusBadge isActive={props.supplier.is_active} />
                </div>

                {/* Row 2: trade name */}
                <Show when={props.supplier.trade_name}>
                    <p class="text-xs text-muted truncate mt-0.5">
                        {props.supplier.trade_name}
                    </p>
                </Show>

                {/* Row 3: tax_id + person type + email */}
                <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span class="font-mono text-xs text-primary font-semibold">
                        {props.supplier.tax_id}
                    </span>
                    <Badge
                        variant={props.supplier.person_type === 'JURIDICA' ? 'primary' : 'info'}
                        class="text-[10px] px-1.5 py-0"
                    >
                        {props.supplier.person_type === 'JURIDICA' ? 'Jurídica' : 'Natural'}
                    </Badge>
                </div>

                <Show when={props.supplier.email_billing}>
                    <p class="text-xs text-muted truncate mt-0.5">
                        {props.supplier.email_billing}
                    </p>
                </Show>
            </div>

            {/* Right: actions */}
            <div
                class="flex items-center gap-0.5 shrink-0 self-center"
                onClick={(e) => e.stopPropagation()}
            >
                <Show
                    when={props.supplier.is_active}
                    fallback={
                        <>
                            <Button
                                variant="ghost"
                                size="icon"
                                class="h-8 w-8 text-muted hover:text-emerald-400 hover:bg-emerald-500/10"
                                title="Restaurar"
                                
                                onClick={() => props.onRestore(props.supplier)}
                            >
                                <RotateCcwIcon class="size-4" />
                            </Button>
                            <Show when={canDestroy()}>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    class="size-8 text-muted hover:text-danger hover:bg-danger/10 shadow-none" 
                                    title="Eliminar permanentemente"
                                    onClick={() => props.onDelete(props.supplier)}
                                >
                                    <TrashIcon class="size-4" />
                                </Button>
                            </Show>
                        </>
                    }
                >
                    <Button
                        variant="ghost"
                        size="icon"
                        class="h-8 w-8 text-muted hover:text-info hover:bg-info/10"
                        title="Editar"
                        onClick={() => props.onEdit(props.supplier)}
                    >
                        <EditIcon class="size-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        class="h-8 w-8 text-muted hover:text-danger hover:bg-danger/10"
                        title="Eliminar"
                        onClick={() => props.onDelete(props.supplier)}
                    >
                        <TrashIcon class="size-4" />
                    </Button>
                </Show>
            </div>
        </div>
    );
};
