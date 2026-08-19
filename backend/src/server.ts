import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { staticPlugin } from '@elysiajs/static';

// Routes
import { auth, resolveTenantUrl, getTenantInfoForEmail } from './config/better-auth';
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
import { rbacRoutes } from './modules/users';
import { uploadsRoutes } from './modules/storage';
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
// 1. CORS CONFIGURATION (Dynamic Regex for *.zelys.app & Localhost)
// ============================================================================

const corsOriginValidator = (request: Request): boolean => {
  const origin = request.headers.get('origin');
  if (!origin) return false;

  // Development: allow localhost, 127.0.0.1 and LAN IPs
  if (env.NODE_ENV !== 'production') {
    if (/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/.test(origin)) {
      return true;
    }
  }

  // Production / Staging: allow zelys.app and all *.zelys.app subdomains
  if (/^https:\/\/([a-z0-9-]+\.)*zelys\.app(:\d+)?$/i.test(origin)) {
    return true;
  }

  return origin === env.FRONTEND_URL;
};

// ============================================================================
// 2. LEGACY JWT VERIFICATION FALLBACK
// ============================================================================

async function handleLegacyJwtVerification(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  // Only intercept legacy JWT tokens starting with standard base64 'eyJ'
  if (!token || !token.startsWith('eyJ')) {
    return null;
  }

  try {
    const { decodeJwt } = await import('jose');
    const payload = decodeJwt(token);
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

        const acceptHeader = request.headers.get('accept') || '';
        if (acceptHeader.includes('text/html')) {
          const { tenantSlug } = await getTenantInfoForEmail(updatedUser.email);
          const baseUrl = resolveTenantUrl(tenantSlug);
          return Response.redirect(`${baseUrl}/verify-email?verified=true`, 302);
        }

        return new Response(JSON.stringify({ status: true, user: { id: updatedUser.id, email: updatedUser.email } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
  } catch (err) {
    console.warn('[BetterAuth Fallback] Invalid legacy JWT token:', err);
  }

  return null;
}

// ============================================================================
// 3. API ROUTER (/api)
// ============================================================================

const apiApp = new Elysia({ prefix: '/api', aot: false })
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
        title: 'ERP Services API',
        version: '2.0.0',
        description: 'API for service-oriented ERP with real-time updates',
      },
      tags: [
        { name: 'Auth', description: 'Authentication & Authorization' },
        { name: 'Clients', description: 'Client management' },
        { name: 'Suppliers', description: 'Supplier management' },
        { name: 'Employees', description: 'Employee & Carrier management' },
        { name: 'Products', description: 'Product catalog' },
        { name: 'Categories', description: 'Product categories' },
        { name: 'Catalogs', description: 'System catalogs (UOM, Brands, Attributes)' },
        { name: 'Inventory', description: 'Stock & Movements' },
        { name: 'Tools', description: 'Tool management & Loans' },
        { name: 'Work Orders', description: 'Manufacturing orders' },
        { name: 'Invoices', description: 'Billing & Payments' },
        { name: 'Documents', description: 'Electronic Documents (SRI)' },
        { name: 'RemissionGuides', description: 'Remission/Shipping Guides' },
        { name: 'Materials', description: 'Material requests' },
        { name: 'BOM', description: 'Bill of Materials' },
      ],
    },
  }))
  .use(errorHandlerPlugin)
  .get('/health', () => ({ status: 'ok', ts: Date.now() }))

  // Better-Auth Core Handler (mounted at /api/auth/*)
  .all('/auth/verify-email', async ({ request }) => {
    const legacyResponse = await handleLegacyJwtVerification(request);
    if (legacyResponse) return legacyResponse;
    return auth.handler(request);
  })
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
  .use(uploadsRoutes)
  .use(locationsRoutes)
  .use(companyRoutes)
  .use(vehiclesRoutes)
  .use(staticPlugin({ assets: 'public', prefix: '/' }));

// ============================================================================
// 4. ROOT SERVER (SPA + API)
// ============================================================================

const serverConfig = {
  port: env.PORT,
  hostname: '0.0.0.0',
};

const app = new Elysia()
  .use(apiApp)
  .get('*', serveSpa);

app.listen(serverConfig);

// Background workers
startAuditWorker();

(async () => {
  try {
    await initSSERedisAdapter();
    console.log('✅ Redis Pub/Sub initialized');
  } catch {
    console.warn('⚠️ Redis Pub/Sub unavailable. Real-time updates may be limited.');
  }
})();

const serverAddress = `http://${app.server?.hostname}:${app.server?.port}`;

console.log(`
🚀 ERP Backend Server Started
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Address: ${serverAddress}
📚 Swagger: ${serverAddress}/api/swagger
🔌 SSE: ${serverAddress}/api/sse
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

export type App = typeof app;