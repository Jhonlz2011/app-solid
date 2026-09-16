import { Type, type Static } from '@sinclair/typebox';

// ============================================================================
// SRI MODULE
// ============================================================================

export const SriSupplierResponseSchema = Type.Object({
    ruc: Type.String(),
    razonSocial: Type.String(),
    nombreComercial: Type.Union([Type.String(), Type.Null()]),
    city: Type.Union([Type.String(), Type.Null()]),
    isActive: Type.Union([Type.Boolean(), Type.Null()]),
    isSociedad: Type.Union([Type.Boolean(), Type.Null()]),
    isRimpe: Type.Union([Type.Boolean(), Type.Null()]),
    obligadoContabilidad: Type.Union([Type.Boolean(), Type.Null()]),
    agenteRetencion: Type.Union([Type.Boolean(), Type.Null()]),
    contribuyenteEspecial: Type.Union([Type.Boolean(), Type.Null()]),
});

export const SriRucQuerySchema = Type.Object({
    q: Type.String({ 
        minLength: 13, 
        maxLength: 13, 
        error: 'El RUC debe tener exactamente 13 dígitos' 
    })
});

export const SriNameQuerySchema = Type.Object({
    q: Type.String({ 
        minLength: 3, 
        error: 'La búsqueda debe tener al menos 3 caracteres' 
    })
});

export type SriSupplierResponseType = Static<typeof SriSupplierResponseSchema>;
export type SriRucQueryType = Static<typeof SriRucQuerySchema>;
export type SriNameQueryType = Static<typeof SriNameQuerySchema>;

// ============================================================================
// GEONAMES
// ============================================================================

export const GeoNameCitySchema = Type.Object({
    ciudad: Type.String(),
    pais: Type.String(),
    codigo: Type.String(),
    bandera: Type.String(),
});

export const GeoNameSearchQuerySchema = Type.Object({
    q: Type.String({
        minLength: 2,
        error: 'La búsqueda debe tener al menos 2 caracteres',
    }),
});

export type GeoNameCityType = Static<typeof GeoNameCitySchema>;
export type GeoNameSearchQueryType = Static<typeof GeoNameSearchQuerySchema>;

// ============================================================================
// TAXONOMY (Shopify Standard Global Dictionary in referenceDb)
// ============================================================================

export const TaxonomyCategoryResponseSchema = Type.Object({
    id: Type.Number(),
    code: Type.String(),
    name: Type.String(),
    fullPath: Type.String(),
    depth: Type.Number(),
});

export const TaxonomyCategorySearchQuerySchema = Type.Object({
    q: Type.String({ minLength: 1 }),
    limit: Type.Optional(Type.Number()),
});

export const TaxonomyAttributeValueSchema = Type.Object({
    id: Type.Number(),
    name: Type.String(),
    handle: Type.String(),
    metadata: Type.Optional(Type.Union([
        Type.Object({
            hex: Type.Optional(Type.String()),
            icon: Type.Optional(Type.String()),
        }),
        Type.Null(),
    ])),
});

export const TaxonomyAttributeResponseSchema = Type.Object({
    id: Type.Number(),
    name: Type.String(),
    handle: Type.String(),
    dataType: Type.String(),
    values: Type.Array(TaxonomyAttributeValueSchema),
});

export type TaxonomyCategoryResponseType = Static<typeof TaxonomyCategoryResponseSchema>;
export type TaxonomyCategorySearchQueryType = Static<typeof TaxonomyCategorySearchQuerySchema>;
export type TaxonomyAttributeResponseType = Static<typeof TaxonomyAttributeResponseSchema>;
export type TaxonomyAttributeValueType = Static<typeof TaxonomyAttributeValueSchema>;

