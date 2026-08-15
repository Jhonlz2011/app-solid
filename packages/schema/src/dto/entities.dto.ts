import type { CursorFilters } from './common.dto';

// --- Entity-specific Filters ---

export interface EntityFilters extends CursorFilters {
    personType?: string[];
    taxIdType?: string[];
    isActive?: string[];
    businessName?: string[];
}

// --- Entity References (pre-flight hard delete check) ---

export interface EntityReferences {
    supplierProducts: number;
    invoices: number;
    workOrders: number;
    total: number;
    canDelete: boolean;
}

export interface EntityPickerItem {
    id: number;
    businessName: string;
    taxId: string;
}

// --- E2E Entity Detail Contracts ---

export interface EntityDetailContactDto {
    id?: number;
    name: string;
    position?: string | null;
    email?: string | null;
    phone?: string | null;
    is_primary?: boolean | null;
}

export interface EntityDetailAddressDto {
    id?: number;
    address_line: string;
    city?: string | null;
    country?: string | null;
    country_code?: string | null;
    postal_code?: string | null;
    is_main?: boolean | null;
}

export interface EntityDetailEmployeeDetailsDto {
    department?: string | null;
    job_title?: string | null;
    salary_base?: string | number | null;
    hire_date?: string | null;
    cost_per_hour?: string | number | null;
}

export interface EntityDetailVehicleDto {
    id?: number;
    license_plate: string;
    description?: string | null;
    is_active?: boolean | null;
}

export interface EntityDetailDriverDto {
    id?: number;
    identification_number: string;
    full_name: string;
    phone?: string | null;
    is_active?: boolean | null;
}

export interface EntityDetailDto {
    id?: number;
    company_id?: number;
    tax_id?: string;
    tax_id_type?: string;
    person_type?: string;
    business_name?: string;
    trade_name?: string | null;
    email_billing?: string | null;
    phone?: string | null;
    is_client?: boolean | null;
    is_supplier?: boolean | null;
    is_employee?: boolean | null;
    is_carrier?: boolean | null;
    is_active?: boolean | null;
    tax_regime_type?: string | null;
    obligado_contabilidad?: boolean | null;
    is_retention_agent?: boolean | null;
    is_special_contributor?: boolean | null;
    employeeDetails?: EntityDetailEmployeeDetailsDto | null;
    contacts?: EntityDetailContactDto[] | null;
    addresses?: EntityDetailAddressDto[] | null;
    vehicles?: EntityDetailVehicleDto[] | null;
    drivers?: EntityDetailDriverDto[] | null;
}

// --- E2E Entity Payload Contracts ---
// Strict single source of truth for entity creation/update payloads.
// Both Valibot (frontend) and TypeBox (backend) statically map to these types.

export interface EntityContactPayload {
    name: string;
    position: string; // Empty string if omitted
    email: string;    // Empty string if omitted
    phone: string;    // Empty string if omitted
    isPrimary: boolean;
}

export interface EntityAddressPayload {
    addressLine: string;
    city: string; // Empty string if omitted
    country: string; // Empty string if omitted
    countryCode: string; // Empty string if omitted
    postalCode: string; // Empty string if omitted
    isMain: boolean;
}

export interface EmployeeDetailsPayload {
    department: string; // Empty string if omitted
    jobTitle: string; // Empty string if omitted
    salaryBase?: number;
    hireDate: string; // Empty string if omitted
    costPerHour?: number;
}

export interface CarrierVehiclePayload {
    licensePlate: string;
    description?: string;
    isActive?: boolean;
}

export interface CompanyVehicleItem {
    id: number;
    company_id: number;
    carrier_id: number | null;
    license_plate: string;
    description: string | null;
    is_active: boolean;
}

export interface CarrierDriverPayload {
    identificationNumber: string;
    fullName: string;
    phone?: string;
    isActive?: boolean;
}

export interface EntityPayload {
    taxId: string;
    taxIdType: 'RUC' | 'CEDULA' | 'PASAPORTE' | 'EXTERIOR' | 'CONSUMIDOR_FINAL';
    personType: 'NATURAL' | 'JURIDICA';
    businessName: string;
    tradeName: string; // Empty string if omitted
    emailBilling: string; // Empty string if omitted
    phone: string; // Empty string if omitted
    
    isClient: boolean;
    isSupplier: boolean;
    isEmployee: boolean;
    isCarrier: boolean;
    
    taxRegimeType?: 'RIMPE_NEGOCIO_POPULAR' | 'RIMPE_EMPRENDEDOR' | 'GENERAL';
    obligadoContabilidad: boolean;
    isRetentionAgent: boolean;
    isSpecialContributor: boolean;
    
    employeeDetails?: EmployeeDetailsPayload;
    contacts: EntityContactPayload[];
    addresses: EntityAddressPayload[];
    vehicles?: CarrierVehiclePayload[];
    drivers?: CarrierDriverPayload[];
}
