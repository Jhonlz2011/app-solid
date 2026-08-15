// ============================================================================
// SETTINGS DTOs — Pure TypeScript Contracts (Company Settings, Vehicles)
// ============================================================================

export interface CompanySettingsDto {
    logoUrl: string | null;
    loginBgUrl: string | null;
    primaryColor: string;
    themeColor: string;
    businessName: string;
    tradeName: string | null;
    ruc: string;
    mainAddress: string;
    businessType: string | null;
    email: string | null;
    phone: string | null;
    obligadoContabilidad: boolean;
    contribuyenteEspecial: string | null;
    agenteRetencion: string | null;
    rimpeType: string | null;
    sriEnvironment: '1' | '2';
}
