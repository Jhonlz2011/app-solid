/**
 * Canonical Test Fixtures for E2E Testing Suite
 * Covers all 17 modernized features across multi-tenant domains.
 */

export const mockCompanies = [
    { id: 1, name: 'Empresa Alfa S.A.', slug: 'alfa', ruc: '1790011223001', is_active: true },
    { id: 2, name: 'Empresa Beta S.A.', slug: 'beta', ruc: '1790044556001', is_active: true },
    { id: 3, name: 'Empresa Gamma Cía. Ltda.', slug: 'gamma', ruc: '1790077889001', is_active: true },
];

export const mockUsers = [
    { id: 101, company_id: 1, username: 'admin_alfa', email: 'admin@alfa.com', is_active: true },
    { id: 102, company_id: 1, username: 'user_alfa', email: 'user@alfa.com', is_active: true },
    { id: 201, company_id: 2, username: 'admin_beta', email: 'admin@beta.com', is_active: true },
    { id: 301, company_id: 3, username: 'admin_gamma', email: 'admin@gamma.com', is_active: true },
];

export const mockBrands = [
    { id: 1, company_id: 1, name: 'Bosch Professional', website: 'https://bosch.com', is_active: true },
    { id: 2, company_id: 1, name: 'Makita Tools', website: 'https://makita.com', is_active: true },
    { id: 3, company_id: 1, name: 'DeWalt Industrial', website: 'https://dewalt.com', is_active: false },
    { id: 4, company_id: 2, name: 'Beta Tools', website: 'https://beta.com', is_active: true },
    { id: 5, company_id: 2, name: 'Beta Hardware', website: 'https://betahw.com', is_active: true },
];

export const mockUoms = [
    { id: 1, company_id: 1, code: 'UN', name: 'Unidad', uom_group: 'UNIDADES', base_factor: '1.0', is_active: true },
    { id: 2, company_id: 1, code: 'KG', name: 'Kilogramo', uom_group: 'PESO', base_factor: '1.0', is_active: true },
    { id: 3, company_id: 1, code: 'LT', name: 'Litro', uom_group: 'VOLUMEN', base_factor: '1.0', is_active: true },
    { id: 4, company_id: 2, code: 'UN_B', name: 'Unidad Beta', uom_group: 'UNIDADES', base_factor: '1.0', is_active: true },
];

export const mockAttributes = [
    { id: 1, company_id: 1, label: 'Color', type: 'SELECT', default_options: ['Rojo', 'Azul', 'Negro'], is_active: true },
    { id: 2, company_id: 1, label: 'Voltaje', type: 'SELECT', default_options: ['110V', '220V'], is_active: true },
    { id: 3, company_id: 1, label: 'Potencia (W)', type: 'NUMBER', default_options: null, is_active: true },
    { id: 4, company_id: 2, label: 'Talla', type: 'SELECT', default_options: ['S', 'M', 'L'], is_active: true },
];

export const mockProducts = [
    {
        id: 1,
        company_id: 1,
        slug: 'taladro-percutor-bosch',
        name: 'Taladro Percutor Bosch GSB 13 RE',
        product_type: 'PRODUCTO',
        product_subtype: 'SIMPLE',
        category_id: 10,
        brand_id: 1,
        uom_inventory_id: 1,
        default_base_price: 85.50,
        iva_rate_code: 4,
        is_active: true,
        variants: [
            { id: 101, sku: 'BOS-GSB-13RE-110', variant_name: '110V', base_price: 85.50, content_quantity: 1, is_default: true, is_active: true }
        ]
    },
    {
        id: 2,
        company_id: 1,
        slug: 'esmeril-angular-makita',
        name: 'Esmeril Angular Makita GA4530',
        product_type: 'PRODUCTO',
        product_subtype: 'SIMPLE',
        category_id: 10,
        brand_id: 2,
        uom_inventory_id: 1,
        default_base_price: 65.00,
        iva_rate_code: 4,
        is_active: true,
        variants: [
            { id: 102, sku: 'MAK-GA4530', variant_name: 'Estandar', base_price: 65.00, content_quantity: 1, is_default: true, is_active: true }
        ]
    },
    {
        id: 3,
        company_id: 2,
        slug: 'producto-beta-1',
        name: 'Producto Exclusivo Beta',
        product_type: 'PRODUCTO',
        product_subtype: 'SIMPLE',
        category_id: 20,
        brand_id: 4,
        uom_inventory_id: 4,
        default_base_price: 120.00,
        iva_rate_code: 4,
        is_active: true,
        variants: [
            { id: 201, sku: 'BETA-PRD-01', variant_name: 'Default', base_price: 120.00, content_quantity: 1, is_default: true, is_active: true }
        ]
    }
];

