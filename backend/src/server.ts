import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { staticPlugin } from '@elysiajs/static';
// Routes
import { auth } from './config/better-auth';
import { authRoutes } from './modules/auth';
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

const allowedOrigins = new Set([
  env.FRONTEND_URL,
  'https://zelys.app',
  'https://dev.zelys.app',
  'https://api.zelys.app',
  ...(env.NODE_ENV !== 'production' ? [
    'http://192.168.100.50:5173',
    'http://192.168.100.50:4173',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:4173',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:4173',
  ] : []),
].filter(Boolean) as string[]);

const baseDomain = (() => {
  if (env.COOKIE_DOMAIN) {
    return env.COOKIE_DOMAIN.replace(/^\./, '');
  }
  try {
    const hostname = new URL(env.FRONTEND_URL).hostname;
    if (hostname === 'localhost' || /^[0-9.]+$/.test(hostname)) {
      return null;
    }
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      return parts.slice(-2).join('.');
    }
    return null;
  } catch {
    return null;
  }
})();

// Strictly match https://[optional subdomains].baseDomain (e.g. *.zelys.app or zelys.app)
const corsRegex = baseDomain
  ? new RegExp(`^https?:\\/\\/([a-z0-9-]+\\.)*${baseDomain.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}(:\\d+)?$`, 'i')
  : null;

const apiApp = new Elysia({ prefix: '/api', aot: false })
  // CORS Configuration - dynamic origin validation
  .use(cors({
    origin: (request) => {
      const origin = request.headers.get('origin');
      if (!origin) return false;
      if (allowedOrigins.has(origin)) return true;

      // Securely validate origin with regex pattern
      if (corsRegex && corsRegex.test(origin)) {
        return true;
      }

      return false;
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Requested-With', 'x-client-id', 'Authorization', 'Accept', 'Origin'],
    credentials: true,
    preflight: true,
    maxAge: 86400
  }))
  // Error model for Swagger
  .model({
    error: t.Object({
      message: t.String(),
      details: t.Optional(t.String())
    })
  })
  // Swagger Documentation
  .use(swagger({
    documentation: {
      info: {
        title: 'ERP Services API',
        version: '2.0.0',
        description: 'API for service-oriented ERP with real-time updates'
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
    }
  }))
  // Global error handler — mounted BEFORE all routes to guarantee interception
  .use(errorHandlerPlugin)
  // Health check — público, antes de auth guard (usado por OfflineBanner PWA)
  .get('/health', () => ({ status: 'ok', ts: Date.now() }))
  // Domain Auth Routes (register, check-slug, tenant-info, manifest, me, profile, sessions)
  .use(authRoutes)
  // Better-Auth Core Handler (sign-in, sign-up, organization, sessions, passkeys, 2fa)
  .all('/auth', async ({ request }) => auth.handler(request))
  .all('/auth/*', async ({ request }) => auth.handler(request))
  .use(webhooksRoutes) // Webhooks van ANTES de rbac (no requieren autenticación)
  .use(rbac)
  .use(ssePlugin)
  // Rate limiting
  .use(rateLimit({
    max: env.NODE_ENV === 'production' ? 100 : 1000,
    windowMs: 60 * 1000,
    message: 'Demasiadas peticiones, intenta más tarde',
    skipIf: (request: Request) => request.url.includes('/swagger')
  }))
  // Domain routes
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

// Server configuration with optional Unix Socket support
const serverConfig = {
  port: env.PORT,
  hostname: '0.0.0.0'
};

const app = new Elysia()
  .use(apiApp)
  .get('*', serveSpa);

app.listen(serverConfig);

// Start Audit Worker in the background
startAuditWorker();

// Redis Pub/Sub — WebSocket adapter for real-time events
(async () => {
  try {
    await initSSERedisAdapter();
    console.log('✅ Redis Pub/Sub initialized');
  } catch (error) {
    console.warn('⚠️ Redis Pub/Sub unavailable. Real-time updates may be limited.');
  }
})();

// Startup message
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