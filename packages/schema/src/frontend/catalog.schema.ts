import { pipe, string, minLength, maxLength, object, picklist, boolean, array, number, optional, nullable, union, forward, check, any, partial, trim, type InferInput } from 'valibot';
import { ATTRIBUTE_DATA_TYPES, UOM_GROUPS } from '../enums';

// --- ATTRIBUTE DEFINITIONS ---
export const RenameOptionEntry = object({
    from: string(),
    to: string(),
});

export const AttributeFormSchema = pipe(
    object({
        label: pipe(string(), minLength(1, 'La etiqueta es requerida')),
        type: picklist(ATTRIBUTE_DATA_TYPES, 'Tipo de dato requerido'),
        defaultOptions: optional(array(string())),
        renamedOptions: optional(array(RenameOptionEntry)),
    }),
    forward(
        check(
            (input) => {
                if (input.type === 'SELECT') {
                    return Array.isArray(input.defaultOptions) && input.defaultOptions.length > 0;
                }
                return true;
            },
            'Debe agregar al menos una opción para el tipo Selección.'
        ),
        ['defaultOptions']
    )
);

export type AttributeFormData = InferInput<typeof AttributeFormSchema>;

// --- CATEGORIES ---
export const CategoryAttributeEntrySchema = object({
    attributeDefId: number(),
    required: boolean(),
    order: number(),
    specificOptions: optional(any()),
});

export const CategoryFormSchema = object({
    name: pipe(string(), minLength(1, 'El nombre es requerido')),
    parentId: optional(nullable(number())),
    description: optional(nullable(string())),
    icon: optional(nullable(string())),
    nameTemplate: optional(nullable(string())),
    sortOrder: optional(number()),
    attributes: array(CategoryAttributeEntrySchema),
});

export const CategoryUpdateSchema = partial(CategoryFormSchema);

export type CategoryFormData = InferInput<typeof CategoryFormSchema>;
export type CategoryUpdateData = InferInput<typeof CategoryUpdateSchema>;
export type CategoryAttributeEntry = InferInput<typeof CategoryAttributeEntrySchema>;

// --- BRANDS & FAMILIES ---
export const BrandFormSchema = object({
    name: pipe(string(), trim(), minLength(1, 'El nombre es requerido')),
    website: optional(nullable(string())),
});
export type BrandFormData = InferInput<typeof BrandFormSchema>;

export const FamilyFormSchema = object({
    name: pipe(string(), trim(), minLength(1, 'El nombre es requerido')),
    categoryId: optional(nullable(number())),
    description: optional(nullable(string())),
});
export type FamilyFormData = InferInput<typeof FamilyFormSchema>;

// --- UNITS OF MEASURE (UOM) ---
export const UomFormSchema = object({
    code: pipe(string(), trim(), minLength(1, 'El código es requerido'), maxLength(10, 'Máx 10 caracteres')),
    name: pipe(string(), trim(), minLength(1, 'El nombre es requerido')),
    uom_group: picklist(UOM_GROUPS, 'Grupo es requerido'),
    base_factor: optional(nullable(union([string(), number()]))),
});
export type UomFormData = InferInput<typeof UomFormSchema>;