export const mockEntities = [
    {
        id: 1,
        company_id: 1,
        tax_id: '1791234567001',
        tax_id_type: 'RUC',
        person_type: 'JURIDICA',
        business_name: 'Constructora del Norte S.A.',
        trade_name: 'ConNorte',
        email_billing: 'facturas@connorte.com',
        phone: '022345678',
        is_client: true,
        is_supplier: false,
        is_employee: false,
        is_carrier: false,
        is_active: true,
        obligado_contabilidad: true,
        is_retention_agent: true,
        is_special_contributor: false,
    },
    {
        id: 2,
        company_id: 1,
        tax_id: '1712345678',
        tax_id_type: 'CEDULA',
        person_type: 'NATURAL',
        business_name: 'Juan Perez',
        trade_name: '',
        email_billing: 'juan.perez@email.com',
        phone: '0991234567',
        is_client: true,
        is_supplier: false,
        is_employee: false,
        is_carrier: false,
        is_active: true,
        obligado_contabilidad: false,
        is_retention_agent: false,
        is_special_contributor: false,
    },
    {
        id: 3,
        company_id: 2,
        tax_id: '1799988776001',
        tax_id_type: 'RUC',
        person_type: 'JURIDICA',
        business_name: 'Beta Cliente Corporativo',
        trade_name: '',
        email_billing: 'facturas@betaclient.com',
        phone: '022998877',
        is_client: true,
        is_supplier: false,
        is_employee: false,
        is_carrier: false,
        is_active: true,
        obligado_contabilidad: true,
        is_retention_agent: false,
        is_special_contributor: false,
    }
];

export const mockInvoices = [
    {
        id: 1,
        company_id: 1,
        entity_id: 1,
        document_number: '001-001-000000001',
        type: 'INVOICE',
        status: 'AUTHORIZED',
        issue_date: '2026-08-01',
        subtotal_15: 150.50,
        subtotal_0: 0,
        iva_amount: 22.58,
        total_amount: 173.08,
        sri_access_key: '0108202601179001122300120010010000000011234567813',
    },
    {
        id: 2,
        company_id: 2,
        entity_id: 3,
        document_number: '001-001-000000001',
        type: 'INVOICE',
        status: 'DRAFT',
        issue_date: '2026-08-02',
        subtotal_15: 500.00,
        subtotal_0: 0,
        iva_amount: 75.00,
        total_amount: 575.00,
        sri_access_key: null,
    }
];

export const mockQuotations = [
    {
        id: 1,
        company_id: 1,
        client_id: 1,
        quotation_number: 'COT-2026-001',
        status: 'DRAFT',
        total_amount: '350.00',
        valid_until: '2026-09-01',
    },
    {
        id: 2,
        company_id: 2,
        client_id: 3,
        quotation_number: 'COT-2026-001',
        status: 'SENT',
        total_amount: '1200.00',
        valid_until: '2026-09-15',
    }
];

export const mockSchedules = [
    {
        id: 1,
        company_id: 1,
        employee_id: 102,
        work_date: '2026-08-14',
        check_in: '08:00:00',
        check_out: '17:00:00',
        status: 'PRESENT',
    },
    {
        id: 2,
        company_id: 2,
        employee_id: 201,
        work_date: '2026-08-14',
        check_in: '09:00:00',
        check_out: '18:00:00',
        status: 'PRESENT',
    }
];
