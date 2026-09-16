/**
 * saas-seed-data.ts — Catálogo maestro de Planes, Features, Add-ons y Paquetes de Documentos SRI
 * para el modelo SaaS Multi-Tenant de Zelys ERP (Configuración Optimizada para Producción 2026).
 * 
 * Filosofía y Posicionamiento Zelys:
 * - Estilo Zelys: moderno, reactivo, alta velocidad (Bun + Elysia + PostgreSQL RLS + SolidJS).
 * - Plan Freemium Perpetuo: 15 comprobantes SRI anuales sin caducidad ni tarjeta de crédito.
 * - Caballo de Troya del Contador: 1 Asiento de Contador Externo Gratuito en todos los planes de pago.
 * - Ventaja demoledora en POS: Módulo de Punto de Venta incluido desde el Plan Emprendedor ($9.99/mes).
 * - Facturación Ilimitada: Sin fricción ni límites en Planes Pro y Corporativo para competir y superar a Contífico.
 * - Paquetes prepago de recarga: Saldo acumulable y protegido ante comisiones de pasarelas de pago.
 */

// ============================================================================
// 1. TIPOS Y ESTRUCTURAS DE DATOS SAAS
// ============================================================================

export type BillingInterval = 'MONTHLY' | 'YEARLY' | 'ONE_TIME';
export type FeatureValueType = 'BOOLEAN' | 'NUMERIC';
export type FeatureCategory = 'core' | 'modules' | 'limits' | 'storage' | 'integrations' | 'compliance';
export type AddonType = 'USER_SEATS' | 'STORAGE_GB' | 'BRANCHES' | 'SRI_DOCUMENTS' | 'INTEGRATION' | 'POS_REGISTERS';
export type AddonBillingType = 'RECURRING' | 'ONE_TIME';

export interface SaasFeatureDef {
    code: string;
    name: string;
    description: string;
    type: FeatureValueType;
    category: FeatureCategory;
    unitLabel?: string; // 'docs/mes', 'usuarios', 'GB', 'bodegas', 'cajas'
}

export interface SaasPlanDef {
    id: string;
    name: string;
    description: string;
    interval: BillingInterval;
    priceUsd: number;
    annualDiscountPercent?: number;
    trialDays: number;
    isPopular?: boolean;
    sortOrder: number;
}

export interface SaasPlanFeatureDef {
    planId: string;
    featureCode: string;
    valueBoolean?: boolean;
    valueNumeric?: number; // -1 indica ILIMITADO
}

export interface SaasAddonDef {
    id: string;
    name: string;
    description: string;
    addonType: AddonType;
    billingType: AddonBillingType; // 'RECURRING' (se suma a la mensualidad/anualidad) o 'ONE_TIME' (prepago)
    priceUsd: number;              // Precio recurrente mensual o pago único
    quantity: number;              // Cantidad que añade (ej. 1 usuario, 10 GB, 100 facturas)
    unitLabel: string;             // 'usuario adicional', 'GB extra', 'sucursal'
    validityDays?: number | null;  // Para ONE_TIME: null = no expira; 365 = 1 año
    isPopular?: boolean;
    sortOrder: number;
}

export interface DocumentPackageDef {
    id: string;
    name: string;
    description: string;
    documentCount: number;      // 10, 50, 100, 500, 1000 docs SRI
    priceUsd: number;           // Precio en USD (Ecuador)
    unitCostUsd: number;        // Costo por documento individual
    validityDays: number | null;// null = No expiran nunca; 365 = 1 año de vigencia
    isPopular?: boolean;
    sortOrder: number;
}

// Estructura completa del Tenant con Plan Base + Add-ons contratados
export interface TenantEntitlementsExample {
    companyId: number;
    companySlug: string;
    planId: string;
    planStatus: 'ACTIVE' | 'GRACE_PERIOD' | 'PAST_DUE' | 'SUSPENDED';
    gracePeriodEndsAt?: string | null; // Fecha límite para regularizar cobro antes de pasar a PAST_DUE

    // 1. Asientos de Usuario (Seats)
    basePlanUsers: number;
    addonUsers: number;             // Usuarios extra contratados mensualmente
    hasFreeAccountantSeat: boolean; // Si el plan otorga 1 asiento gratuito exclusivo para contador
    accountantSeatAssigned: boolean;// Si ya hay un usuario asignado al rol contador externo
    activeUsersCount: number;        // Usuarios operativos registrados actualmente

    // 2. Almacenamiento (Storage en MB)
    basePlanStorageMb: number;
    addonStorageMb: number;          // GBs extras contratados en MB
    usedStorageMb: number;           // Espacio consumido actualmente en S3/R2

    // 3. Documentos SRI (Cuota del plan + Packs prepago)
    planSriLimit: number;            // Cantidad otorgada por el plan (-1 = Ilimitado, 15 al año o 250 al mes)
    planSriInterval: 'MONTHLY' | 'YEARLY'; // Periodo de renovación de la cuota
    planSriUsed: number;             // Comprobantes emitidos en el periodo actual
    planMonthlySriLimit?: number;    // Retrocompatibilidad
    planMonthlySriUsed?: number;     // Retrocompatibilidad
    purchasedDocumentPacks: {
        id: string;
        packageId: string;
        packageName: string;
        purchasedAt: string;
        expiresAt: string | null;
        totalCredits: number;
        remainingCredits: number;
        status: 'ACTIVE' | 'DEPLETED' | 'EXPIRED';
    }[];

