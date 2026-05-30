import { Component, createSignal, createEffect, Show, createMemo, lazy } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { CategoryFormSchema } from '@app/schema/frontend';
import type { CategoryFormData, CategoryAttributeEntry } from '@app/schema/frontend';
import TextField, { FieldLabel } from '@shared/ui/TextField';
import { TreeSelect } from '@shared/ui/TreeSelect';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import { FormSubmissionContext } from '@shared/ui/form/form.types';
import CategoryAttributesPicker from './CategoryAttributesPicker';
import NameTemplateEditor from './NameTemplateEditor';
import {
    useCategoriesFlat,
} from '../data/categories.queries';
import { useAttributeList } from '@modules/attributes/data/attributes.queries';
import type { CategoryDetail, CategoryNode } from '../data/categories.api';
import type { AttributeItem } from '@modules/attributes/data/attributes.api';

const AttributeNewSheet = lazy(() => import('@modules/attributes/components/AttributeNewSheet'));



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
    const attrsQuery = useAttributeList();

    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);
    const [showNewAttr, setShowNewAttr] = createSignal(false);



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

    // Set default parent for new categories AFTER mount, only if not already set
    createEffect(() => {
        const parentId = props.defaultParentId;
        if (!isEditing() && parentId !== undefined && form.getFieldValue('parentId') !== parentId) {
            form.setFieldValue('parentId', parentId);
            queueMicrotask(() => {
                form.setFieldMeta('parentId', (prev) => ({ ...prev, isTouched: false }));
            });
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
                                <Show
                                    when={!categoriesFlat.isLoading}
                                    fallback={
                                        <div class="space-y-1.5">
                                            <FieldLabel>Categoría Padre</FieldLabel>
                                            <SkeletonLoader type="text" class="h-10 w-full" />
                                        </div>
                                    }
                                >
                                    <div class="space-y-1">
                                        <TreeSelect
                                            value={field().state.value ?? null}
                                            onChange={(id) => field().handleChange(id ?? undefined)}
                                            options={(categoriesFlat.data ?? []) as CategoryNode[]}
                                            optionValue={(c) => c.id}
                                            optionLabel={(c) => c.name}
                                            optionParentId={(c) => c.parent_id}
                                            optionIsActive={(c) => c.is_active}
                                            editingId={categoryId()}
                                            label="Categoría Padre"
                                            placeholder="Buscar categoría padre..."
                                            field={field()}
                                        />
                                        <p class="text-xs text-muted ml-1">
                                            Deja vacío para crear como categoría raíz
                                        </p>
                                    </div>
                                </Show>
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
                        <CategoryAttributesPicker
                            value={attributesValue() ?? []}
                            onChange={(attrs) => form.setFieldValue('attributes', attrs)}
                            onCreateNew={() => setShowNewAttr(true)}
                        />
                    </fieldset>
                </div>

                {/* ─── Name Template — Quill Editor with DnD Badges ─── */}
                <Show when={(attributesValue() ?? []).length > 0}>
                    <fieldset class="space-y-4 bg-linear-to-br from-amber-500/5 to-orange-500/5 p-4 rounded-2xl border border-amber-500/20">
                        <div class="flex items-center gap-2">
                            <div class="w-1.5 h-4 bg-amber-500 rounded-full" />
                            <h3 class="font-semibold text-text uppercase tracking-wide text-sm">Plantillade Nombre</h3>
                        </div>
                        <p class="text-xs text-muted -mt-1">
                            Arrastra atributos al editor o haz clic para insertarlos. El template genera automáticamente el nombre de los productos.
                        </p>
                        <form.Field name="nameTemplate">
                            {(field) => {
                                // Compute assigned attribute definitions for badge panel
                                const assignedAttributeDefs = createMemo(() => {
                                    const attrs = attributesValue() ?? [];
                                    const allDefs = (attrsQuery.data ?? []) as AttributeItem[];
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

            {/* Inline sheet for creating new attributes */}
            <Show when={showNewAttr()}>
                <AttributeNewSheet onClose={() => setShowNewAttr(false)} />
            </Show>
            </FormSubmissionContext.Provider>
    );
};

export default CategoryForm;
