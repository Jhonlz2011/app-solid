import { Component, For, Show, createEffect } from 'solid-js';
import { useCompanySettingsForm } from '../data/useCompanySettingsForm';
import { FileUploadDropzone } from '@shared/ui/FileUpload';
import TextField from '@shared/ui/TextField';
import Button from '@shared/ui/Button';
import { cn } from '@shared/lib/utils';
import { FloppyDiskIcon } from '@shared/ui/icons';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import { FormSubmissionContext } from '@shared/ui/form/form.types';
import { THEME_PRESETS } from '@app/schema/utils/theme-presets';

const PRIMARY_COLOR_PRESETS = [
    { name: 'Índigo (Por defecto)', hex: '#6366f1' },
    { name: 'Esmeralda', hex: '#10b981' },
    { name: 'Violeta', hex: '#8b5cf6' },
    { name: 'Rosa', hex: '#f43f5e' },
    { name: 'Ámbar', hex: '#f59e0b' },
    { name: 'Azul', hex: '#3b82f6' },
    { name: 'Cian', hex: '#06b6d4' },
    { name: 'Teal', hex: '#14b8a6' },
];

const INTERFACE_THEME_OPTIONS = [
    { name: 'Pizarra / Slate', hex: '#64748b', desc: 'Gris neutro clásico (Recomendado)', bgPreview: 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800' },
    { name: 'Tecnológico / Cool Blue', hex: '#3b82f6', desc: 'Fondo con matiz azul suave', bgPreview: 'bg-blue-50 dark:bg-slate-950 border-blue-100 dark:border-slate-900' },
    { name: 'Orgánico / Eco Green', hex: '#10b981', desc: 'Fondo con matiz verde natural', bgPreview: 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-100/50 dark:border-emerald-950/40' },
    { name: 'Cálido / Warm Sand', hex: '#f59e0b', desc: 'Fondo arena de tono acogedor', bgPreview: 'bg-amber-50/50 dark:bg-amber-950/10 border-amber-100/50 dark:border-amber-950/30' },
];

const BrandingSettings: Component = () => {
    const {
        form, brandingQuery, updateBrandingMut,
        hasAttemptedSubmit, setHasAttemptedSubmit,
        logoPreviewUrl, loginBgPreviewUrl, isFormDirty,
    } = useCompanySettingsForm({ onSuccessMessage: 'Apariencia guardada correctamente' });

    // Live preview: override @theme-level CSS variables on the mockup container.
    //
    // Chain: @theme { --color-bg: var(--bg) } → :root { --bg: light-dark(...) }
    // Tailwind classes like `bg-bg` resolve to `background-color: var(--color-bg)`.
    // CSS custom properties inherit as COMPUTED values from :root, so overriding
    // --bg on a child does NOT re-evaluate --color-bg. We must override the
    // @theme-level variables (--color-*) directly.
    let mockupRef: HTMLDivElement | undefined;
    createEffect(() => {
        const themeKey = form.state.values.themeColor;
        const theme = THEME_PRESETS[themeKey] || THEME_PRESETS['#64748b'];
        if (!mockupRef) return;

        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        // Override @theme variables that Tailwind v4 classes use directly
        mockupRef.style.setProperty('--color-bg', isDark ? theme.bgDark : theme.bgLight);
        mockupRef.style.setProperty('--color-surface', isDark ? theme.surfaceDark : theme.surfaceLight);
        mockupRef.style.setProperty('--color-card', isDark ? theme.cardDark : theme.cardLight);
        mockupRef.style.setProperty('--color-card-alt', isDark ? theme.cardAltDark : theme.cardAltLight);
        mockupRef.style.setProperty('--color-border', isDark ? theme.borderDark : theme.borderLight);
    });

    return (
        <div class="h-full flex flex-col">
            <Show when={!brandingQuery.isLoading} fallback={<SkeletonLoader type="text" count={6} />}>
                <FormSubmissionContext.Provider value={hasAttemptedSubmit}>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            setHasAttemptedSubmit(true);
                            form.handleSubmit();
                        }}
                        class="flex-1 flex flex-col min-h-0"
                    >
                        {/* Header */}
                        <div class="flex items-center justify-between border-b border-border pb-4 mb-5 shrink-0">
                            <div>
                                <h2 class="text-xl font-bold text-heading">Colores y Apariencia</h2>
                                <p class="text-xs text-muted mt-0.5">Controla la paleta de colores y el fondo de la plataforma</p>
                            </div>
                            <Button
                                type="submit"
                                loading={updateBrandingMut.isPending}
                                loadingText="Guardando..."
                                icon={<FloppyDiskIcon />}
                                class={cn(
                                    'shadow-lg cursor-pointer transition-all duration-300',
                                    isFormDirty()
                                        ? 'shadow-primary/25 ring-2 ring-primary/30 animate-pulse-subtle'
                                        : 'shadow-primary/10 opacity-80',
                                )}
                            >
                                Guardar
                                <Show when={isFormDirty()}>
                                    <span class="size-2 rounded-full bg-white animate-pulse ml-1" />
                                </Show>
                            </Button>
                        </div>

                        {/* Contenido */}
                        <div class="flex-1 min-h-0 overflow-y-auto pr-1">
                            <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                                {/* Controles de Apariencia */}
                                <div class="lg:col-span-7 space-y-6">
                                    {/* Color Primario */}
                                    <div class="bg-card-alt/50 border border-border/80 rounded-2xl p-5 space-y-4">
                                        <div>
                                            <h3 class="text-sm font-bold text-heading">Color de Marca (Primario)</h3>
                                            <p class="text-xs text-muted mt-0.5">Define el tono principal de tus botones, enlaces y elementos activos.</p>
                                        </div>

                                        <form.Field name="primaryColor">
                                            {(field) => (
                                                <div class="space-y-4">
                                                    {/* Presets Grid */}
                                                    <div class="grid grid-cols-4 sm:grid-cols-8 gap-2">
                                                        <For each={PRIMARY_COLOR_PRESETS}>
                                                            {(preset) => (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => field().handleChange(preset.hex)}
                                                                    class={cn(
                                                                        "h-10 rounded-xl border border-transparent shadow-xs transition-all relative flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95",
                                                                        field().state.value === preset.hex && "border-white ring-2 ring-primary scale-105"
                                                                    )}
                                                                    style={{ "background-color": preset.hex }}
                                                                    title={preset.name}
                                                                >
                                                                    <Show when={field().state.value === preset.hex}>
                                                                        <span class="w-2.5 h-2.5 rounded-full bg-white shadow-xs" />
                                                                    </Show>
                                                                </button>
                                                            )}
                                                        </For>
                                                    </div>

                                                    {/* Custom Picker */}
                                                    <div class="flex items-center gap-3 bg-card rounded-xl p-3 border border-border">
                                                        <input
                                                            type="color"
                                                            value={field().state.value}
                                                            onInput={(e) => field().handleChange(e.currentTarget.value)}
                                                            class="size-10 rounded-lg border border-border cursor-pointer bg-transparent p-0 outline-none"
                                                        />
                                                        <div class="flex-1">
                                                            <span class="text-xs font-semibold text-text truncate block">Color Primario Personalizado</span>
                                                            <span class="text-[10px] text-muted font-mono">{field().state.value}</span>
                                                        </div>
                                                        <TextField.Root value={field().state.value} onChange={(val) => field().handleChange(val)} class="w-28">
                                                            <TextField.Input type="text" maxLength={7} class="font-mono text-xs text-center py-1 px-2 uppercase" />
                                                        </TextField.Root>
                                                    </div>
                                                </div>
                                            )}
                                        </form.Field>
                                    </div>

                                    {/* Tema de Fondo */}
                                    <div class="bg-card-alt/50 border border-border/80 rounded-2xl p-5 space-y-4">
                                        <div>
                                            <h3 class="text-sm font-bold text-heading">Tema de la Interfaz (Fondo)</h3>
                                            <p class="text-xs text-muted mt-0.5">Elige una de nuestras paletas de colores de fondo optimizadas con alto contraste y soporte de modo oscuro.</p>
                                        </div>

                                        <form.Field name="themeColor">
                                            {(field) => (
                                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <For each={INTERFACE_THEME_OPTIONS}>
                                                        {(opt) => (
                                                            <button
                                                                type="button"
                                                                onClick={() => field().handleChange(opt.hex)}
                                                                class={cn(
                                                                    "flex items-center gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer text-left hover:scale-[1.01] active:scale-[0.99]",
                                                                    field().state.value === opt.hex
                                                                        ? "bg-primary/5 border-primary shadow-sm"
                                                                        : "bg-card border-border hover:bg-card-alt"
                                                                )}
                                                            >
                                                                {/* Visual preview circle of the background */}
                                                                <div class={cn("size-8 rounded-xl border flex items-center justify-center shrink-0 shadow-inner", opt.bgPreview)}>
                                                                    <div class="size-3 rounded-full" style={{ "background-color": opt.hex }} />
                                                                </div>
                                                                <div class="flex-1 min-w-0">
                                                                    <span class="text-xs font-bold text-heading block leading-tight">{opt.name}</span>
                                                                    <span class="text-[10px] text-muted block truncate mt-0.5">{opt.desc}</span>
                                                                </div>
                                                                {/* Selected check circle */}
                                                                <Show when={field().state.value === opt.hex}>
                                                                    <div class="size-4 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
                                                                        <svg class="size-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width={3.5}>
                                                                            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                                                                        </svg>
                                                                    </div>
                                                                </Show>
                                                            </button>
                                                        )}
                                                    </For>
                                                </div>
                                            )}
                                        </form.Field>
                                    </div>

                                    {/* Fondo Login */}
                                    <div class="bg-card-alt/50 border border-border/80 rounded-2xl p-5 space-y-3">
                                        <h3 class="text-sm font-bold text-heading">Fondo de Inicio de Sesión</h3>
                                        <p class="text-xs text-muted">Sube una imagen para el fondo de la pantalla de inicio de sesión de tus usuarios. El sistema recortará la imagen a formato panorámico 16:9.</p>
                                        <form.Field name="loginBgUrl">
                                            {(field) => (
                                                <FileUploadDropzone
                                                    maxFiles={1}
                                                    accept={['image/png', 'image/jpeg', 'image/webp']}
                                                    crop={true}
                                                    cropShape="rectangle"
                                                    cropAspectRatio={16 / 9}
                                                    existingUrls={loginBgPreviewUrl() ? [loginBgPreviewUrl()!] : []}
                                                    onFilesChange={(files) => {
                                                        if (files.length > 0) {
                                                            field().handleChange(files[0]);
                                                        }
                                                    }}
                                                    onRemoveUrl={() => field().handleChange(null)}
                                                    showPreview={false}
                                                />
                                            )}
                                        </form.Field>
                                    </div>
                                </div>

                                {/* Live Preview Mockup */}
                                <div class="lg:col-span-5 lg:sticky lg:top-0 space-y-4">
                                    <h3 class="text-sm font-bold text-heading">Vista Previa del ERP</h3>
                                    <p class="text-xs text-muted">Así se verá el entorno de tu ERP en tiempo real según el logo y color que elijas:</p>
                                    
                                    {/* Mockup Container */}
                                    <div ref={mockupRef} class="border border-border/80 bg-surface rounded-2xl overflow-hidden shadow-2xl aspect-4/3 flex flex-col text-[11px] select-none">
                                        {/* Browser TopBar */}
                                        <div class="bg-card px-4 py-2 border-b border-border/60 flex items-center gap-2 shrink-0">
                                            <div class="flex gap-1">
                                                <span class="size-2 rounded-full bg-danger/50" />
                                                <span class="size-2 rounded-full bg-warning/50" />
                                                <span class="size-2 rounded-full bg-success/50" />
                                            </div>
                                            <div class="bg-card-alt rounded-md border border-border/40 text-[9px] text-muted text-center px-4 py-0.5 flex-1 max-w-[200px] truncate ml-4 font-mono">
                                                mybrand.zelys.app
                                            </div>
                                        </div>

                                        {/* Mock App Body */}
                                        <div class="flex-1 flex min-h-0 bg-background">
                                            {/* Sidebar Mockup */}
                                            <div class="w-28 border-r border-border/50 bg-card p-2 flex flex-col gap-4 shrink-0">
                                                {/* Logo & Brand Name */}
                                                <div class="flex items-center gap-1.5 px-1 py-1">
                                                    <Show when={logoPreviewUrl()} fallback={
                                                        <div class="size-5 rounded-md bg-primary-soft text-primary font-bold flex items-center justify-center text-[10px]">
                                                            {(form.state.values.tradeName || form.state.values.businessName || 'Z').charAt(0).toUpperCase()}
                                                        </div>
                                                    }>
                                                        <img src={logoPreviewUrl()!} class="size-5 rounded-md object-cover" />
                                                    </Show>
                                                    <span class="font-bold text-heading truncate max-w-[50px] leading-tight">
                                                        {form.state.values.tradeName || form.state.values.businessName || 'Zelys'}
                                                    </span>
                                                </div>
 
                                                {/* Sidebar Items */}
                                                <div class="flex flex-col gap-1">
                                                    <div 
                                                        class="flex items-center gap-1.5 px-2 py-1 rounded-md text-white font-semibold shadow-xs"
                                                        style={{ "background-color": form.state.values.primaryColor }}
                                                    >
                                                        <span class="size-3 border border-white/50 rounded-full" />
                                                        <span>Inicio</span>
                                                    </div>
                                                    <div class="flex items-center gap-1.5 px-2 py-1 rounded-md text-muted hover:bg-surface/50">
                                                        <span class="size-3 border border-muted/50 rounded-full" />
                                                        <span>Bodegas</span>
                                                    </div>
                                                    <div class="flex items-center gap-1.5 px-2 py-1 rounded-md text-muted hover:bg-surface/50">
                                                        <span class="size-3 border border-muted/50 rounded-full" />
                                                        <span>Clientes</span>
                                                    </div>
                                                </div>
                                            </div>
 
                                            {/* Dashboard Page Mockup */}
                                            <div class="flex-1 bg-surface p-3 overflow-y-auto space-y-3">
                                                <div class="flex items-center justify-between border-b border-border/40 pb-2">
                                                    <span class="font-bold text-heading">Resumen de Ventas</span>
                                                    <span 
                                                        class="px-2 py-0.5 rounded-full text-[8px] font-semibold"
                                                        style={{ 
                                                            "background-color": `${form.state.values.primaryColor}15`, 
                                                            "color": form.state.values.primaryColor,
                                                            "border": `1px solid ${form.state.values.primaryColor}30`
                                                        }}
                                                    >
                                                        Pro Plan
                                                    </span>
                                                </div>
 
                                                <div class="grid grid-cols-2 gap-2">
                                                    <div class="bg-card border border-border p-2 rounded-xl">
                                                        <span class="text-muted text-[8px] block">Ingresos</span>
                                                        <span class="font-bold text-heading mt-0.5 block">$12,450</span>
                                                    </div>
                                                    <div class="bg-card border border-border p-2 rounded-xl">
                                                        <span class="text-muted text-[8px] block">Transacciones</span>
                                                        <span class="font-bold text-heading mt-0.5 block">142</span>
                                                    </div>
                                                </div>
 
                                                <button 
                                                    type="button" 
                                                    class="w-full py-1.5 px-3 rounded-lg text-white font-semibold text-center shadow-md shadow-primary/10 cursor-default"
                                                    style={{ "background-color": form.state.values.primaryColor }}
                                                >
                                                    Nueva Factura
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </form>
                </FormSubmissionContext.Provider>
            </Show>
        </div>
    );
};
 
export default BrandingSettings;