    // 4. Add-ons de Sucursales y Cajas POS
    basePlanEstablishments: number;
    addonEstablishments: number;
    activeEstablishmentsCount: number;

    basePlanPosRegisters: number;
    addonPosRegisters: number;
    activePosRegistersCount: number;

    // 5. Módulos activados (Base + Add-ons)
    activeModules: Record<string, boolean>;
}

// ============================================================================
// 2. CATÁLOGO MAESTRO DE FEATURES (Límites, Módulos e Integraciones)
// ============================================================================

export const SAAS_FEATURES: SaasFeatureDef[] = [
    // -------------------------------------------------------------
    // A. Multi-Empresa vs Sucursales (Diferenciación Fundamental)
    // -------------------------------------------------------------
    {
        code: 'max_companies',
        name: 'Empresas / RUCs por Cuenta',
        description: 'Cantidad de personas jurídicas o RUCs independientes (tenants) que un usuario puede administrar bajo su cuenta',
        type: 'NUMERIC',
        category: 'core',
        unitLabel: 'empresas',
    },
    {
        code: 'max_establishments',
        name: 'Sucursales / Establecimientos SRI',
        description: 'Puntos físicos de emisión registrados en el RUC ante el SRI (001 Matriz, 002 Sucursal, etc.) dentro de la misma empresa',
        type: 'NUMERIC',
        category: 'limits',
        unitLabel: 'sucursales',
    },

    // -------------------------------------------------------------
    // B. Cuotas de Capacidad, Asientos y Documentos SRI
    // -------------------------------------------------------------
    {
        code: 'max_users',
        name: 'Asientos de Usuario Operativos',
        description: 'Usuarios activos con acceso concurrente al sistema (administradores, vendedores, cajeros, bodegueros)',
        type: 'NUMERIC',
        category: 'limits',
        unitLabel: 'usuarios',
    },
    {
        code: 'free_accountant_seat',
        name: 'Asiento de Contador Externo Gratuito',
        description: 'Acceso exclusivo y sin costo para un contador externo certificado (con acceso a Libro Diario, Mayor, Balances NIIF, Retenciones y ATS)',
        type: 'BOOLEAN',
        category: 'limits',
    },
    {
        code: 'sri_documents_monthly',
        name: 'Comprobantes SRI Mensuales',
        description: 'Facturas, notas de crédito, guías de remisión y retenciones autorizadas al mes (-1 indica emisión ilimitada)',
        type: 'NUMERIC',
        category: 'limits',
        unitLabel: 'docs/mes',
    },
    {
        code: 'sri_documents_yearly',
        name: 'Comprobantes SRI Anuales',
        description: 'Facturas, notas de crédito, guías de remisión y retenciones autorizadas al año (-1 indica emisión ilimitada)',
        type: 'NUMERIC',
        category: 'limits',
        unitLabel: 'docs/año',
    },
    {
        code: 'max_storage_mb',
        name: 'Almacenamiento de Archivos',
        description: 'Espacio en nube para XMLs, PDFs RIDE, firmas electrónicas .p12, fotos de productos y archivos adjuntos',
        type: 'NUMERIC',
        category: 'storage',
        unitLabel: 'MB',
    },
    {
        code: 'max_warehouses',
        name: 'Bodegas de Inventario',
        description: 'Cantidad de almacenes físicos independientes para control de existencias y transferencias',
        type: 'NUMERIC',
        category: 'limits',
        unitLabel: 'bodegas',
    },
    {
        code: 'max_pos_registers',
        name: 'Cajas de Punto de Venta (POS)',
        description: 'Terminales de punto de venta simultáneas con arqueo de caja y emisión rápida de tickets',
        type: 'NUMERIC',
        category: 'limits',
        unitLabel: 'cajas POS',
    },
    {
        code: 'max_products',
        name: 'Catálogo de Productos y Servicios',
        description: 'Cantidad máxima de SKUs registrados en el inventario (-1 indica ilimitado)',
        type: 'NUMERIC',
        category: 'limits',
        unitLabel: 'productos',
    },
    {
        code: 'max_price_lists',
        name: 'Listas de Precios',
        description: 'Tarifas diferenciadas: Mayorista, Distribuidor, Minorista, Promociones (-1 indica ilimitado)',
        type: 'NUMERIC',
        category: 'limits',
        unitLabel: 'listas',
    },
    {
        code: 'audit_retention_days',
        name: 'Retención de Auditoría',
        description: 'Días que se conservan los registros de cambios, inicios de sesión y tracking de acciones (cumplimiento SRI)',
        type: 'NUMERIC',
        category: 'compliance',
        unitLabel: 'días',
    },

    // -------------------------------------------------------------
    // C. Módulos de Negocio Zelys (Booleans)
    // -------------------------------------------------------------
    {
        code: 'modules.invoicing_sri',
        name: 'Facturación Electrónica SRI',
        description: 'Emisión y autorización automática de facturas y notas de crédito con firma electrónica .p12',
        type: 'BOOLEAN',
        category: 'modules',
    },
    {
        code: 'modules.retentions',
        name: 'Retenciones Electrónicas SRI',
        description: 'Emisión de comprobantes de retención en la fuente e IVA (para Agentes de Retención y RIMPE)',
        type: 'BOOLEAN',
        category: 'modules',
    },
    {
        code: 'modules.remission_guides',
        name: 'Guías de Remisión Electrónicas',
        description: 'Emisión de guías de remisión con datos de transportista, placas y rutas para control en carretera',
        type: 'BOOLEAN',
        category: 'modules',
    },
    {
        code: 'modules.pos',
        name: 'Punto de Venta (POS)',
        description: 'Terminal de mostrador de ultra-alta velocidad con lector de código de barras, soporte de ticket térmico y arqueos',
        type: 'BOOLEAN',
        category: 'modules',
    },
    {
        code: 'modules.manufacturing',
        name: 'Manufactura y Órdenes de Producción (MRP)',
        description: 'Fórmulas y recetas (BOM), costeo de mano de obra directa, mermas y consumo automático de materia prima',
        type: 'BOOLEAN',
        category: 'modules',
    },
    {
        code: 'modules.accounting',
        name: 'Contabilidad Formal NIIF & ATS',
        description: 'Asientos contables automáticos, plan de cuentas ecuatoriano, balance general, estado de resultados y generación de ATS para el SRI',
        type: 'BOOLEAN',
        category: 'modules',
    },
    {
        code: 'modules.sri_received_sync',
        name: 'Sincronización de Comprobantes Recibidos SRI',
        description: 'Descarga e importación automática de facturas y retenciones emitidas por proveedores desde el portal del SRI para compras y ATS',
        type: 'BOOLEAN',
        category: 'modules',
    },
    {
        code: 'modules.hr_payroll',
        name: 'Nómina y Talento Humano',
        description: 'Rol de pagos, horas extras, provisiones sociales (13ro, 14to sueldo, fondos de reserva) y planilla IESS',
        type: 'BOOLEAN',
        category: 'modules',
    },

    // -------------------------------------------------------------
    // D. Integraciones y Servicios de Valor Agregado
    // -------------------------------------------------------------
    {
        code: 'integrations.whatsapp',
        name: 'Envío de Facturas por WhatsApp',
        description: 'Envío automático del PDF RIDE y XML al WhatsApp del cliente al autorizarse en el SRI',
        type: 'BOOLEAN',
        category: 'integrations',
    },
    {
        code: 'integrations.custom_smtp',
        name: 'Correo con Dominio Propio (SMTP)',
        description: 'Envío de facturas desde facturacion@suempresa.com en lugar de notificaciones@zelys.app',
        type: 'BOOLEAN',
        category: 'integrations',
    },
    {
        code: 'modules.custom_domain',
        name: 'Dominio o Subdominio Personalizado',
        description: 'Acceso al ERP mediante mi-empresa.zelys.app o dominio propio erp.miempresa.com con certificado SSL dedicado',
        type: 'BOOLEAN',
        category: 'integrations',
    },
    {
        code: 'modules.api_access',
        name: 'API REST & Webhooks',
        description: 'Acceso a la API para sincronizar inventario con Shopify, WooCommerce, marketplaces o apps móviles',
        type: 'BOOLEAN',
        category: 'integrations',
    },
];

