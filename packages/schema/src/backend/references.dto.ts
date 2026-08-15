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
