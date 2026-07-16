import { Component, For, Show, createMemo } from 'solid-js';
import { useCompanySettingsForm } from '../data/useCompanySettingsForm';
import { FileUploadDropzone } from '@shared/ui/FileUpload';
import TextField from '@shared/ui/TextField';
import Button from '@shared/ui/Button';
import { cn } from '@shared/lib/utils';
import { FloppyDiskIcon } from '@shared/ui/icons';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import { FormSubmissionContext } from '@shared/ui/form/form.types';
import { THEME_PRESETS } from '@app/schema/utils/theme-presets';
import { getContrastColor } from '@app/schema/utils/color';
import { useTheme } from '../../contexts/ThemeContext';

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

    // Live preview: derive theme colors reactively for inline styles.
    //
    // Tailwind v4's @theme registers CSS custom properties using @property with
    // inherits: false. This means --color-bg, --color-surface, etc. set on a child
    // element have NO effect — they don't cascade down. We CANNOT override them.
    //
    // Additionally, form.state.values is NOT a Solid reactive proxy — it won't
    // trigger re-renders. We must use form.useStore() for proper reactivity.
    const selectedThemeColor = form.useStore((s) => s.values.themeColor);
    const selectedPrimaryColor = form.useStore((s) => s.values.primaryColor);
    const selectedTradeName = form.useStore((s) => s.values.tradeName);
    const selectedBusinessName = form.useStore((s) => s.values.businessName);

    const { theme } = useTheme();

    const previewStyles = createMemo(() => {
        const themeKey = selectedThemeColor();
        const t = THEME_PRESETS[themeKey] || THEME_PRESETS['#64748b'];
        const primary = selectedPrimaryColor();
        const onPrimary = getContrastColor(primary);

        return {
            "--primary": primary,
            "--on-primary": onPrimary,
            "--bg-light-val": t.bgLight,
            "--bg-dark-val": t.bgDark,
            "--surface-light-val": t.surfaceLight,
            "--surface-dark-val": t.surfaceDark,
            "--card-light-val": t.cardLight,
            "--card-dark-val": t.cardDark,
            "--card-alt-light-val": t.cardAltLight,
            "--card-alt-dark-val": t.cardAltDark,
            "--border-light-val": t.borderLight,
            "--border-dark-val": t.borderDark,
            "color-scheme": theme(),
        } as any;
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
                                                    lockAspectRatio={true}
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
                                    
                                    {/* Mockup Container — Uses CSS Variables from previewStyles for perfect inheritance */}
                                    <div
                                        class="rounded-2xl overflow-hidden shadow-2xl aspect-4/3 flex flex-col text-[11px] select-none bg-surface border border-border"
                                        style={previewStyles()}
                                    >
                                        {/* Browser TopBar */}
                                        <div class="px-4 py-2 flex items-center gap-2 shrink-0 bg-card border-b border-border">
                                            <div class="flex gap-1">
                                                <span class="size-2 rounded-full bg-red-500/80" />
                                                <span class="size-2 rounded-full bg-yellow-500/80" />
                                                <span class="size-2 rounded-full bg-green-500/80" />
                                            </div>
                                            <div class="rounded-md text-[9px] text-center px-4 py-0.5 flex-1 max-w-[200px] truncate ml-4 font-mono bg-card-alt border border-border text-muted">
                                                mybrand.zelys.app
                                            </div>
                                        </div>

                                        {/* Mock App Body */}
                                        <div class="flex-1 flex min-h-0 bg-bg">
                                            {/* Sidebar Mockup */}
                                            <div class="w-28 p-2 flex flex-col gap-4 shrink-0 bg-card border-r border-border">
                                                {/* Logo & Brand Name */}
                                                <div class="flex items-center gap-1.5 px-1 py-1">
                                                    <Show when={logoPreviewUrl()} fallback={
                                                        <div class="size-5 rounded-md font-bold flex items-center justify-center text-[10px] bg-primary-soft text-primary">
                                                            {(selectedTradeName() || selectedBusinessName() || 'Z').charAt(0).toUpperCase()}
                                                        </div>
                                                    }>
                                                        <img src={logoPreviewUrl()!} class="size-5 rounded-md object-cover" />
                                                    </Show>
                                                    <span class="font-bold truncate max-w-[50px] leading-tight text-heading">
                                                        {selectedTradeName() || selectedBusinessName() || 'Zelys'}
                                                    </span>
                                                </div>
 
                                                {/* Sidebar Items */}
                                                <div class="flex flex-col gap-1">
                                                    <div class="flex items-center gap-1.5 px-2 py-1 rounded-md text-on-primary font-semibold shadow-xs bg-primary">
                                                        <span class="size-3 border border-on-primary/50 rounded-full" />
                                                        <span>Inicio</span>
                                                    </div>
                                                    <div class="flex items-center gap-1.5 px-2 py-1 rounded-md text-muted">
                                                        <span class="size-3 rounded-full border border-muted/80" />
                                                        <span>Bodegas</span>
                                                    </div>
                                                    <div class="flex items-center gap-1.5 px-2 py-1 rounded-md text-muted">
                                                        <span class="size-3 rounded-full border border-muted/80" />
                                                        <span>Clientes</span>
                                                    </div>
                                                </div>
                                            </div>
 
                                            {/* Dashboard Page Mockup */}
                                            <div class="flex-1 p-3 overflow-y-auto space-y-3 bg-surface">
                                                <div class="flex items-center justify-between pb-2 border-b border-border/60">
                                                    <span class="font-bold text-heading">Resumen de Ventas</span>
                                                    <span class="px-2 py-0.5 rounded-full text-[8px] font-semibold bg-primary-soft text-primary border border-primary/30">
                                                        Pro Plan
                                                    </span>
                                                </div>
 
                                                <div class="grid grid-cols-2 gap-2">
                                                    <div class="p-2 rounded-xl bg-card border border-border">
                                                        <span class="text-[8px] block text-muted">Ingresos</span>
                                                        <span class="font-bold mt-0.5 block text-heading">$12,450</span>
                                                    </div>
                                                    <div class="p-2 rounded-xl bg-card border border-border">
                                                        <span class="text-[8px] block text-muted">Transacciones</span>
                                                        <span class="font-bold mt-0.5 block text-heading">142</span>
                                                    </div>
                                                </div>
 
                                                <button 
                                                    type="button" 
                                                    class="w-full py-1.5 px-3 rounded-lg text-on-primary font-semibold text-center shadow-md cursor-default bg-primary"
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