// ============================================================================
// 3. PLANES SAAS ZELYS (Optimizados para Competir y Ganar en Ecuador 2026)
// ============================================================================

export const SAAS_PLANS: SaasPlanDef[] = [
    // --- 3.1 Plan Freemium Zelys (Perpetuo, Sin Tarjeta ni Expiración) ---
    {
        id: 'free',
        name: 'Plan Freemium',
        description: 'Para profesionales y micro-emprendimientos. Incluye 15 comprobantes SRI al año de por vida sin costo ni prueba temporal.',
        interval: 'YEARLY',
        priceUsd: 0.00,
        trialDays: 0, // Sin free trial: perpetuo (15 comprobantes al año)
        sortOrder: 1,
    },

    // --- 3.2 Plan Emprendedor (Starter + POS Integrado) ---
    // Frente a Contífico que cobra $24.40 solo por POS, Zelys entrega POS + Facturación por $9.99/mes
    {
        id: 'starter_monthly',
        name: 'Plan Emprendedor (Starter + POS)',
        description: 'Ideal para comercios, minimarkets y profesionales con punto de venta activo y facturación recurrente.',
        interval: 'MONTHLY',
        priceUsd: 9.99,
        trialDays: 0,
        sortOrder: 2,
    },
    {
        id: 'starter_yearly',
        name: 'Plan Emprendedor (Anual)',
        description: 'Ahorra 2 meses pagando $99.00 al año (~$8.25/mes) con POS completo y Asiento de Contador Gratis.',
        interval: 'YEARLY',
        priceUsd: 99.00,
        annualDiscountPercent: 17,
        trialDays: 0,
        sortOrder: 3,
    },

    // --- 3.3 Plan Negocio Pro (ERP Completo + Facturación Ilimitada) ---
    // Compite directamente contra Contífico Esencial ($33.08) y Gestión Plus ($27.63), superándolos en todo
    {
        id: 'pro_monthly',
        name: 'Plan Negocio Pro (ERP & Contable)',
        description: 'El ERP completo para distribuidoras, almacenes y ferreterías con contabilidad NIIF, nómina, WhatsApp y facturación sin límite.',
        interval: 'MONTHLY',
        priceUsd: 34.99,
        trialDays: 0,
        isPopular: true,
        sortOrder: 4,
    },
    {
        id: 'pro_yearly',
        name: 'Plan Negocio Pro (Anual)',
        description: 'Ahorro del 17% pagando $349.00 al año (~$29.08/mes) con soporte prioritario y facturación ilimitada.',
        interval: 'YEARLY',
        priceUsd: 349.00,
        annualDiscountPercent: 17,
        trialDays: 0,
        isPopular: true,
        sortOrder: 5,
    },

    // --- 3.4 Plan Corporativo (Manufactura & Holding) ---
    // Para medianas e industrias que requieren trazabilidad, BOM y múltiples razones sociales
    {
        id: 'enterprise_monthly',
        name: 'Plan Corporativo (Manufactura & Holding)',
        description: 'Para industrias manufactureras y holdings con órdenes de producción (BOM), múltiples RUCs y facturación sin límite.',
        interval: 'MONTHLY',
        priceUsd: 89.99,
        trialDays: 0,
        sortOrder: 6,
    },
    {
        id: 'enterprise_yearly',
        name: 'Plan Corporativo (Anual)',
        description: 'Facturación anual de $899.00 al año (~$74.91/mes) con onboarding asistido y retención de auditoría de 7 años.',
        interval: 'YEARLY',
        priceUsd: 899.00,
        annualDiscountPercent: 17,
        trialDays: 0,
        sortOrder: 7,
    },
];

