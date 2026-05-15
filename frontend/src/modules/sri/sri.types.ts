export type SriSupplierResponse = {
    ruc: string;
    razonSocial: string;
    nombreComercial: string | null;
    city: string;
    isActive: boolean | null;
    isSociedad: boolean | null;
    isRimpe: boolean | null;
    obligadoContabilidad: boolean | null;
    agenteRetencion: boolean | null;
    contribuyenteEspecial: boolean | null;
};