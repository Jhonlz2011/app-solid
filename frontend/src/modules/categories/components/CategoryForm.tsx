import { Component, createSignal, createEffect, Show, createMemo } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { CategoryFormSchema } from '@app/schema/frontend';
import type { CategoryFormData, CategoryAttributeEntry } from '@app/schema/frontend';
import TextField, { FieldLabel } from '@shared/ui/TextField';
import { Autocomplete } from '@shared/ui/Autocomplete';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import { FormSubmissionContext, hasFieldError, getFieldError } from '@shared/ui/form/form.types';
import { FolderIcon } from '@shared/ui/icons';
import { cn } from '@shared/lib/utils';
import CategoryAttributesPicker from './CategoryAttributesPicker';
import NameTemplateEditor from './NameTemplateEditor';
import {
    useCategoriesFlat,
} from '../data/categories.queries';
import { useAttributes } from '@modules/settings/data/attributes.queries';
import type { CategoryDetail, CategoryNode } from '../data/categories.api';
import type { AttributeDef } from '@modules/settings/data/attributes.api';

/** Flat category fields needed for parent selection */
type FlatCategory = Pick<CategoryNode, 'id' | 'name' | 'parent_id' | 'is_active' | 'depth'>;

export interface CategoryFormProps {
    category?: CategoryDetail | null;
    defaultParentId?: number;
    onSubmit: (data: CategoryFormData) => Promise<void>;
    isSubmitting: boolean;
}