// ============================================================================
// 4. MATRIZ PLAN-FEATURE (Límites Calibrados para Producción)
// ============================================================================

export const SAAS_PLAN_FEATURES: SaasPlanFeatureDef[] = [
    // -------------------------------------------------------------
    // PLAN FREEMIUM: 15 comprobantes SRI al año de por vida, 1 usuario, 1 sucursal, 150 MB
    // -------------------------------------------------------------
    { planId: 'free', featureCode: 'max_companies', valueNumeric: 1 },
    { planId: 'free', featureCode: 'max_establishments', valueNumeric: 1 },
    { planId: 'free', featureCode: 'max_users', valueNumeric: 1 },
    { planId: 'free', featureCode: 'free_accountant_seat', valueBoolean: false },
    { planId: 'free', featureCode: 'sri_documents_yearly', valueNumeric: 15 }, // 15 docs/año perpetuo
    { planId: 'free', featureCode: 'sri_documents_monthly', valueNumeric: 0 },
    { planId: 'free', featureCode: 'max_storage_mb', valueNumeric: 150 },
    { planId: 'free', featureCode: 'max_warehouses', valueNumeric: 1 },
    { planId: 'free', featureCode: 'max_pos_registers', valueNumeric: 0 },
    { planId: 'free', featureCode: 'max_products', valueNumeric: 50 },
    { planId: 'free', featureCode: 'max_price_lists', valueNumeric: 1 },
    { planId: 'free', featureCode: 'audit_retention_days', valueNumeric: 30 },
    { planId: 'free', featureCode: 'modules.invoicing_sri', valueBoolean: true },
    { planId: 'free', featureCode: 'modules.retentions', valueBoolean: false },
    { planId: 'free', featureCode: 'modules.remission_guides', valueBoolean: false },
    { planId: 'free', featureCode: 'modules.pos', valueBoolean: false },
    { planId: 'free', featureCode: 'modules.manufacturing', valueBoolean: false },
    { planId: 'free', featureCode: 'modules.accounting', valueBoolean: false },
    { planId: 'free', featureCode: 'modules.sri_received_sync', valueBoolean: false },
    { planId: 'free', featureCode: 'modules.hr_payroll', valueBoolean: false },
    { planId: 'free', featureCode: 'integrations.whatsapp', valueBoolean: false },
    { planId: 'free', featureCode: 'integrations.custom_smtp', valueBoolean: false },
    { planId: 'free', featureCode: 'modules.custom_domain', valueBoolean: false },
    { planId: 'free', featureCode: 'modules.api_access', valueBoolean: false },

    // -------------------------------------------------------------
    // PLAN EMPRENDEDOR ($9.99/mes o $99/año):
    // 250 facturas/mes, 2 usuarios operativos + 1 Asiento de Contador Gratis, POS incluido
    // -------------------------------------------------------------
    ...(['starter_monthly', 'starter_yearly'] as const).flatMap((planId) => [
        { planId, featureCode: 'max_companies', valueNumeric: 1 },
        { planId, featureCode: 'max_establishments', valueNumeric: 1 },
        { planId, featureCode: 'max_users', valueNumeric: 2 }, // 2 usuarios operativos base
        { planId, featureCode: 'free_accountant_seat', valueBoolean: true }, // ¡1 Contador gratis!
        { planId, featureCode: 'sri_documents_monthly', valueNumeric: 250 }, // 250 docs/mes
        { planId, featureCode: 'max_storage_mb', valueNumeric: 1024 }, // 1 GB
        { planId, featureCode: 'max_warehouses', valueNumeric: 2 },
        { planId, featureCode: 'max_pos_registers', valueNumeric: 1 }, // 1 Caja POS completa
        { planId, featureCode: 'max_products', valueNumeric: 1000 },
        { planId, featureCode: 'max_price_lists', valueNumeric: 2 },
        { planId, featureCode: 'audit_retention_days', valueNumeric: 60 },
        { planId, featureCode: 'modules.invoicing_sri', valueBoolean: true },
        { planId, featureCode: 'modules.retentions', valueBoolean: true },
        { planId, featureCode: 'modules.remission_guides', valueBoolean: true },
        { planId, featureCode: 'modules.pos', valueBoolean: true },
        { planId, featureCode: 'modules.manufacturing', valueBoolean: false },
        { planId, featureCode: 'modules.accounting', valueBoolean: false },
        { planId, featureCode: 'modules.sri_received_sync', valueBoolean: false },
        { planId, featureCode: 'modules.hr_payroll', valueBoolean: false },
        { planId, featureCode: 'integrations.whatsapp', valueBoolean: false },
        { planId, featureCode: 'integrations.custom_smtp', valueBoolean: false },
        { planId, featureCode: 'modules.custom_domain', valueBoolean: false },
        { planId, featureCode: 'modules.api_access', valueBoolean: false },
    ]),

    // -------------------------------------------------------------
    // PLAN NEGOCIO PRO ($34.99/mes o $349/año):
    // Facturación Ilimitada (-1), 5 usuarios operativos + 1 Asiento de Contador Gratis, 2 RUCs, Contabilidad formal, Nómina y WhatsApp
    // -------------------------------------------------------------
    ...(['pro_monthly', 'pro_yearly'] as const).flatMap((planId) => [
        { planId, featureCode: 'max_companies', valueNumeric: 2 }, // Permite gestionar 2 RUCs
        { planId, featureCode: 'max_establishments', valueNumeric: 3 },
        { planId, featureCode: 'max_users', valueNumeric: 5 }, // 5 usuarios operativos base
        { planId, featureCode: 'free_accountant_seat', valueBoolean: true }, // ¡1 Contador gratis!
        { planId, featureCode: 'sri_documents_monthly', valueNumeric: -1 }, // ¡ILIMITADO! (Fair Use Policy 3,000 docs)
        { planId, featureCode: 'max_storage_mb', valueNumeric: 5120 }, // 5 GB
        { planId, featureCode: 'max_warehouses', valueNumeric: 5 },
        { planId, featureCode: 'max_pos_registers', valueNumeric: 3 },
        { planId, featureCode: 'max_products', valueNumeric: -1 }, // Ilimitado
        { planId, featureCode: 'max_price_lists', valueNumeric: 5 },
        { planId, featureCode: 'audit_retention_days', valueNumeric: 365 },
        { planId, featureCode: 'modules.invoicing_sri', valueBoolean: true },
        { planId, featureCode: 'modules.retentions', valueBoolean: true },
        { planId, featureCode: 'modules.remission_guides', valueBoolean: true },
        { planId, featureCode: 'modules.pos', valueBoolean: true },
        { planId, featureCode: 'modules.manufacturing', valueBoolean: false },
        { planId, featureCode: 'modules.accounting', valueBoolean: true },
        { planId, featureCode: 'modules.sri_received_sync', valueBoolean: true }, // ¡Sincronización SRI Proveedores activa!
        { planId, featureCode: 'modules.hr_payroll', valueBoolean: true },
        { planId, featureCode: 'integrations.whatsapp', valueBoolean: true },
        { planId, featureCode: 'integrations.custom_smtp', valueBoolean: true },
        { planId, featureCode: 'modules.custom_domain', valueBoolean: true },
        { planId, featureCode: 'modules.api_access', valueBoolean: true },
    ]),

    // -------------------------------------------------------------
    // PLAN CORPORATIVO ($89.99/mes o $899/año):
    // Facturación Ilimitada (-1), 15 usuarios + 1 Asiento de Contador Gratis, 3 RUCs, Manufactura MRP y Auditoría de 7 años
    // -------------------------------------------------------------
    ...(['enterprise_monthly', 'enterprise_yearly'] as const).flatMap((planId) => [
        { planId, featureCode: 'max_companies', valueNumeric: 3 }, // Holding de hasta 3 empresas
        { planId, featureCode: 'max_establishments', valueNumeric: 8 },
        { planId, featureCode: 'max_users', valueNumeric: 15 }, // 15 usuarios operativos base
        { planId, featureCode: 'free_accountant_seat', valueBoolean: true }, // ¡1 Contador gratis!
        { planId, featureCode: 'sri_documents_monthly', valueNumeric: -1 }, // ¡ILIMITADO! (Fair Use Policy 10,000 docs)
        { planId, featureCode: 'max_storage_mb', valueNumeric: 20480 }, // 20 GB
        { planId, featureCode: 'max_warehouses', valueNumeric: -1 }, // Ilimitadas
        { planId, featureCode: 'max_pos_registers', valueNumeric: 8 },
        { planId, featureCode: 'max_products', valueNumeric: -1 },
        { planId, featureCode: 'max_price_lists', valueNumeric: -1 },
        { planId, featureCode: 'audit_retention_days', valueNumeric: 2555 }, // 7 años (exigencia legal SRI)
        { planId, featureCode: 'modules.invoicing_sri', valueBoolean: true },
        { planId, featureCode: 'modules.retentions', valueBoolean: true },
        { planId, featureCode: 'modules.remission_guides', valueBoolean: true },
        { planId, featureCode: 'modules.pos', valueBoolean: true },
        { planId, featureCode: 'modules.manufacturing', valueBoolean: true },
        { planId, featureCode: 'modules.accounting', valueBoolean: true },
        { planId, featureCode: 'modules.sri_received_sync', valueBoolean: true }, // ¡Sincronización SRI Proveedores activa!
        { planId, featureCode: 'modules.hr_payroll', valueBoolean: true },
        { planId, featureCode: 'integrations.whatsapp', valueBoolean: true },
        { planId, featureCode: 'integrations.custom_smtp', valueBoolean: true },
        { planId, featureCode: 'modules.custom_domain', valueBoolean: true },
        { planId, featureCode: 'modules.api_access', valueBoolean: true },
    ]),
];

