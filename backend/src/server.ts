import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { staticPlugin } from '@elysiajs/static';

// Routes
import { authRoutes } from './routes/auth.routes';
import { productRoutes } from './routes/products.routes';
import { clientRoutes } from './routes/clients.routes';
import { supplierRoutes } from './routes/suppliers.routes';
import { employeeRoutes } from './routes/employees.routes';
import { brandRoutes } from './routes/brands.routes';
import { uomRoutes } from './routes/uom.routes';
import { categoryRoutes } from './routes/categories.routes';
import { attributeRoutes } from './routes/attributes.routes';
import { invoiceRoutes } from './routes/invoices.routes';
import { materialRoutes } from './routes/materials.routes';
import { modulesRoutes } from './routes/modules.routes';
import { sriRoutes } from './routes/sri.routes';
import { geonamesRoutes } from './routes/geonames.routes';
import { electronicDocumentsRoutes } from './routes/electronic-documents.routes';
import { quotationRoutes } from './routes/quotations.routes';
import { employeeSchedulesRoutes } from './routes/employee-schedules.routes';
import { rbacRoutes } from './routes/rbac.routes';
import { entityRoutes } from './routes/entities.routes';
import { uploadsRoutes } from './routes/uploads.routes';
import { inventoryRoutes } from './routes/inventory.routes';
import { locationsRoutes } from './routes/locations.routes';
import { companyRoutes } from './routes/company.routes';

// Plugins
import { rateLimit } from './plugins/rate-limit';
import { ssePlugin } from './plugins/sse';
import { rbac } from './plugins/rbac';
import { errorHandlerPlugin } from './plugins/error-handler';

// Services & Config

import { env } from './config/env';
import { initSSERedisAdapter } from './plugins/sse';
import { startAuditWorker } from './services/audit.service';
import { serveSpa } from './services/spa-renderer.service';

const allowedOrigins = new Set([
  env.FRONTEND_URL,
  'http://192.168.100.50:5173',
  'http://192.168.100.50:4173',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:4173',
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
    allowedHeaders: ['Content-Type', 'X-Requested-With', 'x-client-id'],
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
  // Core plugins
  // Health check — público, antes de auth guard (usado por OfflineBanner PWA)
  .get('/health', () => ({ status: 'ok', ts: Date.now() }))
  .use(authRoutes)
  .use(rbac)
  .use(ssePlugin)
  // Rate limiting
  .use(rateLimit({
    max: env.NODE_ENV === 'production' ? 100 : 1000,
    windowMs: 60 * 1000,
    message: 'Demasiadas peticiones, intenta más tarde',
    skipIf: (request: Request) => request.url.includes('/swagger')
  }))
  // Global error handler
  .use(errorHandlerPlugin)
  // Domain routes
  .use(clientRoutes)
  .use(supplierRoutes)
  .use(employeeRoutes)
  .use(productRoutes)
  .use(categoryRoutes)
  .use(attributeRoutes)
  .use(brandRoutes)
  .use(uomRoutes)
  .use(invoiceRoutes)
  .use(materialRoutes)
  .use(modulesRoutes)
  .use(electronicDocumentsRoutes)
  .use(quotationRoutes)
  .use(employeeSchedulesRoutes)
  .use(rbacRoutes)
  .use(entityRoutes)
  .use(sriRoutes)
  .use(geonamesRoutes)
  .use(uploadsRoutes)
  .use(inventoryRoutes)
  .use(locationsRoutes)
  .use(companyRoutes)
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