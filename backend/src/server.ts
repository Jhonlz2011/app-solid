import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';

// Routes
import { authRoutes } from './routes/auth.routes';
import { productRoutes } from './routes/products.routes';
import { workOrderRoutes } from './routes/work-orders.routes';
import { clientRoutes } from './routes/clients.routes';
import { supplierRoutes } from './routes/suppliers.routes';
import { employeeRoutes } from './routes/employees.routes';
import { catalogRoutes } from './routes/catalogs.routes';
import { categoryRoutes } from './routes/categories.routes';
import { invoiceRoutes } from './routes/invoices.routes';
import { materialRoutes } from './routes/materials.routes';
import { bomRoutes } from './routes/bom.routes';
import { modulesRoutes } from './routes/modules.routes';
import { electronicDocumentsRoutes } from './routes/electronic-documents.routes';
import { remissionGuidesRoutes } from './routes/remission-guides.routes';
import { technicalVisitsRoutes } from './routes/technical-visits.routes';
import { quotationRoutes } from './routes/quotations.routes';
import { employeeSchedulesRoutes } from './routes/employee-schedules.routes';
import { rbacRoutes } from './routes/rbac.routes';

// Plugins
import { rateLimit } from './plugins/rate-limit';
import { wsPlugin } from './plugins/ws';
import { rbac } from './plugins/rbac';
import { jwtPlugin } from './plugins/jwt';

// Services & Config
import { AuthError } from './services/auth.service';
import { DomainError } from './services/errors';
import { env } from './config/env';
import { subscribeToChannel } from './config/redis';
import { broadcast } from './plugins/ws';

// Validate required environment variables
const REQUIRED_ENV = ['JWT_SECRET', 'FRONTEND_URL'] as const;
for (const envVar of REQUIRED_ENV) {
  if (!process.env[envVar]) {
    throw new Error(`Variable de entorno requerida: ${envVar}`);
  }
}

const allowedOrigins = new Set([
  env.FRONTEND_URL,
  'http://192.168.100.50:5173',
  'http://192.168.100.50:4173', // Vite preview server (production)
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173', // Vite preview server (production)
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:4173', // Vite preview server (production)
].filter(Boolean) as string[]);

const app = new Elysia({ prefix: '/api', aot: false })
  // CORS Configuration - dynamic origin validation
  .use(cors({
    origin: (request) => {
      const origin = request.headers.get('origin');
      return origin ? allowedOrigins.has(origin) : false;
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Authorization'],
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
      security: [{ BearerAuth: [] }],
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer'
          }
        }
      }
    }
  }))
  // Core plugins
  .use(jwtPlugin)
  .use(authRoutes)
  .use(rbac)
  .use(wsPlugin)
  // Rate limiting
  .use(rateLimit({
    max: env.NODE_ENV === 'production' ? 100 : 1000,
    windowMs: 60 * 1000,
    message: 'Demasiadas peticiones, intenta más tarde',
    skipIf: (request: Request) => request.url.includes('/swagger')
  }))
  // Global error handler
  .onError(({ code, error, set }) => {
    if (error instanceof AuthError) {
      set.status = error.code;
      return { message: error.message };
    }

    if (error instanceof DomainError) {
      set.status = error.status;
      return { message: error.message };
    }

    if (code === 'NOT_FOUND') {
      set.status = 404;
      return { message: 'Ruta no encontrada' };
    }

    if (code === 'VALIDATION') {
      set.status = 400;
      return {
        message: 'Datos inválidos',
        details: error.message
      };
    }

    console.error('Unhandled error:', error);
    set.status = 500;
    return { message: 'Error interno del servidor' };
  })
  // Domain routes
  .use(clientRoutes)
  .use(supplierRoutes)
  .use(employeeRoutes)
  .use(productRoutes)
  .use(categoryRoutes)
  .use(catalogRoutes)
  .use(workOrderRoutes)
  .use(invoiceRoutes)
  .use(materialRoutes)
  .use(bomRoutes)
  .use(modulesRoutes)
  .use(electronicDocumentsRoutes)
  .use(remissionGuidesRoutes)
  .use(technicalVisitsRoutes)
  .use(quotationRoutes)
  .use(employeeSchedulesRoutes)
  .use(rbacRoutes);

// Server configuration with optional Unix Socket support
const serverConfig = {
  port: env.PORT,
  hostname: '0.0.0.0'
};


app.listen(serverConfig);

// Redis Pub/Sub for real-time events
(async () => {
  try {
    // Subscribe to update channels
    const channels = [
      'updates:products',
      'updates:work_orders',
      'updates:invoices',
    ];

    for (const channel of channels) {
      await subscribeToChannel(channel, (message) => {
        try {
          const parsed = JSON.parse(message);
          broadcast(channel, parsed);
        } catch (e) {
          console.error(`Error parsing message from ${channel}:`, e);
        }
      });
    }

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
🔌 WebSocket: ws://${app.server?.hostname}:${app.server?.port}/api/ws
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

export type App = typeof app;