// ============================================================================
// 5. CATÁLOGO DE ADD-ONS RECURRENTES (Asientos, Almacenamiento, Sucursales)
// ============================================================================

export const SAAS_ADDONS: SaasAddonDef[] = [
    // --- 5.1 Asientos de Usuario Adicionales (User Seats) ---
    {
        id: 'addon_user_single',
        name: '+1 Asiento de Usuario Adicional',
        description: 'Permite invitar a un colaborador operativo adicional con su propio rol y permisos',
        addonType: 'USER_SEATS',
        billingType: 'RECURRING',
        priceUsd: 4.00, // $4.00/mes
        quantity: 1,
        unitLabel: 'usuario adicional',
        sortOrder: 1,
    },
    {
        id: 'addon_user_pack_5',
        name: 'Pack +5 Asientos de Usuario',
        description: 'Paquete con tarifa reducida ($3.00/usuario) para equipos en expansión',
        addonType: 'USER_SEATS',
        billingType: 'RECURRING',
        priceUsd: 15.00, // $15.00/mes
        quantity: 5,
        unitLabel: 'usuarios',
        isPopular: true,
        sortOrder: 2,
    },

    // --- 5.2 Almacenamiento en la Nube Adicional (Storage GB) ---
    {
        id: 'addon_storage_10gb',
        name: '+10 GB de Almacenamiento',
        description: 'Espacio adicional para PDFs RIDE, XMLs de comprobantes y fotos de catálogo',
        addonType: 'STORAGE_GB',
        billingType: 'RECURRING',
        priceUsd: 4.99, // $4.99/mes
        quantity: 10,
        unitLabel: 'GB extra',
        sortOrder: 3,
    },
    {
        id: 'addon_storage_50gb',
        name: '+50 GB de Almacenamiento',
        description: 'Paquete de almacenamiento masivo para empresas con alto archivo documental',
        addonType: 'STORAGE_GB',
        billingType: 'RECURRING',
        priceUsd: 19.99, // $19.99/mes
        quantity: 50,
        unitLabel: 'GB extra',
        sortOrder: 4,
    },

    // --- 5.3 Sucursales / Establecimientos SRI Adicionales ---
    {
        id: 'addon_establishment_single',
        name: '+1 Sucursal / Establecimiento SRI',
        description: 'Habilita un nuevo punto físico autorizado ante el SRI (ej. Sucursal 002)',
        addonType: 'BRANCHES',
        billingType: 'RECURRING',
        priceUsd: 7.99, // $7.99/mes
        quantity: 1,
        unitLabel: 'sucursal',
        sortOrder: 5,
    },

    // --- 5.4 Integraciones de Valor Añadido ---
    {
        id: 'addon_whatsapp_gateway',
        name: 'Conector WhatsApp Business Automático',
        description: 'Envío desatendido de facturas y recibos al celular de tus clientes',
        addonType: 'INTEGRATION',
        billingType: 'RECURRING',
        priceUsd: 9.99, // $9.99/mes
        quantity: 1,
        unitLabel: 'conexión WhatsApp',
        sortOrder: 6,
    },

    // --- 5.5 Cajas Registradoras de Punto de Venta (POS) Adicionales ---
    {
        id: 'addon_pos_register_single',
        name: '+1 Caja Registradora POS Adicional',
        description: 'Habilita un punto de cobro simultáneo en mostrador con arqueo de turno independiente',
        addonType: 'POS_REGISTERS',
        billingType: 'RECURRING',
        priceUsd: 4.99, // $4.99/mes
        quantity: 1,
        unitLabel: 'caja POS',
        sortOrder: 7,
    },
];

