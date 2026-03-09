/**
 * SupplierDeleteDialog — RBAC-aware, zero layout-shift, responsive.
 *
 * Anti-shift strategy:
 *  - Radio dots: always in DOM, toggled via CSS opacity+scale (never mounted/unmounted)
 *  - Badge slot: fixed size-5 container with two absolute layers (spinner / warning)
 *  - Uses shared <Popover> from @shared/ui for the reference details
 */
import { Component, Show, For, createSignal } from 'solid-js';
import { Dialog } from '@kobalte/core';
import { useAuth } from '@/modules/auth/store/auth.store';
import {
    useDeleteSupplier,
    useHardDeleteSupplier,
    useCheckSupplierReferences,
    type SupplierListItem,
    type SupplierReferences,
} from '../data/suppliers.api';
import Button from '@shared/ui/Button';
import Popover from '@shared/ui/Popover';
import { CloseIcon, AlertTriangleIcon, TrashIcon, EyeOffIcon } from '@shared/ui/icons';
import { cn } from '@shared/lib/utils';

export interface SupplierDeleteDialogProps {
    supplier: SupplierListItem | null;
    onClose: () => void;
    onSuccess?: () => void;
}

const SupplierDeleteDialog: Component<SupplierDeleteDialogProps> = (props) => {
    const auth = useAuth();
    const canDestroy = () => auth.hasPermission('suppliers:destroy');

    const [mode, setMode] = createSignal<'soft' | 'hard'>('soft');

    const checkEnabled = () => canDestroy() && mode() === 'hard' && props.supplier !== null;

    const refsQuery = useCheckSupplierReferences(
        () => props.supplier?.id ?? null,
        checkEnabled
    );

    const deactivateMutation = useDeleteSupplier();
    const hardDeleteMutation = useHardDeleteSupplier();

    const isLoading = () => deactivateMutation.isPending || hardDeleteMutation.isPending;
    const hasReferences = () => (refsQuery.data?.total ?? 0) > 0;
    const confirmDisabled = () =>
        isLoading() || (mode() === 'hard' && (refsQuery.isFetching || hasReferences()));

    const handleConfirm = () => {
        if (!props.supplier) return;
        const id = props.supplier.id;
        if (mode() === 'hard') {
            hardDeleteMutation.mutate(id, { onSuccess: () => { props.onSuccess?.(); props.onClose(); } });
        } else {
            deactivateMutation.mutate(id, { onSuccess: () => { props.onSuccess?.(); props.onClose(); } });
        }
    };

    const handleOpenChange = (open: boolean) => {
        if (!open) { setMode('soft'); props.onClose(); }
    };

    const referenceLines = () => {
        const data = refsQuery.data as SupplierReferences | undefined;
        if (!data) return [];
        const lines: string[] = [];
        if (data.supplierProducts > 0) lines.push(`${data.supplierProducts} producto(s) vinculado(s)`);
        if (data.invoices > 0) lines.push(`${data.invoices} documento(s) electrónico(s)`);
        if (data.workOrders > 0) lines.push(`${data.workOrders} orden(es) de trabajo`);
        return lines;
    };


    return (
        <Dialog.Root open={!!props.supplier} onOpenChange={handleOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm animate-in fade-in" />

                {/* Responsive: full-screen on mobile, centered modal on sm+ */}
                <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
                    <Dialog.Content class={cn(
                        'bg-card border-t sm:border border-border',
                        'rounded-t-2xl sm:rounded-2xl shadow-2xl',
                        'w-full sm:max-w-md',
                        'animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 fade-in',
                        'overflow-hidden'
                    )}>

                        {/* ── Header ──────────────────────────────── */}
                        <div class="flex items-start justify-between px-5 sm:px-6 pt-5 sm:pt-6 pb-4">
                            <div class="flex items-center gap-3 sm:gap-4">
                                <div class="size-10 sm:size-12 rounded-xl sm:rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                                    <TrashIcon class="size-4 sm:size-5 text-red-400" />
                                </div>
                                <div class="min-w-0">
                                    <Dialog.Title class="text-base sm:text-lg font-semibold text-text">
                                        Eliminar proveedor
                                    </Dialog.Title>
                                    <p
                                        class="text-sm text-muted mt-0.5 truncate max-w-[200px] sm:max-w-[260px]"
                                        title={props.supplier?.business_name}
                                    >
                                        {props.supplier?.business_name}
                                    </p>
                                </div>
                            </div>
                            <Dialog.CloseButton class="p-1.5 rounded-lg hover:bg-surface text-muted cursor-pointer transition-colors shrink-0 -mr-1 -mt-1">
                                <CloseIcon class="size-5" />
                            </Dialog.CloseButton>
                        </div>

                        <div class="px-5 sm:px-6 pb-5 sm:pb-6 space-y-3">

                            {/* ── Dual-mode selector (admins only) ── */}
                            <Show when={canDestroy()}>
                                <div class="space-y-2">

                                    {/* Soft delete */}
                                    <button
                                        type="button"
                                        onClick={() => setMode('soft')}
                                        class={cn(
                                            'w-full flex items-start gap-3 p-3.5 sm:p-4 rounded-xl border text-left cursor-pointer transition-colors',
                                            mode() === 'soft'
                                                ? 'border-primary/50 bg-primary/5'
                                                : 'border-border hover:border-border-strong'
                                        )}
                                    >
                                        {/* Radio dot — always in DOM, CSS-toggled */}
                                        <div class={cn(
                                            'mt-0.5 size-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors duration-150',
                                            mode() === 'soft' ? 'border-primary' : 'border-muted/60'
                                        )}>
                                            <div class={cn(
                                                'size-2 rounded-full bg-primary',
                                                mode() === 'soft' ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
                                            )} />
                                        </div>
                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center gap-2 text-sm font-medium text-text flex-wrap">
                                                <EyeOffIcon class="size-4 text-muted shrink-0" />
                                                Eliminar
                                                <span class="text-xs font-normal text-primary bg-primary/10 px-1.5 py-0.5 rounded-md">
                                                    recomendado
                                                </span>
                                            </div>
                                            <p class="text-xs text-muted mt-1 leading-relaxed">
                                                El proveedor quedará inactivo y podrá restaurarse en cualquier momento.
                                            </p>
                                        </div>
                                    </button>

                                    {/* Hard delete */}
                                    <button
                                        type="button"
                                        onClick={() => setMode('hard')}
                                        class={cn(
                                            'w-full flex items-start gap-3 p-3.5 sm:p-4 rounded-xl border text-left cursor-pointer transition-colors',
                                            mode() === 'hard'
                                                ? 'border-red-500/40 bg-red-500/5'
                                                : 'border-border hover:border-red-500/30 hover:bg-red-500/5'
                                        )}
                                    >
                                        {/* Radio dot — always in DOM, CSS-toggled */}
                                        <div class={cn(
                                            'mt-0.5 size-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors duration-150',
                                            mode() === 'hard' ? 'border-red-500' : 'border-muted/60'
                                        )}>
                                            <div class={cn(
                                                'size-2 rounded-full bg-red-500',
                                                mode() === 'hard' ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
                                            )} />
                                        </div>

                                        <div class="flex-1 min-w-0">
                                            {/*
                                             * Title row: fixed-size slot on the right holds spinner/badge.
                                             * Both states are absolutely-positioned so they never affect text layout.
                                             */}
                                            <div class="flex items-center gap-2 text-sm font-medium text-text">
                                                <TrashIcon class="size-4 text-red-400 shrink-0" />
                                                <span class="flex-1">Destruir permanentemente</span>

                                                {/* Fixed slot — size-5 always reserved, no layout shift */}
                                                <span class="relative size-5 shrink-0 flex items-center justify-center">
                                                    {/* Spinner */}
                                                    <span class={cn(
                                                        'absolute inset-0 flex items-center justify-center transition-opacity duration-150',
                                                        mode() === 'hard' && refsQuery.isFetching ? 'opacity-100' : 'opacity-0'
                                                    )}>
                                                        <span class="size-3.5 border-2 border-muted/30 border-t-muted rounded-full animate-spin" />
                                                    </span>

                                                    {/* Warning badge with shared Popover */}
                                                    <span class={cn(
                                                        'absolute inset-0 flex items-center justify-center transition-opacity duration-150',
                                                        mode() === 'hard' && !refsQuery.isFetching && hasReferences()
                                                            ? 'opacity-100'
                                                            : 'opacity-0 pointer-events-none'
                                                    )}>
                                                        <Popover placement="top-end" gutter={6}>
                                                            <Popover.Trigger
                                                                onClick={(e: MouseEvent) => e.stopPropagation()}
                                                                class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/25 hover:bg-amber-500/25 transition-colors"
                                                            >
                                                                <AlertTriangleIcon class="size-3.5" />
                                                            </Popover.Trigger>

                                                            <Popover.Content class="w-60 sm:w-72 p-3.5 space-y-2">
                                                                <div class="flex items-center gap-2 text-amber-400 text-xs font-semibold">
                                                                    <AlertTriangleIcon class="size-3.5 shrink-0" />
                                                                    No se puede destruir
                                                                </div>
                                                                <p class="text-xs text-muted">
                                                                    Registros vinculados que lo impiden:
                                                                </p>
                                                                <ul class="space-y-1">
                                                                    <For each={referenceLines()}>
                                                                        {(line) => (
                                                                            <li class="text-xs text-text flex items-center gap-2">
                                                                                <span class="size-1.5 rounded-full bg-amber-400/70 shrink-0" />
                                                                                {line}
                                                                            </li>
                                                                        )}
                                                                    </For>
                                                                </ul>
                                                                <p class="text-xs text-muted/70 pt-1 border-t border-border">
                                                                    Usa <strong class="text-muted font-semibold">Eliminar</strong> para ocultar el proveedor conservando el historial.
                                                                </p>
                                                            </Popover.Content>
                                                        </Popover>
                                                    </span>
                                                </span>
                                            </div>

                                            <p class="text-xs text-muted mt-1 leading-relaxed">
                                                Se eliminará de forma definitiva sin posibilidad de recuperación.
                                            </p>
                                        </div>
                                    </button>

                                </div>
                            </Show>

                            {/* Simple description — no destroy permission */}
                            <Show when={!canDestroy()}>
                                <p class="text-sm text-muted leading-relaxed py-1">
                                    El proveedor quedará inactivo y podrá restaurarse en cualquier momento.
                                </p>
                            </Show>

                            {/* ── Actions ─────────────────────────────── */}
                            <div class="flex items-center justify-between gap-2 pt-2 ">
                                <Button
                                    variant="outline"
                                    onClick={props.onClose}
                                    disabled={isLoading()}
                                    class="shrink-0"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    variant={mode() === 'hard' ? 'danger' : 'destructive'}
                                    onClick={handleConfirm}
                                    disabled={confirmDisabled()}
                                    loading={isLoading()}
                                    loadingText={mode() === 'hard' ? 'Destruyendo...' : 'Eliminando...'}
                                    class="shrink-0"
                                >
                                    {mode() === 'hard' ? 'Destruir' : 'Eliminar'}
                                </Button>
                            </div>

                        </div>
                    </Dialog.Content>
                </div>
            </Dialog.Portal>
        </Dialog.Root>
    );
};

export default SupplierDeleteDialog;
