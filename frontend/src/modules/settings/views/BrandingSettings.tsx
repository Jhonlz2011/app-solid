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
import { useTheme } from '../../../contexts/ThemeContext';

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

    const previewTheme = createMemo(() => {
        const themeKey = selectedThemeColor();
        const t = THEME_PRESETS[themeKey] || THEME_PRESETS['#64748b'];
        const isDark = theme() === 'dark';
        const primary = selectedPrimaryColor();
        const onPrimary = getContrastColor(primary);

        return {
            bg: isDark ? t.bgDark : t.bgLight,
            surface: isDark ? t.surfaceDark : t.surfaceLight,
            card: isDark ? t.cardDark : t.cardLight,
            cardAlt: isDark ? t.cardAltDark : t.cardAltLight,
            border: isDark ? t.borderDark : t.borderLight,
            text: isDark ? '#f8fafc' : '#0f172a',
            heading: isDark ? '#f8fafc' : '#0b1220',
            muted: isDark ? '#94a3b8' : '#475569',
            primary: primary,
            onPrimary: onPrimary,
            primarySoft: `${primary}15`,
            borderPrimarySoft: `${primary}30`,
            rowSelected: isDark ? `${primary}24` : `${primary}1a`, // Emula el 14% en oscuro y 10% en claro
            success: isDark ? '#22c55e' : '#16a34a',
            successSoft: isDark ? '#22c55e1c' : '#16a34a14',
            warning: isDark ? '#cca712' : '#ca8a04',
            warningSoft: isDark ? '#cca7121c' : '#ca8a0414',
            danger: isDark ? '#da5252' : '#dc2626',
            dangerSoft: isDark ? '#da52521c' : '#dc262614',
        };
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
                                    
                                    {/* Mockup Container — ALL colors via inline styles (ignores Tailwind v4's inherits: false limitation) */}
                                    <div
                                        class="rounded-2xl overflow-hidden shadow-2xl aspect-4/3 flex flex-col text-[10px] select-none"
                                        style={{
                                            "background-color": previewTheme().surface,
                                            "border": `1px solid ${previewTheme().border}`,
                                        }}
                                    >
                                        {/* Browser TopBar */}
                                        <div
                                            class="px-4 py-1.5 flex items-center gap-2 shrink-0"
                                            style={{
                                                "background-color": previewTheme().card,
                                                "border-bottom": `1px solid ${previewTheme().border}`,
                                            }}
                                        >
                                            <div class="flex gap-1 shrink-0">
                                                <span class="size-1.5 rounded-full bg-red-500/80" />
                                                <span class="size-1.5 rounded-full bg-yellow-500/80" />
                                                <span class="size-1.5 rounded-full bg-green-500/80" />
                                            </div>
                                            <div
                                                class="rounded-md text-[8px] text-center px-4 py-0.5 flex-1 max-w-[180px] truncate ml-4 font-mono"
                                                style={{
                                                    "background-color": previewTheme().cardAlt,
                                                    "border": `1px solid ${previewTheme().border}`,
                                                    "color": previewTheme().muted,
                                                }}
                                            >
                                                mybrand.zelys.app
                                            </div>
                                        </div>

                                        {/* Mock App Body */}
                                        <div class="flex-1 flex min-h-0 text-[9px]" style={{ "background-color": previewTheme().bg }}>
                                            {/* Sidebar Mockup (Mini size-20/w-24 equivalent) */}
                                            <div
                                                class="w-24 p-1.5 flex flex-col justify-between shrink-0"
                                                style={{
                                                    "background-color": previewTheme().card,
                                                    "border-right": `1px solid ${previewTheme().border}`,
                                                }}
                                            >
                                                <div class="space-y-3">
                                                    {/* SidebarHeader Logo + Text */}
                                                    <div class="flex items-center gap-1.5 px-1 py-0.5 border-b pb-1.5" style={{ "border-color": `${previewTheme().border}80` }}>
                                                        <Show when={logoPreviewUrl()} fallback={
                                                            <div
                                                                class="size-5 rounded-md font-bold flex items-center justify-center text-[9px]"
                                                                style={{
                                                                    "background": `linear-gradient(135deg, ${previewTheme().primary}, ${previewTheme().primary}cc)`,
                                                                    "color": previewTheme().onPrimary,
                                                                }}
                                                            >
                                                                {(selectedTradeName() || selectedBusinessName() || 'Z').charAt(0).toUpperCase()}
                                                            </div>
                                                        }>
                                                            <img src={logoPreviewUrl()!} class="size-5 rounded-md object-contain" />
                                                        </Show>
                                                        <div class="flex flex-col justify-center min-w-0 leading-none">
                                                            <span class="font-bold truncate max-w-[45px] text-[8px]" style={{ "color": previewTheme().heading }}>
                                                                {selectedTradeName() || selectedBusinessName() || 'Zelys'}
                                                            </span>
                                                            <span class="text-[6px] truncate max-w-[45px]" style={{ "color": previewTheme().muted }}>
                                                                Admin
                                                            </span>
                                                        </div>
                                                    </div>
 
                                                    {/* Sidebar Nav Items */}
                                                    <div class="flex flex-col gap-0.5">
                                                        <div 
                                                            class="flex items-center gap-1 py-1 px-1.5 rounded-md font-medium"
                                                            style={{ 
                                                                "background-color": previewTheme().primarySoft,
                                                                "color": previewTheme().primary,
                                                                "box-shadow": `inset 2px 0 0 0 ${previewTheme().primary}`,
                                                            }}
                                                        >
                                                            <svg class="size-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                                                <path stroke-linecap="round" stroke-linejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                                            </svg>
                                                            <span class="truncate">Inicio</span>
                                                        </div>
                                                        <div class="flex items-center gap-1 py-1 px-1.5 rounded-md" style={{ "color": previewTheme().muted }}>
                                                            <svg class="size-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                                                <path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                                            </svg>
                                                            <span class="truncate">Bodegas</span>
                                                        </div>
                                                        <div class="flex items-center gap-1 py-1 px-1.5 rounded-md" style={{ "color": previewTheme().muted }}>
                                                            <svg class="size-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                                                <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                                            </svg>
                                                            <span class="truncate">Clientes</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* SidebarFooter Profile */}
                                                <div class="flex items-center justify-between border-t pt-1.5" style={{ "border-color": `${previewTheme().border}80` }}>
                                                    <div class="flex items-center gap-1 min-w-0">
                                                        <div class="size-4.5 rounded-md font-bold flex items-center justify-center text-[7px]" style={{ "background-color": previewTheme().primarySoft, "color": previewTheme().primary }}>US</div>
                                                        <span class="font-medium truncate max-w-[45px] text-[7px]" style={{ "color": previewTheme().heading }}>Usuario</span>
                                                    </div>
                                                    <svg class="size-3 cursor-pointer shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style={{ "color": previewTheme().muted }}>
                                                        <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                                    </svg>
                                                </div>
                                            </div>
 
                                            {/* Main Dashboard Panel */}
                                            <div class="flex-1 p-2 overflow-y-auto space-y-2 flex flex-col justify-between">
                                                <div>
                                                    {/* PageHeader Emulation */}
                                                    <div class="flex items-center justify-between gap-2 pb-1.5 border-b" style={{ "border-color": `${previewTheme().border}60` }}>
                                                        <div class="flex items-center gap-1.5 min-w-0">
                                                            <div 
                                                                class="size-5 rounded-md flex items-center justify-center shrink-0"
                                                                style={{ "background": `linear-gradient(135deg, ${previewTheme().primary}, ${previewTheme().primary}cc)` }}
                                                            >
                                                                <svg class="size-3 text-white" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                                                                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                                                </svg>
                                                            </div>
                                                            <span class="font-bold text-[10px] truncate" style={{ "color": previewTheme().heading }}>Inicio</span>
                                                            <span 
                                                                class="px-1.5 py-0.2 rounded-full text-[6.5px] font-semibold shrink-0"
                                                                style={{ "background-color": previewTheme().primarySoft, "color": previewTheme().primary }}
                                                            >
                                                                v2.0
                                                            </span>
                                                        </div>

                                                        {/* Header Action Button */}
                                                        <button 
                                                            type="button" 
                                                            class="px-1.5 py-0.5 rounded-md font-semibold text-[7.5px] shadow-sm shrink-0 cursor-default"
                                                            style={{ "background-color": previewTheme().primary, "color": previewTheme().onPrimary }}
                                                        >
                                                            + Nueva Factura
                                                        </button>
                                                    </div>

                                                    {/* Dashboard KPI Grid */}
                                                    <div class="grid grid-cols-2 gap-2 mt-2">
                                                        <div class="p-1.5 rounded-xl border flex flex-col justify-between" style={{ "background-color": previewTheme().card, "border-color": previewTheme().border }}>
                                                            <div class="flex items-center justify-between mb-0.5">
                                                                <span class="text-[7px]" style={{ "color": previewTheme().muted }}>Órdenes</span>
                                                                <span class="size-1 rounded-full shrink-0" style={{ "background-color": previewTheme().success }} />
                                                            </div>
                                                            <span class="font-bold text-[11px] block mt-0.5" style={{ "color": previewTheme().heading }}>48 Activas</span>
                                                        </div>
                                                        <div class="p-1.5 rounded-xl border flex flex-col justify-between" style={{ "background-color": previewTheme().card, "border-color": previewTheme().border }}>
                                                            <div class="flex items-center justify-between mb-0.5">
                                                                <span class="text-[7px]" style={{ "color": previewTheme().muted }}>Alertas</span>
                                                                <span class="size-1 rounded-full shrink-0 animate-pulse" style={{ "background-color": previewTheme().danger }} />
                                                            </div>
                                                            <span class="font-bold text-[11px] block mt-0.5" style={{ "color": previewTheme().heading }}>3 Críticos</span>
                                                        </div>
                                                    </div>

                                                    {/* DataTable Emulation */}
                                                    <div class="mt-2.5">
                                                        <span class="font-bold text-[8.5px] block" style={{ "color": previewTheme().heading }}>Órdenes Recientes</span>
                                                        <div class="border rounded-lg overflow-hidden mt-1 text-[7px]" style={{ "border-color": previewTheme().border, "background-color": previewTheme().card }}>
                                                            {/* Table Header */}
                                                            <div class="grid grid-cols-3 px-2 py-0.8 font-semibold border-b" style={{ "border-color": previewTheme().border, "background-color": previewTheme().cardAlt, "color": previewTheme().muted }}>
                                                                <span>ID</span>
                                                                <span>Cliente</span>
                                                                <span class="text-right">Estado</span>
                                                            </div>
                                                            {/* Row 1 (Normal) */}
                                                            <div class="grid grid-cols-3 px-2 py-1 border-b" style={{ "border-color": `${previewTheme().border}40`, "color": previewTheme().text }}>
                                                                <span class="font-medium">#1024</span>
                                                                <span class="truncate">Almacén Central</span>
                                                                <span class="text-right"><span class="px-1 py-0.2 rounded-md font-semibold text-[6px]" style={{ "background-color": previewTheme().successSoft, "color": previewTheme().success }}>Completado</span></span>
                                                            </div>
                                                            {/* Row 2 (Selected Row emulating active state) */}
                                                            <div class="grid grid-cols-3 px-2 py-1 border-b" style={{ "background-color": previewTheme().rowSelected, "color": previewTheme().text, "border-color": `${previewTheme().border}40` }}>
                                                                <span class="font-medium">#1025</span>
                                                                <span class="truncate">Sucursal Sur</span>
                                                                <span class="text-right"><span class="px-1 py-0.2 rounded-md font-semibold text-[6px]" style={{ "background-color": previewTheme().warningSoft, "color": previewTheme().warning }}>Pendiente</span></span>
                                                            </div>
                                                            {/* Row 3 (Normal) */}
                                                            <div class="grid grid-cols-3 px-2 py-1" style={{ "color": previewTheme().text }}>
                                                                <span class="font-medium">#1026</span>
                                                                <span class="truncate">Bodega Principal</span>
                                                                <span class="text-right"><span class="px-1 py-0.2 rounded-md font-semibold text-[6px]" style={{ "background-color": previewTheme().successSoft, "color": previewTheme().success }}>Completado</span></span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
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