// ============================================================================
// 6. PAQUETES PREPAGO DE COMPROBANTES SRI (One-Time / Margen Protegido)
// ============================================================================

/**
 * Precios ajustados considerando comisiones de pasarela en Ecuador (~4% + $0.35 por transacción):
 * - El ticket mínimo inicia en $3.50 para dejar margen neto positivo.
 * - Los paquetes funcionan como bolsa de saldo a favor sin fecha de caducidad (o 365 días en packs mayores).
 * - Ideales para recargas desde el Plan Freemium o picos de ventas en el Plan Emprendedor.
 */
export const DOCUMENT_PACKAGES: DocumentPackageDef[] = [
    {
        id: 'pack_10_docs',
        name: 'Micro Pack: 10 Comprobantes',
        description: 'Para personas naturales o emisión ocasional sin costo fijo mensual.',
        documentCount: 10,
        priceUsd: 3.50, // $0.35/doc (margen protegido tras comisiones)
        unitCostUsd: 0.35,
        validityDays: null, // No expira
        sortOrder: 1,
    },
    {
        id: 'pack_50_docs',
        name: 'Pack Pyme: 50 Comprobantes',
        description: 'Recarga rápida para picos de venta sin cambiar de plan mensual.',
        documentCount: 50,
        priceUsd: 11.99, // ~$0.24/doc
        unitCostUsd: 0.239,
        validityDays: null,
        sortOrder: 2,
    },
    {
        id: 'pack_100_docs',
        name: 'Pack Comercial: 100 Comprobantes',
        description: 'El paquete más elegido por pequeños comercios y ferreterías.',
        documentCount: 100,
        priceUsd: 17.99, // ~$0.18/doc
        unitCostUsd: 0.179,
        validityDays: null,
        isPopular: true,
        sortOrder: 3,
    },
    {
        id: 'pack_500_docs',
        name: 'Pack Mayorista: 500 Comprobantes',
        description: 'Tarifa reducida por volumen con vigencia de 1 año calendario.',
        documentCount: 500,
        priceUsd: 64.99, // ~$0.13/doc
        unitCostUsd: 0.129,
        validityDays: 365,
        sortOrder: 4,
    },
    {
        id: 'pack_1000_docs',
        name: 'Mega Pack: 1000 Comprobantes',
        description: 'Máximo ahorro para distribuidores con alto tráfico de ventas.',
        documentCount: 1000,
        priceUsd: 109.99, // ~$0.11/doc
        unitCostUsd: 0.109,
        validityDays: 365,
        sortOrder: 5,
    },
];

