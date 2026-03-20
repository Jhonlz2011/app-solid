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
import { sriRoutes } from './routes/sri.routes';
import { geonamesRoutes } from './routes/geonames.routes';
import { electronicDocumentsRoutes } from './routes/electronic-documents.routes';
import { remissionGuidesRoutes } from './routes/remission-guides.routes';
import { technicalVisitsRoutes } from './routes/technical-visits.routes';
import { quotationRoutes } from './routes/quotations.routes';
import { employeeSchedulesRoutes } from './routes/employee-schedules.routes';
import { rbacRoutes } from './routes/rbac.routes';
import { entityRoutes } from './routes/entities.routes';

// Plugins
import { rateLimit } from './plugins/rate-limit';
import { ssePlugin } from './plugins/sse';
import { rbac } from './plugins/rbac';

// Services & Config
import { AuthError } from './services/auth.service';
import { DomainError } from './services/errors';
import { env } from './config/env';
import { initSSERedisAdapter } from './plugins/sse';

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

// PG column name → camelCase form field mapping
const PG_COLUMN_TO_FIELD: Record<string, string> = {
  tax_id: 'taxId',
  business_name: 'businessName',
  email_billing: 'emailBilling',
  trade_name: 'tradeName',
  tax_id_type: 'taxIdType',
  person_type: 'personType',
};

/** Extract field name from PG constraint detail string: "Key (tax_id)=(xxx) already exists" */
function extractConstraintField(detail?: string): string | null {
  if (!detail) return null;
  const match = detail.match(/Key \((\w+)\)/);
  if (!match) return null;
  return PG_COLUMN_TO_FIELD[match[1]] || match[1];
}

const app = new Elysia({ prefix: '/api', aot: false })
  // CORS Configuration - dynamic origin validation
  .use(cors({
    origin: (request) => {
      const origin = request.headers.get('origin');
      return origin ? allowedOrigins.has(origin) : false;
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
  // Global error handler — returns structured ApiErrorResponse
  .onError(({ code, error, set }) => {
    // 1. Auth errors (AuthError from auth.service)
    if (error instanceof AuthError) {
      set.status = error.code;
      return { code: 'UNAUTHORIZED', message: error.message };
    }

    // 2. Domain errors (DomainError with code + optional fieldErrors)
    if (error instanceof DomainError) {
      set.status = error.status;
      return {
        code: error.code,
        message: error.message,
        ...(error.fieldErrors.length > 0 ? { errors: error.fieldErrors } : {}),
      };
    }

    // 3. Route not found
    if (code === 'NOT_FOUND') {
      set.status = 404;
      return { code: 'NOT_FOUND', message: 'Ruta no encontrada' };
    }

    // 4. Elysia TypeBox validation errors — parse into per-field errors
    if (code === 'VALIDATION') {
      set.status = 400;
      const fieldErrors: { field: string; message: string }[] = [];

      try {
        // Elysia wraps validation errors; try parsing the message as JSON
        const parsed = JSON.parse(error.message);
        if (parsed?.type === 'validation') {
          const details = Array.isArray(parsed.errors) ? parsed.errors : [parsed];
          for (const detail of details) {
            const path = detail.path?.replace(/^\//, '').replace(/\//g, '.') || 'unknown';
            const msg = detail.message || detail.summary || 'Valor inválido';
            fieldErrors.push({ field: path, message: msg });
          }
        }
      } catch {
        // As fallback, parse the raw error message to extract field info
        // Elysia v1 format: "Expected ... at 'field'" or similar
        const rawMsg = error.message || 'Datos inválidos';
        fieldErrors.push({ field: 'form', message: rawMsg });
      }

      return {
        code: 'VALIDATION_ERROR',
        message: 'Datos inválidos',
        ...(fieldErrors.length > 0 ? { errors: fieldErrors } : {}),
      };
    }

    // 5. PostgreSQL / Drizzle DB errors (fallback — services should catch these first)
    const pgError = error as any;
    if (pgError?.code === '23505') {
      // Unique constraint violation
      set.status = 409;
      const field = extractConstraintField(pgError.detail);
      return {
        code: 'DUPLICATE_ENTRY',
        message: 'Ya existe un registro con estos datos',
        errors: field ? [{ field, message: 'Este valor ya está registrado' }] : [],
      };
    }
    if (pgError?.code === '23503') {
      // Foreign key violation
      set.status = 409;
      return {
        code: 'CONFLICT',
        message: 'No se puede completar la operación: existen registros relacionados',
      };
    }
    if (pgError?.code === '23502') {
      // Not-null violation
      set.status = 400;
      const column = pgError.column || 'unknown';
      return {
        code: 'VALIDATION_ERROR',
        message: `El campo '${column}' es obligatorio`,
        errors: [{ field: column, message: 'Este campo es obligatorio' }],
      };
    }

    console.error('Unhandled error:', error);
    set.status = 500;
    return { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' };
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
  .use(rbacRoutes)
  .use(entityRoutes)
  .use(sriRoutes)
  .use(geonamesRoutes)

// Server configuration with optional Unix Socket support
const serverConfig = {
  port: env.PORT,
  hostname: '0.0.0.0'
};


app.listen(serverConfig);

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
