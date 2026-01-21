import { Component, createSignal, For, Show, createEffect, createMemo } from 'solid-js';
import { Tabs, TextField, Select, NumberField, Checkbox } from '@kobalte/core';
import { createMutation, createQuery, useQueryClient } from '@tanstack/solid-query';
import { toast } from 'solid-sonner';
import { productsApi } from '../data/products.api';
import { catalogKeys, categoryKeys } from '../data/products.keys';
import type { Product, ProductClass, ProductPayload, Category, Brand } from '../models/products.type';
import { productClassLabels, ivaRateLabels } from '../models/products.type';
import DynamicAttributesSection from './DynamicAttributesSection';
import CreateCategoryDialog from './CreateCategoryDialog';
import CreateBrandDialog from './CreateBrandDialog';

interface ProductFormSectionsProps {
    initialData?: Product;
    categories: Category[];
    brands: Brand[];
    onSuccess: () => void;
    onCancel: () => void;
}

const ProductFormSections: Component<ProductFormSectionsProps> = (props) => {
    const queryClient = useQueryClient();

    // Form state
    const [sku, setSku] = createSignal(props.initialData?.sku || '');
    const [name, setName] = createSignal(props.initialData?.name || '');
    const [description, setDescription] = createSignal(props.initialData?.description || '');
    const [productClass, setProductClass] = createSignal<ProductClass>(props.initialData?.product_class || 'MATERIAL');
    const [categoryId, setCategoryId] = createSignal<number | undefined>(props.initialData?.category_id ?? undefined);
    const [brandId, setBrandId] = createSignal<number | undefined>(props.initialData?.brand_id ?? undefined);
    const [uomInventory, setUomInventory] = createSignal(props.initialData?.uom_inventory_code || 'UND');
    const [uomConsumption, setUomConsumption] = createSignal(props.initialData?.uom_consumption_code || '');
    const [trackDimensional, setTrackDimensional] = createSignal(props.initialData?.track_dimensional || false);
    const [isService, setIsService] = createSignal(props.initialData?.is_service || false);
    const [minStockAlert, setMinStockAlert] = createSignal(props.initialData?.min_stock_alert ? parseFloat(props.initialData.min_stock_alert) : 0);
    const [lastCost, setLastCost] = createSignal(props.initialData?.last_cost ? parseFloat(props.initialData.last_cost) : 0);
    const [basePrice, setBasePrice] = createSignal(props.initialData?.base_price ? parseFloat(props.initialData.base_price) : 0);
    const [ivaRateCode, setIvaRateCode] = createSignal(props.initialData?.iva_rate_code || 4);
    const [isActive, setIsActive] = createSignal(props.initialData?.is_active ?? true);
    const [specs, setSpecs] = createSignal<Record<string, any>>(props.initialData?.specs || {});
    const [imageUrls, setImageUrls] = createSignal<string[]>(props.initialData?.image_urls || []);
    const [newImageUrl, setNewImageUrl] = createSignal('');

    // Dialog state
    const [showCategoryDialog, setShowCategoryDialog] = createSignal(false);
    const [showBrandDialog, setShowBrandDialog] = createSignal(false);

    // Queries
    const uomQuery = createQuery(() => ({
        queryKey: catalogKeys.uom,
        queryFn: () => productsApi.listUoms(),
        staleTime: 1000 * 60 * 30,
    }));

    const categoryAttrsQuery = createQuery(() => ({
        queryKey: categoryKeys.detail(categoryId()!),
        queryFn: async () => {
            if (!categoryId()) return [];
            const cat = await productsApi.getCategoryWithAttributes(categoryId()!);
            return cat.attributes ?? [];
        },
        enabled: !!categoryId(),
    }));

    // Clear specs when category changes
    createEffect(() => {
        const newCatId = categoryId();
        if (newCatId !== props.initialData?.category_id) {
            const attrs = categoryAttrsQuery.data || [];
            const validKeys = new Set(attrs.map(a => a.definition?.key).filter(Boolean));
            setSpecs(prev => {
                const filtered: Record<string, any> = {};
                for (const [k, v] of Object.entries(prev)) {
                    if (validKeys.has(k)) filtered[k] = v;
                }
                return filtered;
            });
        }
    });

    // Mutations
    const mutation = createMutation(() => ({
        mutationFn: async (data: ProductPayload) => {
            if (props.initialData) {
                return productsApi.update(props.initialData.id, data);
            }
            return productsApi.create(data);
        },
        onSuccess: () => props.onSuccess(),
        onError: (error: Error) => toast.error(`Error: ${error.message}`),
    }));

    // Helpers
    const flatCategories = createMemo(() => {
        const flat: { value: number; label: string; level: number }[] = [];
        const traverse = (cats: Category[], level = 0) => {
            for (const cat of cats) {
                flat.push({ value: cat.id, label: '—'.repeat(level) + ' ' + cat.name, level });
                if (cat.children) traverse(cat.children, level + 1);
            }
        };
        traverse(props.categories);
        return flat;
    });

    const uomOptions = createMemo(() => {
        const list = uomQuery.data ?? [];
        if (list.length === 0) {
            return [
                { value: 'UND', label: 'UND - Unidad' },
                { value: 'KG', label: 'KG - Kilogramo' },
                { value: 'M', label: 'M - Metro' },
                { value: 'M2', label: 'M2 - Metro cuadrado' }
            ];
        }
        return list.map(u => ({ value: u.code, label: `${u.code} - ${u.name}` }));
    });

    const brandOptions = createMemo(() => props.brands.map(b => ({ value: b.id, label: b.name })));
    const classOptions = Object.entries(productClassLabels).map(([value, label]) => ({ value: value as ProductClass, label }));
    const ivaOptions = Object.entries(ivaRateLabels).map(([value, label]) => ({ value: Number(value), label }));

    const handleSpecChange = (key: string, value: any) => {
        setSpecs(prev => ({ ...prev, [key]: value }));
    };

    const addImageUrl = () => {
        const url = newImageUrl().trim();
        if (url && !imageUrls().includes(url)) {
            setImageUrls(prev => [...prev, url]);
            setNewImageUrl('');
        }
    };

    const removeImageUrl = (index: number) => {
        setImageUrls(prev => prev.filter((_, i) => i !== index));
    };

    // Validation
    const [errors, setErrors] = createSignal<Record<string, string>>({});

    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!sku().trim()) newErrors.sku = 'El SKU es requerido';
        if (!name().trim()) newErrors.name = 'El nombre es requerido';
        if (!productClass()) newErrors.productClass = 'El tipo es requerido';

        const attrs = categoryAttrsQuery.data || [];
        for (const attr of attrs) {
            if (attr.required && attr.definition) {
                const val = specs()[attr.definition.key];
                if (val === undefined || val === null || val === '') {
                    newErrors[attr.definition.key] = `El atributo "${attr.definition.label}" es requerido`;
                }
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: Event) => {
        e.preventDefault();
        if (!validate()) {
            toast.error('Por favor corrija los errores en el formulario');
            return;
        }

        const payload: ProductPayload = {
            sku: sku(),
            name: name(),
            productClass: productClass(),
            categoryId: categoryId(),
            brandId: brandId(),
            description: description() || undefined,
            specs: specs(),
            imageUrls: imageUrls().length > 0 ? imageUrls() : undefined,
            uomInventoryCode: uomInventory(),
            uomConsumptionCode: uomConsumption() || undefined,
            trackDimensional: trackDimensional(),
            isService: isService(),
            minStockAlert: minStockAlert(),
            lastCost: lastCost(),
            basePrice: basePrice(),
            ivaRateCode: ivaRateCode(),
        };

        mutation.mutate(payload);
    };

    return (
        <>
            <form onSubmit={handleSubmit} class="space-y-6">
                <Tabs.Root defaultValue="info" class="w-full">
                    {/* Modern 2-Tab Navigation */}
                    <Tabs.List class="flex gap-1 p-1 bg-surface/50 rounded-xl border border-white/5 mb-6">
                        <Tabs.Trigger value="info" class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-muted rounded-lg transition-all data-[selected]:bg-primary data-[selected]:text-white data-[selected]:shadow-lg">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            Información
                        </Tabs.Trigger>
                        <Tabs.Trigger value="config" class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-muted rounded-lg transition-all data-[selected]:bg-primary data-[selected]:text-white data-[selected]:shadow-lg">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            Configuración
                        </Tabs.Trigger>
                    </Tabs.List>

                    {/* TAB 1: INFORMACIÓN */}
                    <Tabs.Content value="info" class="space-y-6 animate-in fade-in duration-200">
                        {/* Basic Info */}
                        <section class="space-y-4">
                            <div class="flex items-center gap-2 text-sm font-semibold text-muted uppercase tracking-wider">
                                <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                                Datos Básicos
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <TextField.Root value={sku()} onChange={(val) => { setSku(val); if (errors().sku) setErrors(p => ({ ...p, sku: '' })) }} validationState={errors().sku ? 'invalid' : 'valid'} class="text-field-root">
                                    <TextField.Label class="text-field-label">SKU *</TextField.Label>
                                    <TextField.Input class="text-field-input font-mono" placeholder="Código único" required />
                                    <TextField.ErrorMessage class="text-xs text-red-400 mt-1">{errors().sku}</TextField.ErrorMessage>
                                </TextField.Root>

                                <TextField.Root value={name()} onChange={(val) => { setName(val); if (errors().name) setErrors(p => ({ ...p, name: '' })) }} validationState={errors().name ? 'invalid' : 'valid'} class="text-field-root md:col-span-2">
                                    <TextField.Label class="text-field-label">Nombre *</TextField.Label>
                                    <TextField.Input class="text-field-input" placeholder="Nombre del producto" required />
                                    <TextField.ErrorMessage class="text-xs text-red-400 mt-1">{errors().name}</TextField.ErrorMessage>
                                </TextField.Root>
                            </div>
                            <TextField.Root value={description()} onChange={setDescription} class="text-field-root">
                                <TextField.Label class="text-field-label">Descripción</TextField.Label>
                                <TextField.TextArea class="text-field-input min-h-[80px]" placeholder="Descripción del producto" />
                            </TextField.Root>
                        </section>

                        {/* Classification */}
                        <section class="space-y-4">
                            <div class="flex items-center gap-2 text-sm font-semibold text-muted uppercase tracking-wider">
                                <svg class="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                Clasificación
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Product Class */}
                                <Select.Root value={classOptions.find(c => c.value === productClass())} onChange={(val) => val && setProductClass(val.value)} options={classOptions} optionValue="value" optionTextValue="label" placeholder="Tipo"
                                    itemComponent={(props) => (<Select.Item item={props.item} class="select-item"><Select.ItemLabel>{props.item.rawValue.label}</Select.ItemLabel><Select.ItemIndicator><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg></Select.ItemIndicator></Select.Item>)}>
                                    <div class="flex flex-col gap-1.5">
                                        <Select.Label class="text-sm font-medium text-muted ml-1">Tipo *</Select.Label>
                                        <Select.Trigger class="select-trigger"><Select.Value<any>>{(s) => s.selectedOption()?.label}</Select.Value><Select.Icon class="text-muted"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg></Select.Icon></Select.Trigger>
                                        <Select.Portal><Select.Content class="select-content"><Select.Listbox class="select-listbox" /></Select.Content></Select.Portal>
                                    </div>
                                </Select.Root>

                                {/* Category */}
                                <div class="flex flex-col gap-1.5">
                                    <div class="flex items-center justify-between ml-1">
                                        <span class="text-sm font-medium text-muted">Categoría</span>
                                        <button type="button" onClick={() => setShowCategoryDialog(true)} class="text-xs text-blue-400 hover:text-blue-300 font-medium">+ Nueva</button>
                                    </div>
                                    <Select.Root value={flatCategories().find(c => c.value === categoryId())} onChange={(val) => setCategoryId(val?.value)} options={flatCategories()} optionValue="value" optionTextValue="label" placeholder="Sin categoría"
                                        itemComponent={(props) => (<Select.Item item={props.item} class="select-item"><Select.ItemLabel>{props.item.rawValue.label}</Select.ItemLabel><Select.ItemIndicator><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg></Select.ItemIndicator></Select.Item>)}>
                                        <Select.Trigger class="select-trigger"><Select.Value<any>>{(s) => s.selectedOption()?.label}</Select.Value><Select.Icon class="text-muted"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg></Select.Icon></Select.Trigger>
                                        <Select.Portal><Select.Content class="select-content"><Select.Listbox class="select-listbox" /></Select.Content></Select.Portal>
                                    </Select.Root>
                                </div>

                                {/* Brand */}
                                <div class="flex flex-col gap-1.5">
                                    <div class="flex items-center justify-between ml-1">
                                        <span class="text-sm font-medium text-muted">Marca</span>
                                        <button type="button" onClick={() => setShowBrandDialog(true)} class="text-xs text-blue-400 hover:text-blue-300 font-medium">+ Nueva</button>
                                    </div>
                                    <Select.Root value={brandOptions().find(b => b.value === brandId())} onChange={(val) => setBrandId(val?.value)} options={brandOptions()} optionValue="value" optionTextValue="label" placeholder="Sin marca"
                                        itemComponent={(props) => (<Select.Item item={props.item} class="select-item"><Select.ItemLabel>{props.item.rawValue.label}</Select.ItemLabel><Select.ItemIndicator><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg></Select.ItemIndicator></Select.Item>)}>
                                        <Select.Trigger class="select-trigger"><Select.Value<any>>{(s) => s.selectedOption()?.label}</Select.Value><Select.Icon class="text-muted"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg></Select.Icon></Select.Trigger>
                                        <Select.Portal><Select.Content class="select-content"><Select.Listbox class="select-listbox" /></Select.Content></Select.Portal>
                                    </Select.Root>
                                </div>
                            </div>

                            <Show when={categoryAttrsQuery.isLoading}>
                                <div class="flex items-center gap-2 text-muted text-sm p-4 bg-surface/50 rounded-xl">
                                    <div class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                    Cargando atributos...
                                </div>
                            </Show>
                            <DynamicAttributesSection attributes={categoryAttrsQuery.data ?? []} specs={specs()} onSpecChange={handleSpecChange} errors={errors()} />
                        </section>
                    </Tabs.Content>

                    {/* TAB 2: CONFIGURACIÓN */}
                    <Tabs.Content value="config" class="space-y-6 animate-in fade-in duration-200">
                        {/* Pricing */}
                        <section class="space-y-4">
                            <div class="flex items-center gap-2 text-sm font-semibold text-muted uppercase tracking-wider">
                                <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                Precios
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <NumberField.Root rawValue={lastCost()} onRawValueChange={(val) => setLastCost(isNaN(val) ? 0 : val)} formatOptions={{ style: 'currency', currency: 'USD' }} class="number-field-root">
                                    <NumberField.Label class="number-field-label">Costo</NumberField.Label>
                                    <NumberField.Input class="number-field-input" />
                                </NumberField.Root>

                                <NumberField.Root rawValue={basePrice()} onRawValueChange={(val) => setBasePrice(isNaN(val) ? 0 : val)} formatOptions={{ style: 'currency', currency: 'USD' }} class="number-field-root">
                                    <NumberField.Label class="number-field-label">Precio Base</NumberField.Label>
                                    <NumberField.Input class="number-field-input" />
                                </NumberField.Root>

                                <Select.Root value={ivaOptions.find(o => o.value === ivaRateCode())} onChange={(val) => val && setIvaRateCode(val.value)} options={ivaOptions} optionValue="value" optionTextValue="label" placeholder="IVA"
                                    itemComponent={(props) => (<Select.Item item={props.item} class="select-item"><Select.ItemLabel>{props.item.rawValue.label}</Select.ItemLabel><Select.ItemIndicator><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg></Select.ItemIndicator></Select.Item>)}>
                                    <div class="flex flex-col gap-1.5">
                                        <Select.Label class="text-sm font-medium text-muted ml-1">IVA</Select.Label>
                                        <Select.Trigger class="select-trigger"><Select.Value<any>>{(s) => s.selectedOption()?.label}</Select.Value><Select.Icon class="text-muted"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg></Select.Icon></Select.Trigger>
                                        <Select.Portal><Select.Content class="select-content"><Select.Listbox class="select-listbox" /></Select.Content></Select.Portal>
                                    </div>
                                </Select.Root>
                            </div>
                            <Show when={lastCost() > 0}>
                                <div class="p-4 bg-gradient-to-r from-emerald-500/10 to-emerald-600/5 rounded-xl border border-emerald-500/20">
                                    <div class="flex items-center justify-between">
                                        <span class="text-sm text-muted">Margen de Ganancia</span>
                                        <span class="text-xl font-bold text-emerald-400">{(((basePrice() - lastCost()) / lastCost()) * 100).toFixed(1)}%</span>
                                    </div>
                                </div>
                            </Show>
                        </section>

                        {/* Inventory */}
                        <section class="space-y-4">
                            <div class="flex items-center gap-2 text-sm font-semibold text-muted uppercase tracking-wider">
                                <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                                Inventario
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <Select.Root value={uomOptions().find(u => u.value === uomInventory())} onChange={(val) => val && setUomInventory(val.value)} options={uomOptions()} optionValue="value" optionTextValue="label" placeholder="Unidad"
                                    itemComponent={(props) => (<Select.Item item={props.item} class="select-item"><Select.ItemLabel>{props.item.rawValue.label}</Select.ItemLabel><Select.ItemIndicator><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg></Select.ItemIndicator></Select.Item>)}>
                                    <div class="flex flex-col gap-1.5">
                                        <Select.Label class="text-sm font-medium text-muted ml-1">Unidad</Select.Label>
                                        <Select.Trigger class="select-trigger"><Select.Value<any>>{(s) => s.selectedOption()?.label || 'UND'}</Select.Value><Select.Icon class="text-muted"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg></Select.Icon></Select.Trigger>
                                        <Select.Portal><Select.Content class="select-content"><Select.Listbox class="select-listbox" /></Select.Content></Select.Portal>
                                    </div>
                                </Select.Root>

                                <NumberField.Root rawValue={minStockAlert()} onRawValueChange={(val) => setMinStockAlert(isNaN(val) ? 0 : val)} class="number-field-root">
                                    <NumberField.Label class="number-field-label">Stock Mínimo</NumberField.Label>
                                    <NumberField.Input class="number-field-input" />
                                </NumberField.Root>

                                <div class="flex flex-wrap gap-4 items-end pb-1 md:col-span-2">
                                    <Checkbox.Root checked={isActive()} onChange={setIsActive} class="flex items-center gap-3 cursor-pointer group">
                                        <Checkbox.Input /><Checkbox.Control class="size-5 rounded-md border-2 border-border bg-card-alt flex items-center justify-center group-focus-visible:ring-2 group-focus-visible:ring-primary/40"><Checkbox.Indicator><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg></Checkbox.Indicator></Checkbox.Control>
                                        <Checkbox.Label class="checkbox-label">Activo</Checkbox.Label>
                                    </Checkbox.Root>
                                    <Checkbox.Root checked={trackDimensional()} onChange={setTrackDimensional} class="flex items-center gap-3 cursor-pointer group">
                                        <Checkbox.Input /><Checkbox.Control class="size-5 rounded-md border-2 border-border bg-card-alt flex items-center justify-center group-focus-visible:ring-2 group-focus-visible:ring-primary/40"><Checkbox.Indicator><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg></Checkbox.Indicator></Checkbox.Control>
                                        <Checkbox.Label class="checkbox-label">Dimensional</Checkbox.Label>
                                    </Checkbox.Root>
                                    <Checkbox.Root checked={isService()} onChange={setIsService} class="flex items-center gap-3 cursor-pointer group">
                                        <Checkbox.Input /><Checkbox.Control class="size-5 rounded-md border-2 border-border bg-card-alt flex items-center justify-center group-focus-visible:ring-2 group-focus-visible:ring-primary/40"><Checkbox.Indicator><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg></Checkbox.Indicator></Checkbox.Control>
                                        <Checkbox.Label class="checkbox-label">Servicio</Checkbox.Label>
                                    </Checkbox.Root>
                                </div>
                            </div>
                        </section>

                        {/* Images */}
                        <section class="space-y-4">
                            <div class="flex items-center gap-2 text-sm font-semibold text-muted uppercase tracking-wider">
                                <svg class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                Imágenes
                            </div>
                            <div class="flex gap-2 items-end">
                                <TextField.Root value={newImageUrl()} onChange={setNewImageUrl} class="text-field-root flex-1">
                                    <TextField.Input class="text-field-input" placeholder="URL de la imagen..." />
                                </TextField.Root>
                                <button type="button" onClick={addImageUrl} class="btn btn-outline h-[46px]">Agregar</button>
                            </div>
                            <Show when={imageUrls().length > 0}>
                                <div class="grid grid-cols-4 md:grid-cols-6 gap-3">
                                    <For each={imageUrls()}>
                                        {(url, index) => (
                                            <div class="relative group aspect-square rounded-xl overflow-hidden bg-surface border border-border">
                                                <img src={url} alt="" class="w-full h-full object-cover" />
                                                <button type="button" onClick={() => removeImageUrl(index())} class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                                                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            </Show>
                            <Show when={imageUrls().length === 0}>
                                <div class="p-6 text-center text-muted bg-surface/30 rounded-xl border-2 border-dashed border-border">
                                    <svg class="w-10 h-10 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    <p class="text-sm">No hay imágenes. Agrega URLs.</p>
                                </div>
                            </Show>
                        </section>
                    </Tabs.Content>
                </Tabs.Root>

                {/* Error Display */}
                <Show when={mutation.isError}>
                    <div class="p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
                        Error: {mutation.error?.message || 'Error desconocido'}
                    </div>
                </Show>

                {/* Actions */}
                {/* Actions */}
                <div class="sticky bottom-0 -mx-6 -mb-6 p-6 bg-surface/95 backdrop-blur border-t border-white/5 flex justify-end gap-3 z-10 mt-auto">
                    <button type="button" onClick={props.onCancel} class="btn btn-ghost">Cancelar</button>
                    <button type="submit" disabled={mutation.isPending || !sku() || !name()} class="btn btn-primary">
                        <Show when={mutation.isPending} fallback={props.initialData ? 'Actualizar' : 'Crear Producto'}>Guardando...</Show>
                    </button>
                </div>
            </form>

            {/* Dialogs */}
            <CreateCategoryDialog isOpen={showCategoryDialog()} onClose={() => setShowCategoryDialog(false)} onSuccess={(cat) => setCategoryId(cat.id)} categories={props.categories} />
            <CreateBrandDialog isOpen={showBrandDialog()} onClose={() => setShowBrandDialog(false)} onSuccess={(brand) => setBrandId(brand.id)} />
        </>
    );
};

export default ProductFormSections;