// ============================================================================
// 7. EJEMPLO EN VIVO: CÓMO SE RESUELVE LA CAPACIDAD TOTAL DEL INQUILINO
// ============================================================================

/**
 * Escenario:
 * La empresa "Ferretería El Cóndor" está en el Plan Emprendedor ($9.99/mes):
 * - Plan base incluye: 2 usuarios operativos, 1 asiento de contador externo gratuito, 1 GB de espacio, 250 facturas/mes.
 * - Contrató el add-on '+1 Asiento de Usuario' ($4.00/mes) -> Total 3 usuarios operativos + 1 contador.
 * - Factura mensual de Zelys: $9.99 + $4.00 = $13.99/mes.
 */
export const TENANT_ENTITLEMENTS_EXAMPLE: TenantEntitlementsExample = {
    companyId: 2,
    companySlug: 'elcondor',
    planId: 'starter_monthly',
    planStatus: 'ACTIVE',

    // Usuarios: 2 base + 1 addon = 3 operativos permitidos + 1 contador gratis
    basePlanUsers: 2,
    addonUsers: 1,
    hasFreeAccountantSeat: true,
    accountantSeatAssigned: true, // Ya tiene a su contador externo registrado
    activeUsersCount: 2,          // 2 usuarios operativos creados (puede invitar 1 operativo más)

    // Almacenamiento: 1024 MB base + 0 addon = 1024 MB
    basePlanStorageMb: 1024,
    addonStorageMb: 0,
    usedStorageMb: 250, // Consumido actualmente

    // Facturación SRI: Cuota base mensual 250 docs (o 15 anuales en Freemium)
    planSriLimit: 250,
    planSriInterval: 'MONTHLY',
    planSriUsed: 110,
    planMonthlySriLimit: 250,
    planMonthlySriUsed: 110,
    purchasedDocumentPacks: [
        {
            id: 'pack-purchase-987',
            packageId: 'pack_100_docs',
            packageName: 'Pack Comercial: 100 Comprobantes',
            purchasedAt: '2026-09-05T10:00:00Z',
            expiresAt: null,
            totalCredits: 100,
            remainingCredits: 100,
            status: 'ACTIVE',
        },
    ],

    // Sucursales y Cajas POS: 1 base + 1 caja addon contratada
    basePlanEstablishments: 1,
    addonEstablishments: 0,
    activeEstablishmentsCount: 1,

    basePlanPosRegisters: 1,
    addonPosRegisters: 1, // Contrató 1 caja extra por $4.99/mes
    activePosRegistersCount: 2, // 2 terminales de cobro activas

    activeModules: {
        'modules.invoicing_sri': true,
        'modules.retentions': true,
        'modules.remission_guides': true,
        'modules.pos': true,
        'modules.manufacturing': false, // No disponible en Plan Emprendedor
        'modules.accounting': false,
        'modules.sri_received_sync': false,
        'modules.hr_payroll': false,
    },
};

// ============================================================================
// 8. FUNCIONES DE VALIDACIÓN Y RESOLUCIÓN PARA EL BACKEND (Elysia Guards)
// ============================================================================

/**
 * Valida si el tenant puede crear o invitar a un nuevo usuario.
 * Si el usuario a invitar tiene el rol 'ACCOUNTANT' y el plan incluye asiento de contador
 * gratuito sin haberlo asignado aún, se le concede sin descontar de la cuota de usuarios operativos.
 */
