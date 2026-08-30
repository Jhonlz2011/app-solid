import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { staticPlugin } from '@elysiajs/static';

// Routes
import { auth, resolveTenantUrl, getTenantInfoForEmail, isAllowedOrigin } from './config/better-auth';
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
import { locationsRoutes } from './modules/inventory';
import { companyRoutes } from './modules/settings';
import { vehiclesRoutes } from './modules/settings';
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
// 2. LEGACY JWT EMAIL VERIFICATION — compatibilidad con enlaces previos
// ============================================================================

async function handleLegacyJwtVerification(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!token || !token.startsWith('eyJ')) return null;

  try {
    const { jwtVerify } = await import('jose');
    const secret = new TextEncoder().encode(env.BETTER_AUTH_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const email = payload.email as string | undefined;

    if (email) {
      const { adminDb } = await import('./core/db');
      const { authUsers: users } = await import('@app/schema/tables');
      const { eq } = await import('@app/schema');
      const { broadcast } = await import('./core/sse');
      const { RealtimeEvents } = await import('@app/schema/realtime-events');

      const [updatedUser] = await adminDb
        .update(users)
        .set({ emailVerified: true, updatedAt: new Date() })
        .where(eq(users.email, email.toLowerCase()))
        .returning({ id: users.id, email: users.email });

      if (updatedUser) {
        broadcast(RealtimeEvents.USER.EMAIL_VERIFIED, { userId: updatedUser.id }, `user:${updatedUser.id}`);

        if (request.headers.get('accept')?.includes('text/html')) {
          const { tenantSlug } = await getTenantInfoForEmail(updatedUser.email);
          const baseUrl = resolveTenantUrl(tenantSlug);
          return Response.redirect(`${baseUrl}/verify-email?verified=true`, 302);
        }

        return new Response(
          JSON.stringify({ status: true, user: { id: updatedUser.id, email: updatedUser.email } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
  } catch (err) {
    console.warn('[BetterAuth Fallback] Invalid legacy JWT token:', err);
  }

  return null;
}

// ============================================================================
// 3. API APP (Sub-aplicación con todas las rutas del dominio)
// ============================================================================

export const apiApp = new Elysia({ prefix: '/api', aot: false })
  .use(cors({
    origin: corsOriginValidator,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Requested-With', 'x-client-id', 'Authorization', 'Accept', 'Origin'],
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

  // Better-Auth handler (Mapeo explícito de métodos HTTP para precedencia sobre app.get('*'))
  .all('/auth/verify-email', async ({ request }) => {
    const legacyResponse = await handleLegacyJwtVerification(request);
    if (legacyResponse) return legacyResponse;
    return auth.handler(request);
  })
  .get('/auth/*', ({ request }) => auth.handler(request))
  .post('/auth/*', ({ request }) => auth.handler(request))
  .put('/auth/*', ({ request }) => auth.handler(request))
  .patch('/auth/*', ({ request }) => auth.handler(request))
  .delete('/auth/*', ({ request }) => auth.handler(request))
  .get('/auth', ({ request }) => auth.handler(request))
  .post('/auth', ({ request }) => auth.handler(request))

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
  .use(companyRoutes)
  .use(vehiclesRoutes)
  .use(staticPlugin({ assets: 'public', prefix: '/' }));

// ============================================================================
// 4. ROOT SERVER (Monta /api y sirve la SPA)
// ============================================================================

const app = new Elysia()
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