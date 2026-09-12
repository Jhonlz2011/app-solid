import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { staticPlugin } from '@elysiajs/static';

// Routes
import { auth, isAllowedOrigin } from './config/better-auth';
import { tenantRoutes } from './modules/tenants';
import { profileRoutes } from './modules/profile';
import { productRoutes } from './modules/products';
import {
  clientRoutes,
  supplierRoutes,
  employeeRoutes,
  entityRoutes,
} from './modules/entities';
import { brandRoutes, uomRoutes, categoryRoutes, attributeRoutes } from './modules/catalog';
import { modulesRoutes } from './modules/settings';
import { sriRoutes, geonamesRoutes } from './modules/references';
import { rbacRoutes } from './modules/rbac';
import { locationsRoutes, toolLoansRoutes } from './modules/inventory';
import { companyRoutes, vehiclesRoutes, warehousesRoutes } from './modules/settings';
import { webhooksRoutes } from './modules/webhooks';

// Plugins
import { rateLimit } from './plugins/rate-limit';
import { ssePlugin } from './core/sse';
import { rbac } from './plugins/rbac';
import { errorHandlerPlugin } from './plugins/error-handler';

// Services & Config
import { env } from './config/env';
import { initSSERedisAdapter } from './core/sse';
import { serveSpa } from './core/spa';
import { startAuditWorker } from './modules/audit';

// ============================================================================
// 1. CORS — Delegates to shared isAllowedOrigin() from better-auth config
// ============================================================================

const corsOriginValidator = (request: Request): boolean => {
  const origin = request.headers.get('origin');
  if (!origin) return false;

  try {
    const { hostname } = new URL(origin);
    return isAllowedOrigin(hostname);
  } catch {
    return false;
  }
};

// ============================================================================
// 2. API APP (Sub-aplicación con todas las rutas del dominio)
// ============================================================================

export const apiApp = new Elysia({ prefix: '/api', aot: false })
  .use(cors({
    origin: corsOriginValidator,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Requested-With', 'x-client-id', 'x-tenant-slug', 'x-original-host', 'Authorization', 'Accept', 'Origin'],
    credentials: true,
    preflight: true,
    maxAge: 86400,
  }))
  .model({
    error: t.Object({
      message: t.String(),
      details: t.Optional(t.String()),
    }),
  })
  .use(swagger({
    documentation: {
      info: {
        title: 'Zelys ERP API',
        version: '2.0.0',
        description: 'API empresarial con autenticación multi-tenant y RBAC',
      },
      tags: [
        { name: 'Auth', description: 'Autenticación y autorización' },
        { name: 'Clients', description: 'Clientes' },
        { name: 'Suppliers', description: 'Proveedores' },
        { name: 'Employees', description: 'Empleados y transportistas' },
        { name: 'Products', description: 'Catálogo de productos' },
        { name: 'Categories', description: 'Categorías de productos' },
        { name: 'Catalogs', description: 'Catálogos del sistema (UOM, Marcas, Atributos)' },
        { name: 'Inventory', description: 'Stock y movimientos' },
        { name: 'Work Orders', description: 'Órdenes de fabricación' },
        { name: 'Invoices', description: 'Facturación y pagos' },
        { name: 'Documents', description: 'Documentos electrónicos (SRI)' },
        { name: 'Materials', description: 'Solicitudes de materiales' },
        { name: 'BOM', description: 'Lista de materiales' },
      ],
    },
  }))
  .use(errorHandlerPlugin)
  .get('/health', () => ({ status: 'ok', ts: Date.now() }))

  // Better-Auth handler (Mapeo omni-método para autenticación)
  .all('/auth/*', ({ request }) => auth.handler(request))
  .all('/auth', ({ request }) => auth.handler(request))

  // Domain routes
  .use(tenantRoutes)
  .use(profileRoutes)
  .use(webhooksRoutes)
  .use(rbac)
  .use(ssePlugin)
  .use(rateLimit({
    max: env.NODE_ENV === 'production' ? 100 : 1000,
    windowMs: 60 * 1000,
    message: 'Demasiadas peticiones, intenta más tarde',
    skipIf: (request: Request) => request.url.includes('/swagger'),
  }))
  .use(clientRoutes)
  .use(supplierRoutes)
  .use(employeeRoutes)
  .use(productRoutes)
  .use(categoryRoutes)
  .use(attributeRoutes)
  .use(brandRoutes)
  .use(uomRoutes)
  .use(modulesRoutes)
  .use(rbacRoutes)
  .use(entityRoutes)
  .use(sriRoutes)
  .use(geonamesRoutes)
  .use(locationsRoutes)
  .use(toolLoansRoutes)
  .use(companyRoutes)
  .use(vehiclesRoutes)
  .use(warehousesRoutes)
  .use(staticPlugin({ assets: 'public', prefix: '/' }));

// ============================================================================
// 4. ROOT SERVER (Monta /api y sirve la SPA)
// ============================================================================

const app = new Elysia()
  .get('/health', () => ({ status: 'ok', ts: Date.now() }))
  .use(apiApp)
  .get('*', serveSpa);

app.listen({ port: env.PORT, hostname: '0.0.0.0' });

// Background workers
startAuditWorker();

(async () => {
  try {
    await initSSERedisAdapter();
    console.log('✅ Redis Pub/Sub initialized');
  } catch {
    console.warn('⚠️ Redis Pub/Sub unavailable. SSE broadcasting limited to this node.');
  }
})();

const serverAddress = `http://${app.server?.hostname}:${app.server?.port}`;
console.log(`
🚀 Zelys ERP Backend
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 API: ${serverAddress}/api
📚 Docs: ${serverAddress}/api/swagger
🔌 SSE: ${serverAddress}/api/sse
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

export type App = typeof apiApp;