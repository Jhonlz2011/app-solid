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
