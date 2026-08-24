import { pipe, string, minLength, object, email, picklist, boolean, union, literal, array, number, optional, null_, forward, check, type InferInput } from 'valibot';
import { TAX_ID_TYPES, TAX_ID_TYPES_FORM, PERSON_TYPES, TAX_REGIME_TYPES, CONTRACT_TYPES, WORK_MODALITIES, BANK_ACCOUNT_TYPES, BLOOD_TYPES } from '../enums';
import type { EntityBodyType } from '../backend/entities.dto';

// --- REUSABLE ENUM SCHEMAS ---
export const TaxIdTypeSchema = picklist(TAX_ID_TYPES);
export const TaxIdTypeFormSchema = picklist(TAX_ID_TYPES_FORM);
export const PersonTypeSchema = picklist(PERSON_TYPES);
export const TaxRegimeTypeSchema = picklist(TAX_REGIME_TYPES);
export const ContractTypeSchema = picklist(CONTRACT_TYPES);
export const WorkModalitySchema = picklist(WORK_MODALITIES);
export const BankAccountTypeSchema = picklist(BANK_ACCOUNT_TYPES);
export const BloodTypeSchema = picklist(BLOOD_TYPES);

// --- SUB-SCHEMAS ---
export const ContactFormSchema = object({
    name: pipe(string(), minLength(1, 'El nombre es requerido')),
    position: string(),
    email: union([pipe(string(), email('Correo inválido')), literal('')]),
    phone: string(),
    isPrimary: boolean(),
});

export const AddressFormSchema = object({
    addressLine: pipe(string(), minLength(1, 'La dirección es requerida')),
    city: string(),
    country: string(),
    countryCode: string(),
    postalCode: string(),
    isMain: boolean(),
});

export const DepartmentFormSchema = object({
    name: pipe(string(), minLength(1, 'El nombre es requerido')),
    code: optional(string()),
});

export const JobTitleFormSchema = object({
    name: pipe(string(), minLength(1, 'El nombre es requerido')),
    departmentId: optional(union([number(), null_()])),
});

export const EmployeeDetailsFormSchema = object({
    departmentId: optional(union([number(), null_()])),
    jobTitleId: optional(union([number(), null_()])),
    reportsTo: optional(union([string(), null_()])),
    hireDate: optional(union([string(), null_()])),
    terminationDate: optional(union([string(), null_()])),
    contractType: optional(ContractTypeSchema),
    workModality: optional(WorkModalitySchema),
    salaryBase: optional(union([number(), null_()])),
    costPerHour: optional(union([number(), null_()])),
    accumulateThirteenth: boolean(),
    accumulateFourteenth: boolean(),
    accumulateReserveFunds: boolean(),
    iessCode: optional(union([string(), null_()])),
    dependentsCount: optional(union([number(), null_()])),
    bankName: optional(union([string(), null_()])),
    bankAccountType: optional(union([BankAccountTypeSchema, null_()])),
    bankAccountNumber: optional(union([string(), null_()])),
    bloodType: optional(union([BloodTypeSchema, null_()])),
    notes: optional(union([string(), null_()])),
});

export const CarrierVehicleFormSchema = object({
    licensePlate: pipe(string(), minLength(1, 'La placa es requerida')),
    description: optional(string()),
    isActive: boolean(),
});

export const CarrierDriverFormSchema = object({
    identificationNumber: pipe(string(), minLength(1, 'La identificación es requerida')),
    fullName: pipe(string(), minLength(1, 'El nombre es requerido')),
    phone: optional(string()),
    isActive: boolean(),
});

// Complete Entity form validation schema
export const EntityFormSchema = pipe(
    object({
        taxId: pipe(string(), minLength(1, 'La identificación es requerida')),
        taxIdType: TaxIdTypeFormSchema,
        personType: PersonTypeSchema,
        businessName: pipe(string(), minLength(3, 'Razón social requerida')),
        tradeName: string(),
        emailBilling: union([pipe(string(), email('Correo inválido')), literal('')]),
        phone: string(),
        isClient: boolean(),
        isSupplier: boolean(),
        isEmployee: boolean(),
        isCarrier: boolean(),
        taxRegimeType: optional(TaxRegimeTypeSchema),
        obligadoContabilidad: boolean(),
        isRetentionAgent: boolean(),
        isSpecialContributor: boolean(),
        employeeDetails: optional(EmployeeDetailsFormSchema),
        contacts: array(ContactFormSchema),
        addresses: array(AddressFormSchema),
        vehicles: array(CarrierVehicleFormSchema),
        drivers: array(CarrierDriverFormSchema),
    }),
    forward(
        check((input) => {
            if (input.taxIdType === 'CEDULA') return /^\d{10}$/.test(input.taxId);
            return true;
        }, 'La Cédula debe tener 10 dígitos numéricos'),
        ['taxId']
    ),
    forward(
        check((input) => {
            if (input.taxIdType === 'RUC') return /^\d{13}$/.test(input.taxId);
            return true;
        }, 'El RUC debe tener 13 dígitos numéricos'),
        ['taxId']
    ),
    forward(
        check((input) => {
            if (input.taxIdType === 'PASAPORTE') return /^[A-Za-z0-9]+$/.test(input.taxId);
            return true;
        }, 'El Pasaporte debe ser alfanumérico'),
        ['taxId']
    )
);

export type EntityFormData = InferInput<typeof EntityFormSchema>;
export type EmployeeDetailsFormData = InferInput<typeof EmployeeDetailsFormSchema>;
export type ContactFormData = InferInput<typeof ContactFormSchema>;
export type AddressFormData = InferInput<typeof AddressFormSchema>;
export type CarrierVehicleFormData = InferInput<typeof CarrierVehicleFormSchema>;
export type CarrierDriverFormData = InferInput<typeof CarrierDriverFormSchema>;

// Compile-Time Assertion: Ensures Valibot schema matches exactly the E2E contract interface
type AssertValibot<T extends EntityBodyType> = T;
const _checkEntityFormData: AssertValibot<EntityFormData> = {} as any as EntityFormData;
void _checkEntityFormData;
