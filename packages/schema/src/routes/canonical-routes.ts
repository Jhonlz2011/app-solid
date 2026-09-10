/**
 * Canonical ERP Route Mappings & Aliases
 * Shared between backend (seeds, menu service, SPA renderer) and frontend (router, stores).
 * Single Source of Truth for standard platform routes.
 */

export interface CanonicalRouteDef {
    readonly path: string;
    readonly defaultAlias: string;
    readonly secondaryAliases?: readonly string[];
}

export const CANONICAL_ERP_ROUTES: readonly CanonicalRouteDef[] = [
    { path: '/dashboard', defaultAlias: '/panel' },
    { path: '/clients', defaultAlias: '/clientes', secondaryAliases: ['/ventas/clientes'] },
    { path: '/visits', defaultAlias: '/visitas' },
    { path: '/budgets', defaultAlias: '/presupuestos' },
    { path: '/invoices', defaultAlias: '/facturacion' },
    { path: '/products', defaultAlias: '/productos' },
    { path: '/services', defaultAlias: '/servicios' },
    { path: '/categories', defaultAlias: '/categorias' },
    { path: '/brands', defaultAlias: '/marcas' },
    { path: '/uom', defaultAlias: '/unidades', secondaryAliases: ['/unidades-medida'] },
    { path: '/attributes', defaultAlias: '/atributos' },
    { path: '/inventory', defaultAlias: '/inventario' },
    { path: '/movements', defaultAlias: '/movimientos' },
    { path: '/orders', defaultAlias: '/pedidos' },
    { path: '/reception-materials', defaultAlias: '/recepcion' },
    { path: '/locations', defaultAlias: '/ubicaciones' },
    { path: '/shipping-guides', defaultAlias: '/guias-remision' },
    { path: '/tool-loans', defaultAlias: '/herramientas', secondaryAliases: ['/prestamos'] },
    { path: '/work-orders', defaultAlias: '/ordenes-trabajo' },
    { path: '/order-schedule', defaultAlias: '/cronograma' },
    { path: '/history', defaultAlias: '/historial' },
    { path: '/planning', defaultAlias: '/planificacion' },
    { path: '/bom', defaultAlias: '/recetas' },
    { path: '/dispatch-requests', defaultAlias: '/despachos' },
    { path: '/suppliers', defaultAlias: '/proveedores', secondaryAliases: ['/compras/proveedores'] },
    { path: '/purchase-quotes', defaultAlias: '/cotizaciones' },
    { path: '/purchase-orders', defaultAlias: '/ordenes' },
    { path: '/purchase-invoices', defaultAlias: '/facturas-de-compra' },
    { path: '/retentions', defaultAlias: '/retenciones' },
    { path: '/users', defaultAlias: '/usuarios', secondaryAliases: ['/sistema/usuarios'] },
    { path: '/employees', defaultAlias: '/empleados', secondaryAliases: ['/rrhh/empleados'] },
    { path: '/settings', defaultAlias: '/configuracion', secondaryAliases: ['/sistema/configuracion'] },
];

/** Canonical forward map: { '/clientes': '/clients', '/ventas/clientes': '/clients', ... } */
export const CANONICAL_DEFAULT_ALIASES: Record<string, string> = (() => {
    const map: Record<string, string> = {};
    for (const route of CANONICAL_ERP_ROUTES) {
        map[route.defaultAlias] = route.path;
        if (route.secondaryAliases) {
            for (const secondary of route.secondaryAliases) {
                map[secondary] = route.path;
            }
        }
    }
    return map;
})();

/** Canonical reverse map: { '/clients': '/clientes', ... } */
export const CANONICAL_DEFAULT_REVERSE: Record<string, string> = (() => {
    const map: Record<string, string> = {};
    for (const route of CANONICAL_ERP_ROUTES) {
        map[route.path] = route.defaultAlias;
    }
    return map;
})();
