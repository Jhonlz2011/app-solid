import { Component, Show, For, createSignal, JSX, createEffect } from 'solid-js';
import { Dialog } from '@kobalte/core';
import Button from './Button';
import Popover from './Popover';
import { CloseIcon, AlertTriangleIcon, TrashIcon, EyeOffIcon } from './icons';
import { cn } from '../lib/utils';

export interface DeleteDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (mode: 'soft' | 'hard') => void;
    onModeChange?: (mode: 'soft' | 'hard') => void;

    title: string;
    description?: string;
    
    allowHardDelete?: boolean;
    isLoading?: boolean;
    
    softDeleteTitle?: string;
    softDeleteDesc?: string;
    hardDeleteTitle?: string;
    hardDeleteDesc?: string;
    
    softLoadingText?: string;
    hardLoadingText?: string;

    isCheckingDependencies?: boolean;
    hasDependencies?: boolean;
    dependencyWarnings?: string[];
    preventHardDeleteText?: string;
    preventHardDeleteReason?: string;
    preventHardDeleteSuggestion?: JSX.Element;
}

const DeleteDialog: Component<DeleteDialogProps> = (props) => {
    const [mode, setMode] = createSignal<'soft' | 'hard'>('soft');
    
    createEffect(() => {
        if (props.onModeChange) {
            props.onModeChange(mode());
        }
    });

    const handleOpenChange = (open: boolean) => {
        if (!open) { setMode('soft'); props.onClose(); }
    };

    const confirmDisabled = () =>
        props.isLoading || (mode() === 'hard' && (props.isCheckingDependencies || props.hasDependencies));

    return (
        <Dialog.Root open={props.isOpen} onOpenChange={handleOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm animate-in fade-in" />

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
                                <div class="size-10 sm:size-12 rounded-xl sm:rounded-2xl bg-danger/10 border border-danger/20 flex items-center justify-center shrink-0">
                                    <TrashIcon class="size-4 sm:size-5 text-danger" />
                                </div>
                                <div class="min-w-0">
                                    <Dialog.Title class="text-base sm:text-lg font-semibold text-text">
                                        {props.title}
                                    </Dialog.Title>
                                    <p
                                        class="text-sm text-muted mt-0.5 truncate max-w-[200px] sm:max-w-[260px]"
                                        title={props.description}
                                    >
                                        {props.description}
                                    </p>
                                </div>
                            </div>
                            <Dialog.CloseButton class="p-1.5 rounded-lg hover:bg-surface text-muted cursor-pointer transition-colors shrink-0 -mr-1 -mt-1">
                                <CloseIcon class="size-5" />
                            </Dialog.CloseButton>
                        </div>

                        <div class="px-5 sm:px-6 pb-5 sm:pb-6 space-y-3">

                            {/* ── Dual-mode selector (admins only) ── */}
                            <Show when={props.allowHardDelete}>
                                <div class="space-y-2">

                                    {/* Soft delete */}
                                    <button
                                        type="button"
                                        onClick={() => setMode('soft')}
                                        class={cn(
                                            'w-full flex items-start gap-3 p-3.5 sm:p-4 rounded-xl border text-left cursor-pointer transition-colors',
                                            mode() === 'soft'
                                                ? 'border-danger/50 bg-danger/5'
                                                : 'border-border hover:border-border-strong'
                                        )}
                                    >
                                        <div class={cn(
                                            'mt-0.5 size-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors duration-150',
                                            mode() === 'soft' ? 'border-danger' : 'border-muted/60'
                                        )}>
                                            <div class={cn(
                                                'size-2 rounded-full bg-danger',
                                                mode() === 'soft' ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
                                            )} />
                                        </div>
                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center gap-2 text-sm font-medium text-text flex-wrap">
                                                <EyeOffIcon class="size-4 text-muted shrink-0" />
                                                {props.softDeleteTitle || 'Eliminar'}
                                                <span class="text-xs font-normal text-danger bg-danger/10 px-1.5 py-0.5 rounded-md">
                                                    recomendado
                                                </span>
                                            </div>
                                            <p class="text-xs text-muted mt-1 leading-relaxed">
                                                {props.softDeleteDesc || 'El registro quedará inactivo y podrá restaurarse en cualquier momento.'}
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
                                                ? 'border-destructive bg-destructive/5'
                                                : 'border-border hover:border-destructive/30 hover:bg-destructive/5'
                                        )}
                                    >
                                        <div class={cn(
                                            'mt-0.5 size-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors duration-150',
                                            mode() === 'hard' ? 'border-destructive' : 'border-muted/60'
                                        )}>
                                            <div class={cn(
                                                'size-2 rounded-full bg-destructive',
                                                mode() === 'hard' ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
                                            )} />
                                        </div>

                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center gap-2 text-sm font-medium text-text">
                                                <TrashIcon class="size-4 text-destructive shrink-0" />
                                                <span class="flex-1">{props.hardDeleteTitle || 'Destruir permanentemente'}</span>

                                                <span class="relative size-5 shrink-0 flex items-center justify-center">
                                                    <span class={cn(
                                                        'absolute inset-0 flex items-center justify-center transition-opacity duration-150',
                                                        mode() === 'hard' && props.isCheckingDependencies ? 'opacity-100' : 'opacity-0'
                                                    )}>
                                                        <span class="size-3.5 border-2 border-muted/30 border-t-muted rounded-full animate-spin" />
                                                    </span>

                                                    <span class={cn(
                                                        'absolute inset-0 flex items-center justify-center transition-opacity duration-150',
                                                        mode() === 'hard' && !props.isCheckingDependencies && props.hasDependencies
                                                            ? 'opacity-100'
                                                            : 'opacity-0 pointer-events-none'
                                                    )}>
                                                        <Popover placement="top-end" gutter={6}>
                                                            <Popover.Trigger
                                                                onClick={(e: MouseEvent) => e.stopPropagation()}
                                                                class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-warning/15 text-warning border border-warning/25 hover:bg-warning/25 transition-colors"
                                                            >
                                                                <AlertTriangleIcon class="size-3.5" />
                                                            </Popover.Trigger>

                                                            <Popover.Content class="w-60 sm:w-72 p-3.5 space-y-2">
                                                                <div class="flex items-center gap-2 text-warning text-xs font-semibold">
                                                                    <AlertTriangleIcon class="size-3.5 shrink-0" />
                                                                    {props.preventHardDeleteText || 'No se puede destruir'}
                                                                </div>
                                                                <p class="text-xs text-muted">
                                                                    {props.preventHardDeleteReason || 'Registros vinculados que lo impiden:'}
                                                                </p>
                                                                <ul class="space-y-1">
                                                                    <For each={props.dependencyWarnings}>
                                                                        {(line) => (
                                                                            <li class="text-xs text-text flex items-center gap-2">
                                                                                <span class="size-1.5 rounded-full bg-warning/70 shrink-0" />
                                                                                {line}
                                                                            </li>
                                                                        )}
                                                                    </For>
                                                                </ul>
                                                                <p class="text-xs text-muted/70 pt-1 border-t border-border">
                                                                    {props.preventHardDeleteSuggestion || (
                                                                        <>Usa <strong class="text-muted font-semibold">Eliminar</strong> para ocultar el registro.</>
                                                                    )}
                                                                </p>
                                                            </Popover.Content>
                                                        </Popover>
                                                    </span>
                                                </span>
                                            </div>

                                            <p class="text-xs text-muted mt-1 leading-relaxed">
                                                {props.hardDeleteDesc || 'Se eliminará de forma definitiva sin posibilidad de recuperación.'}
                                            </p>
                                        </div>
                                    </button>

                                </div>
                            </Show>

                            <Show when={!props.allowHardDelete}>
                                <p class="text-sm text-muted leading-relaxed py-1">
                                    {props.softDeleteDesc || 'El registro quedará inactivo y podrá restaurarse en cualquier momento.'}
                                </p>
                            </Show>

                            {/* ── Actions ─────────────────────────────── */}
                            <div class="flex items-center justify-between gap-2 pt-2 ">
                                <Button
                                    variant="outline"
                                    onClick={props.onClose}
                                    disabled={props.isLoading}
                                    class="shrink-0"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    variant={mode() === 'hard' ? 'destructive' : 'danger'}
                                    onClick={() => props.onConfirm(mode())}
                                    disabled={confirmDisabled()}
                                    loading={props.isLoading}
                                    loadingText={mode() === 'hard' ? (props.hardLoadingText || 'Destruyendo...') : (props.softLoadingText || 'Eliminando...')}
                                    class="shrink-0"
                                >
                                    {mode() === 'hard' ? (props.hardDeleteTitle || 'Destruir') : (props.softDeleteTitle || 'Eliminar')}
                                </Button>
                            </div>

                        </div>
                    </Dialog.Content>
                </div>
            </Dialog.Portal>
        </Dialog.Root>
    );
};

export default DeleteDialog;