const CategoryForm: Component<CategoryFormProps> = (props) => {
    const isEditing = () => !!props.category;
    const categoryId = () => props.category?.id;

    // Queries
    const categoriesFlat = useCategoriesFlat();
    const attrsQuery = useAttributes();

    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);
    const [parentSearch, setParentSearch] = createSignal('');

    // Parent options: exclude self and inactive except when editing self
    const parentOptions = createMemo(() => {
        const flat = (categoriesFlat.data ?? []) as FlatCategory[];
        if (!isEditing()) return flat.filter(c => c.is_active);
        return flat.filter(c => c.id !== categoryId() && c.is_active);
    });

    // Filtered options for autocomplete search
    const filteredParentOptions = createMemo(() => {
        const search = parentSearch().toLowerCase().trim();
        if (!search) return parentOptions();
        return parentOptions().filter(c =>
            c.name.toLowerCase().includes(search) ||
            getBreadcrumb(c.id).toLowerCase().includes(search)
        );
    });

    const depthMap = createMemo(() => {
        const map = new Map<number, number>();
        const flat = (categoriesFlat.data ?? []) as FlatCategory[];
        for (const c of flat) {
            map.set(c.id, c.depth ?? 0);
        }
        return map;
    });

    // Quick lookup: does this category have children?
    const childrenSet = createMemo(() => {
        const set = new Set<number>();
        const flat = (categoriesFlat.data ?? []) as FlatCategory[];
        for (const c of flat) {
            if (c.parent_id) set.add(c.parent_id);
        }
        return set;
    });

    // Build breadcrumb path for a category (e.g. "Materiales > Ferretería")
    const getBreadcrumb = (id: number): string => {
        const flatMap = new Map<number, FlatCategory>();
        for (const c of (categoriesFlat.data ?? []) as FlatCategory[]) {
            flatMap.set(c.id, c);
        }
        const parts: string[] = [];
        let current = flatMap.get(id);
        // Walk up the tree (skip self)
        if (current?.parent_id) {
            current = flatMap.get(current.parent_id);
        } else {
            return '';
        }
        while (current) {
            parts.unshift(current.name);
            current = current.parent_id ? flatMap.get(current.parent_id) : undefined;
        }
        return parts.join(' › ');
    };

    // Get display text for selected parent
    const getParentDisplayText = (parentId: number | undefined): string => {
        if (!parentId) return '';
        const cat = parentOptions().find(c => c.id === parentId);
        if (!cat) return '';
        const breadcrumb = getBreadcrumb(cat.id);
        return breadcrumb ? `${cat.name} (${breadcrumb})` : cat.name;
    };

    const form = createForm(() => ({
        defaultValues: {
            name: props.category?.name ?? '',
            parentId: props.category?.parent_id ?? props.defaultParentId ?? undefined,
            description: props.category?.description ?? undefined,
            icon: props.category?.icon ?? undefined,
            nameTemplate: props.category?.name_template ?? undefined,
            attributes: props.category?.attributes?.map((a, i) => ({
                attributeDefId: a.attributeDefId,
                required: a.required,
                order: a.order ?? i,
                specificOptions: a.specificOptions,
            })) ?? [],
        } as CategoryFormData,
        validatorAdapter: valibotValidator(),
        validators: {
            onChange: CategoryFormSchema,
            onSubmit: CategoryFormSchema,
        },
        onSubmit: async ({ value }) => {
            await props.onSubmit(value as CategoryFormData);
        },
    }));

    // ── Reactive accessor for the attributes array ──
    // form.getFieldValue() is NOT reactive in SolidJS. We MUST use useStore
    // to create a reactive subscription that triggers re-renders.
    const attributesValue = form.useStore((s) => s.values.attributes);

    // Set default parent for new categories reliably AFTER mount
    createEffect(() => {
        if (!isEditing() && props.defaultParentId) {
            form.setFieldValue('parentId', props.defaultParentId);
            setParentSearch(getParentDisplayText(props.defaultParentId));
            queueMicrotask(() => {
                form.setFieldMeta('parentId', (prev) => ({ ...prev, isTouched: false }));
            });
        }
    });

    // Sync search text when editing existing category
    createEffect(() => {
        const pid = props.category?.parent_id;
        if (pid && isEditing()) {
            setParentSearch(getParentDisplayText(pid));
        }
    });

    return (
        <FormSubmissionContext.Provider value={hasAttemptedSubmit}>
            <form
                id="category-form"
                onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setHasAttemptedSubmit(true);
                    form.handleSubmit();
                }}
                class="flex flex-col gap-6"
            >
                <div class="flex flex-col gap-6">
                    <fieldset class="space-y-4">
                        <form.Field name="name">
                            {(field) => (
                                <TextField.Root field={field()}>
                                    <TextField.Label>Nombre de la Categoría</TextField.Label>
                                    <TextField.Input type="text" placeholder="Ej: Herramientas Eléctricas" />
                                    <TextField.ErrorMessage />
                                </TextField.Root>
                            )}
                        </form.Field>

                        <form.Field name="parentId">
                            {(field) => (
                                <div class="space-y-1.5 flex flex-col items-start w-full min-w-0 max-w-full">
                                    <Show
                                        when={!categoriesFlat.isLoading}
                                        fallback={
                                            <>
                                                <FieldLabel>Categoría Padre</FieldLabel>
                                                <SkeletonLoader type="text" class="h-10 w-full" />
                                            </>
                                        }
                                    >
                                        <Autocomplete.Root field={field()}>
                                            <Autocomplete.Label>Categoría Padre</Autocomplete.Label>
                                            <Autocomplete.Input<FlatCategory>
                                                value={parentSearch()}
                                                onInputChange={setParentSearch}
                                                options={filteredParentOptions()}
                                                optionValue={(cat) => String(cat.id)}
                                                optionLabel={(cat) => cat.name}
                                                placeholder="Buscar categoría padre..."
                                                hideEmptyState={false}
                                                minLength={0}
                                                onSelect={(cat) => {
                                                    if (cat) {
                                                        field().handleChange(cat.id);
                                                        const breadcrumb = getBreadcrumb(cat.id);
                                                        setParentSearch(breadcrumb ? `${cat.name} (${breadcrumb})` : cat.name);
                                                    } else {
                                                        field().handleChange(undefined);
                                                        setParentSearch('');
                                                    }
                                                }}
                                                itemRenderer={(cat) => {
                                                    const depth = depthMap().get(cat.id) ?? 0;
                                                    const hasKids = childrenSet().has(cat.id);
                                                    const breadcrumb = getBreadcrumb(cat.id);

                                                    return (
                                                        <div
                                                            class="flex items-center gap-2.5 min-w-0 py-0.5"
                                                            style={{ "padding-left": `${depth * 16}px` }}
                                                        >
                                                            <FolderIcon
                                                                class={cn(
                                                                    "size-4 shrink-0",
                                                                    hasKids ? "text-amber-500" : "text-muted/40"
                                                                )}
                                                            />
                                                            <div class="flex flex-col min-w-0">
                                                                <span class="text-sm font-medium text-text truncate">
                                                                    {cat.name}
                                                                </span>
                                                                <Show when={breadcrumb}>
                                                                    <span class="text-[11px] text-muted/70 truncate leading-tight">
                                                                        {breadcrumb}
                                                                    </span>
                                                                </Show>
                                                            </div>
                                                        </div>
                                                    );
                                                }}
                                            />
                                            <Autocomplete.ErrorMessage />
                                            <Autocomplete.Description>
                                                Deja vacío para crear como categoría raíz
                                            </Autocomplete.Description>
                                        </Autocomplete.Root>
                                    </Show>
                                </div>
                            )}
                        </form.Field>

                        <form.Field name="description">
                            {(field) => (
                                <TextField.Root field={field()}>
                                    <TextField.Label>Descripción</TextField.Label>
                                    <TextField.Input type="text" placeholder="Descripción breve de la categoría (opcional)" />
                                    <TextField.ErrorMessage />
                                </TextField.Root>
                            )}
                        </form.Field>
                    </fieldset>

                    {/* ─── Attributes Assignment ─── */}
                    <fieldset class="space-y-4 bg-surface/30 p-5 rounded-2xl border border-border/40">
                        <div class="flex items-center gap-2">
                            <div class="w-1.5 h-4 bg-accent rounded-full" />
                            <h3 class="font-semibold text-text uppercase tracking-wide text-sm">Atributos Asignados</h3>
                        </div>
                        <CategoryAttributesPicker
                            value={attributesValue() ?? []}
                            onChange={(attrs) => form.setFieldValue('attributes', attrs)}
                        />
                    </fieldset>
                </div>

                {/* ─── Name Template — Quill Editor with DnD Badges ─── */}
                <Show when={(attributesValue() ?? []).length > 0}>
                    <fieldset class="space-y-4 bg-gradient-to-br from-amber-500/5 to-orange-500/5 p-5 rounded-2xl border border-amber-500/20">
                        <div class="flex items-center gap-2">
                            <div class="w-1.5 h-4 bg-amber-500 rounded-full" />
                            <h3 class="font-semibold text-text uppercase tracking-wide text-sm">Template de Nombre</h3>
                        </div>
                        <p class="text-xs text-muted -mt-1">
                            Arrastra atributos al editor o haz clic para insertarlos. El template genera automáticamente el nombre de los productos.
                        </p>
                        <form.Field name="nameTemplate">
                            {(field) => {
                                // Compute assigned attribute definitions for badge panel
                                const assignedAttributeDefs = createMemo(() => {
                                    const attrs = attributesValue() ?? [];
                                    const allDefs = (attrsQuery.data ?? []) as AttributeDef[];
                                    const defMap = new Map(allDefs.map(a => [a.id, a]));
                                    return attrs.map((a: any) => {
                                        const def = defMap.get(a.attributeDefId);
                                        return def ? { key: def.key, label: def.label, type: def.type } : null;
                                    }).filter(Boolean) as Array<{ key: string; label: string; type: string }>;
                                });

                                return (
                                    <NameTemplateEditor
                                        value={field().state.value as string | null | undefined}
                                        onChange={(v) => field().handleChange((v ?? undefined) as any)}
                                        assignedAttributes={assignedAttributeDefs()}
                                    />
                                );
                            }}
                        </form.Field>
                    </fieldset>
                </Show>
                </form>
            </FormSubmissionContext.Provider>
    );
};

export default CategoryForm;