export function canCreateUser(
    tenant: TenantEntitlementsExample,
    isAccountantRole: boolean = false
): { allowed: boolean; maxAllowed: number; current: number; isFreeAccountantSeat: boolean } {
    if (isAccountantRole && tenant.hasFreeAccountantSeat && !tenant.accountantSeatAssigned) {
        return {
            allowed: true,
            maxAllowed: tenant.basePlanUsers + tenant.addonUsers + 1,
            current: tenant.activeUsersCount,
            isFreeAccountantSeat: true,
        };
    }

    const maxAllowed = tenant.basePlanUsers + tenant.addonUsers;
    return {
        allowed: tenant.activeUsersCount < maxAllowed,
        maxAllowed,
        current: tenant.activeUsersCount,
        isFreeAccountantSeat: false,
    };
}

/**
 * Valida si el tenant puede habilitar una nueva caja registradora POS
 */
export function canCreatePosRegister(
    tenant: TenantEntitlementsExample
): { allowed: boolean; maxAllowed: number; current: number } {
    const maxAllowed = tenant.basePlanPosRegisters + tenant.addonPosRegisters;
    return {
        allowed: tenant.activePosRegistersCount < maxAllowed,
        maxAllowed,
        current: tenant.activePosRegistersCount,
    };
}

/**
 * Valida si el tenant tiene espacio de almacenamiento disponible para subir un archivo
 */
export function canUploadFile(
    tenant: TenantEntitlementsExample,
    fileSizeBytes: number
): { allowed: boolean; availableMb: number } {
    const totalMb = tenant.basePlanStorageMb + tenant.addonStorageMb;
    const availableMb = totalMb - tenant.usedStorageMb;
    const fileMb = fileSizeBytes / (1024 * 1024);
    return {
        allowed: fileMb <= availableMb,
        availableMb,
    };
}

/**
 * Resultado estructurado de la validación de comprobantes SRI
 */
export interface SriDocumentEmissionResult {
    allowed: boolean;
    source: 'PLAN_UNLIMITED' | 'PLAN' | 'PACK' | 'NONE';
    availableCount: number;
    isInGracePeriod?: boolean;
    isFupWarning?: boolean; // Alerta preventiva de uso justo para planes ilimitados
    message?: string;
}

/**
 * Valida la emisión de comprobantes electrónicos SRI:
 * - Si el tenant está en 'PAST_DUE' o 'SUSPENDED', se bloquea la emisión.
 * - Si está en 'GRACE_PERIOD' (ej. 3-5 días tras fallo de pago), se permite emitir pero con flag de advertencia.
 * - Si el plan tiene 'limit === -1', la emisión es ILIMITADA (Planes Pro y Corporativo con salvaguarda FUP).
 * - Si no, consume primero la cuota del periodo regular (Freemium: 15 docs/año, Emprendedor: 250 docs/mes) y luego los paquetes prepago activos.
 */
export function canEmitSriDocument(
    tenant: TenantEntitlementsExample
): SriDocumentEmissionResult {
    // 0. Validación de estado de cuenta
    if (tenant.planStatus === 'SUSPENDED' || tenant.planStatus === 'PAST_DUE') {
        return {
            allowed: false,
            source: 'NONE',
            availableCount: 0,
            message: 'Cuenta suspendida o con pago vencido. Por favor regularice su suscripción.',
        };
    }

    const isInGracePeriod = tenant.planStatus === 'GRACE_PERIOD';
    const limit = tenant.planSriLimit ?? tenant.planMonthlySriLimit ?? 0;
    const used = tenant.planSriUsed ?? tenant.planMonthlySriUsed ?? 0;

    // 1. Facturación Ilimitada (Planes Pro y Corporativo) con Política de Uso Justo (FUP)
    if (limit === -1) {
        // Soft limit de FUP: 3,000 docs/mes en Pro, 15,000 docs/mes en Corp para alertar anomalías o loops
        const isFupWarning = used >= 3000;
        return {
            allowed: true,
            source: 'PLAN_UNLIMITED',
            availableCount: Infinity,
            isInGracePeriod,
            isFupWarning,
            message: isFupWarning
                ? 'Aviso de uso justo: El volumen mensual de emisión ha superado el umbral preventivo de 3,000 documentos.'
                : undefined,
        };
    }

    // 2. Cuota del periodo regular (Freemium: 15 docs/año, Emprendedor: 250 docs/mes)
    const planRemaining = Math.max(0, limit - used);
    const packsRemaining = tenant.purchasedDocumentPacks
        .filter((p) => p.status === 'ACTIVE')
        .reduce((sum, p) => sum + p.remainingCredits, 0);

    const totalAvailable = planRemaining + packsRemaining;

    if (planRemaining > 0) {
        return {
            allowed: true,
            source: 'PLAN',
            availableCount: totalAvailable,
            isInGracePeriod,
        };
    }
    if (packsRemaining > 0) {
        return {
            allowed: true,
            source: 'PACK',
            availableCount: totalAvailable,
            isInGracePeriod,
        };
    }
    return {
        allowed: false,
        source: 'NONE',
        availableCount: 0,
        isInGracePeriod,
        message: 'Ha agotado su cuota de comprobantes. Adquiera un paquete de recarga o suba de plan.',
    };
}
