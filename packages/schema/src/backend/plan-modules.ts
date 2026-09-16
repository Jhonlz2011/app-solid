import { MODULE_ACTIONS_MAP, type RbacModule } from '../enums';

/**
 * Módulos Core disponibles en TODOS los planes (incluso Freemium)
 */
export const CORE_MODULES: readonly RbacModule[] = [
    'dashboard',
    'companies',
    'config',
    'users',
    'roles',
    'permissions',
    'menu',
    'clients',
    'suppliers',
    'products',
    'services',
    'categories',
    'brands',
    'uom',
    'attributes',
    'inventory',
    'locations',
    'documents',
    'invoices',
] as const;

/**
 * Mapeo oficial entre Códigos de Feature comercial y Módulos RBAC técnicos
 */
export const FEATURE_TO_MODULES_MAP: Record<string, readonly RbacModule[]> = {
    'modules.invoicing_sri': ['invoices', 'documents'],
    'modules.retentions': ['retentions'],
    'modules.remission_guides': ['remission_guides'],
    'modules.pos': ['pos', 'pos_sell', 'pos_sessions', 'pos_history'],
    'modules.accounting': ['receivable', 'payable'],
    'modules.hr_payroll': ['hr', 'employees', 'schedules', 'hours'],
    'modules.manufacturing': ['manufacturing', 'bom', 'work_orders', 'materials', 'production'],
    'modules.tools': ['tools', 'tool_loans'],
    'modules.crm': ['crm', 'visits', 'budgets'],
} as const;

/**
 * Mapa estático de features habilitadas por plan estándar (Zero round-trip fallback)
 */
export const PLAN_DEFAULT_ENABLED_FEATURES: Record<string, readonly string[]> = {
    free: [
        'modules.invoicing_sri',
    ],
    starter_monthly: [
        'modules.invoicing_sri',
        'modules.retentions',
        'modules.remission_guides',
        'modules.pos',
    ],
    starter_yearly: [
        'modules.invoicing_sri',
        'modules.retentions',
        'modules.remission_guides',
        'modules.pos',
    ],
    pro_monthly: [
        'modules.invoicing_sri',
        'modules.retentions',
        'modules.remission_guides',
        'modules.pos',
        'modules.accounting',
        'modules.hr_payroll',
    ],
    pro_yearly: [
        'modules.invoicing_sri',
        'modules.retentions',
        'modules.remission_guides',
        'modules.pos',
        'modules.accounting',
        'modules.hr_payroll',
    ],
    enterprise_monthly: [
        'modules.invoicing_sri',
        'modules.retentions',
        'modules.remission_guides',
        'modules.pos',
        'modules.accounting',
        'modules.hr_payroll',
        'modules.manufacturing',
        'modules.tools',
        'modules.crm',
    ],
    enterprise_yearly: [
        'modules.invoicing_sri',
        'modules.retentions',
        'modules.remission_guides',
        'modules.pos',
        'modules.accounting',
        'modules.hr_payroll',
        'modules.manufacturing',
        'modules.tools',
        'modules.crm',
    ],
};

/**
 * Resuelve el conjunto de módulos RBAC permitidos a partir de una lista de features activas
 */
export function resolveAllowedModulesFromFeatures(activeFeatures: string[] | Record<string, boolean | number>): Set<RbacModule> {
    const allowed = new Set<RbacModule>(CORE_MODULES);

    const isFeatureActive = (code: string): boolean => {
        if (Array.isArray(activeFeatures)) {
            return activeFeatures.includes(code);
        }
        return Boolean(activeFeatures[code]);
    };

    for (const [featureCode, modules] of Object.entries(FEATURE_TO_MODULES_MAP)) {
        if (isFeatureActive(featureCode)) {
            for (const mod of modules) {
                allowed.add(mod);
            }
        }
    }

    return allowed;
}

/**
 * Resuelve los módulos RBAC permitidos para un plan determinado (O(1), en memoria pura)
 */
export function resolveAllowedModulesForPlan(planId: string = 'free'): Set<RbacModule> {
    const normalizedPlanId = planId.toLowerCase().trim();
    const features = PLAN_DEFAULT_ENABLED_FEATURES[normalizedPlanId] || PLAN_DEFAULT_ENABLED_FEATURES.free;
    return resolveAllowedModulesFromFeatures(features as string[]);
}
