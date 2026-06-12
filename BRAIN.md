# 🧠 BRAIN.md — AI Context File

> **Purpose:** Single source of truth for AI assistants. Read this FIRST before any task.  
> **Last Updated:** 2026-06-11  
> **Runtime:** Bun · **Framework:** Elysia (backend) · SolidJS (frontend) · Astro (landing)

---

## 1. Project Overview

**ERP SaaS** — Full-stack enterprise resource planning system (Ecuador-focused).  
Monorepo using Bun workspaces. Fully typed end-to-end.

| Layer | Tech | Runtime |
|-------|------|---------|
| **Backend** | Elysia v1 + TypeBox | Bun |
| **Frontend** | SolidJS + TanStack (Router, Query, Form, Table, Virtual) | Vite |
| **Landing** | Astro 6.x (static, CSS puro) | Node |
| **Schema** | Drizzle ORM (shared package) | — |
| **DB** | PostgreSQL + Redis (SSE pub/sub) | — |
| **Styling** | TailwindCSS v4 + CSS custom properties (app) · CSS puro (landing) | — |
| **Validation** | TypeBox (backend) · Valibot (frontend) | — |
| **Linting** | Biome | — |
| **Language** | TypeScript (strict) | — |
| **UI Language** | Spanish (Ecuador) | — |

---

## 2. Monorepo Structure

```
app/
├── packages/
│   └── schema/src/          ← SHARED: tables, enums, DTOs, relations
│       ├── tables/          ← Drizzle pgTableV2 definitions (15 files)
│       ├── enums.ts         ← Single source of truth for all enum arrays
│       ├── backend.ts       ← TypeBox schemas (Elysia route validation)
│       ├── frontend.ts      ← Valibot schemas (TanStack Form validation)
│       ├── relations.ts     ← Drizzle relations (1-to-many, many-to-many)
│       ├── realtime-events.ts ← SSE event name constants
│       └── index.ts         ← Re-exports everything
│
├── backend/src/
│   ├── server.ts            ← Elysia app + plugin registration
│   ├── config/env.ts        ← Environment variables
│   ├── config/auth.ts       ← JWT + session config constants
│   ├── routes/              ← Elysia route handlers (25 files)
│   ├── services/            ← Business logic + DB queries (25 files)
│   │   ├── auth.service.ts      ← Login, register, verify, getMe, sessions
│   │   ├── spa-renderer.service.ts ← SPA serving + tenant branding SSR injection
│   │   └── tenant-provisioning.service.ts ← New company setup + seeding
│   ├── plugins/             ← Middleware (auth, RBAC, SSE, rate-limit, errors)
│   ├── seeds/               ← Database seeders
│   └── drizzle/             ← SQL migrations
│
├── frontend/src/
│   ├── app.tsx              ← SolidJS entry
│   ├── router.tsx           ← TanStack Router tree (root → layout → modules)
│   ├── index.css            ← TailwindCSS v4 theme (CSS custom properties)
│   ├── modules/             ← Feature modules (14 modules)
│   │   ├── auth/            ← Login, Register, VerifyEmail, branding store
│   │   └── ...              ← dashboard, products, suppliers, clients, etc.
│   ├── shared/              ← Shared code
│   │   ├── ui/              ← Design system (33 components)
│   │   ├── hooks/           ← Custom hooks (6)
│   │   ├── lib/             ← eden.ts, queryClient.ts, utils.ts
│   │   ├── store/           ← Global stores (SSE, broadcast, modules, layout)
│   │   ├── routes/          ← Route factory functions (6 files)
│   │   ├── forms/           ← Complex forms (EntityForm)
│   │   ├── selectors/       ← Reusable selector components (4)
│   │   ├── constants/       ← App-wide constants
│   │   └── utils/           ← Utility functions
│   ├── layout/              ← MainLayout + Sidebar
│   ├── contexts/            ← SolidJS contexts
│   └── public/
│       └── branding-fallback.js ← Externalized branding script (CSP safe)
│
├── web/                     ← LANDING PAGE (Astro 6.x, static)
│   ├── astro.config.mjs
│   ├── src/
│   │   ├── layouts/Base.astro
│   │   ├── pages/index.astro
│   │   ├── components/
│   │   │   ├── layout/      ← Header.astro, Footer.astro
│   │   │   └── sections/    ← Hero, Logos, Problem, Features, Invoicing,
│   │   │                       HowItWorks, Pricing, FAQ, CTA
│   │   └── styles/
│   │       ├── tokens.css   ← Design tokens (derived from Z logo palette)
│   │       ├── typography.css
│   │       └── global.css
│   └── public/              ← Static assets
│
├── Caddyfile                ← Reverse proxy + CSP headers (production)
└── docker-compose.yml
```

---

## 3. Type System — End-to-End

```
┌─────────────────────────────────────────────────────────────┐
│  packages/schema/src/tables/*.ts   (Drizzle pgTableV2)      │
│      ↓ drizzle-typebox                ↓ drizzle-valibot      │
│  packages/schema/src/backend.ts    packages/schema/src/      │
│  (TypeBox Static<T>)               frontend.ts (InferInput)  │
│      ↓                                ↓                      │
│  backend/routes/*.ts               frontend/forms/*.tsx       │
│  (Elysia body/query validation)    (TanStack Form + Valibot) │
│      ↓                                ↑                      │
│  backend/server.ts → export type App   │                     │
│      ↓                                 │                     │
│  frontend/lib/eden.ts                  │                     │
│  treaty<App>(...)  ←─── fully typed ───┘                     │
└─────────────────────────────────────────────────────────────┘
```

### Rules
- **Enums**: Always define as `const array` in `enums.ts`, never inline strings.
- **Backend validation**: TypeBox (`Type.Object()`) in `backend.ts`. Use `Type.Literal()` for enum members (generic helpers break Eden inference).
- **Frontend validation**: Valibot (`object()`, `pipe()`, `picklist()`) in `frontend.ts`.
- **DB schemas**: `drizzle-typebox` generates insert/select schemas for backend. `drizzle-valibot` for frontend.
- **Eden treaty**: `frontend/src/shared/lib/eden.ts` — auto-types from `App`. DO NOT manually type API responses.

---

## 4. Backend Patterns

### 4.1 Route Pattern (Elysia)
```ts
// backend/src/routes/example.routes.ts
export const exampleRoutes = new Elysia({ prefix: '/example' })
    .use(authGuard)           // JWT auth middleware
    .get('/', async ({ store }) => { ... }, {
        body: t.Object({ ... }),  // TypeBox validation
        detail: { tags: ['Example'] }
    })
```

**Registration:** Every route is `.use()`'d in `server.ts` under `/api` prefix.

### 4.2 Service Pattern
```ts
// backend/src/services/example.service.ts
import { db } from '../db';
import { eq } from '@app/schema';
import * as tables from '@app/schema/tables';
import { broadcast } from '../plugins/sse';

export const exampleService = {
    list: async () => db.select().from(tables.example),
    create: async (data) => {
        const [row] = await db.insert(tables.example).values(data).returning();
        broadcast('example:created', row);  // SSE broadcast
        return row;
    },
};
```

### 4.3 SSE / Real-Time
- **Backend**: `plugins/sse.ts` — Elysia plugin with Redis pub/sub adapter.
- **Frontend**: `store/sse.store.ts` — EventSource with auto-reconnect.
- **Cross-tab**: `store/broadcast.store.ts` — BroadcastChannel API.
- Events flow: `service.broadcast()` → Redis → SSE → `window.dispatchEvent()` → query invalidation.

### 4.4 Auth
- JWT in HttpOnly cookies (`credentials: 'include'`).
- `plugins/auth-guard.ts` — validates JWT, attaches `store.user`.
- `plugins/rbac.ts` — permission checking via `store.user.permissions`.
- Global 401 interceptor in `eden.ts` + `queryClient.ts`.
- `getMe()` returns `companySlug` (from `companies` table join) for frontend routing.
- `authVerificationTokens` intentionally does NOT use RLS (tokens must be verifiable pre-login).

### 4.5 Multi-Tenant Branding & SPA Rendering

The system serves a branded SPA for each tenant subdomain (`{slug}.zelys.app`).

**Architecture:**
```
1. Request → Caddy (reverse proxy) → Elysia backend
2. serveSpa() resolves tenant slug from Host header or ?slug= param
3. getTenantBySlug(slug) — shared helper with 2-minute TTL cache
4. SSR injects into index.html <head>:
   a. <style id="tenant-branding"> — CSS custom properties (colors, theme)
   b. <script id="tenant-data" type="application/json"> — branding JSON
   c. <link rel="manifest"> — dynamic PWA manifest from API
   d. <link rel="icon"> — tenant logo favicon
   e. <title> — dynamic page title
5. SolidJS hydrates branding from #tenant-data JSON on client side
```

**Key files:**
- `backend/src/services/spa-renderer.service.ts` — `serveSpa()`, `getTenantBySlug()`, `getRawHtml()`
- `frontend/src/modules/auth/store/branding.store.ts` — SolidJS branding store (hydrates from SSR JSON)
- `frontend/public/branding-fallback.js` — Pre-JS branding (reads localStorage, applies theme before SolidJS loads)
- `backend/src/routes/auth.routes.ts` — `/api/auth/tenant-info`, `/api/auth/tenant-manifest`

**CSP Policy (Caddyfile):**
- `script-src 'self'` — NO `unsafe-inline` (branding script externalized to `branding-fallback.js`)
- `style-src 'self' 'unsafe-inline'` — Required for SSR-injected `<style id="tenant-branding">`

**Theme presets:** Both `branding-fallback.js` and `spa-renderer.service.ts` share `THEME_PRESETS` (annotated with `@sync-with` comments). Presets generate `--bg-*`, `--surface-*`, `--card-*`, `--border-*` CSS vars from the tenant's secondary color.

---

## 5. Frontend Patterns

### 5.1 Module Structure
Each module follows:
```
modules/{name}/
├── {name}.routes.tsx    ← TanStack Router route definitions
├── views/               ← Page-level components
├── components/          ← Feature components
└── data/                ← Data layer
    ├── {name}.api.ts    ← Eden API wrappers + TypeScript interfaces
    ├── {name}.keys.ts   ← TanStack Query key factories
    ├── {name}.queries.ts  ← createQuery hooks
    └── {name}.mutations.ts ← createMutation hooks with cache invalidation
```

### 5.2 Data Layer (TanStack Query)

**Keys factory:**
```ts
export const brandKeys = {
    all: ['settings', 'brands'] as const,
    detail: (id: number) => [...brandKeys.all, 'detail', id] as const,
};
```

**Query hook:**
```ts
export function useBrandsList() {
    return createQuery(() => ({
        queryKey: brandKeys.all,
        queryFn: () => brandsApi.list() as Promise<BrandItem[]>,
        staleTime: 1000 * 60 * 30,
    }));
}
```

**Mutation hook:**
```ts
export function useCreateBrand() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (body) => brandsApi.create(body),
        onSettled: () => qc.invalidateQueries({ queryKey: brandKeys.all }),
    }));
}
```

**API wrapper:**
```ts
export const brandsApi = {
    list: async (): Promise<BrandItem[]> => {
        const { data, error } = await api.api.catalogs.brands.get();
        if (error) throw new Error(String(error.value));
        return data as BrandItem[];
    },
};
```

### 5.3 Routing (TanStack Router)

**Tree structure:**
```
rootRoute
├── authRoute (login)
└── layoutRoute (protected, loads sidebar)
    ├── indexRoute (redirects to /dashboard)
    ├── dashboardRoute
    ├── profileRoute
    ├── createUsersRoutes(layoutRoute)
    ├── createSettingsRoutes(layoutRoute) (focused on Warehouses)
    ├── createSuppliersRoutes(layoutRoute)
    ├── createClientsRoutes(layoutRoute)
    ├── createProductsRoutes(layoutRoute)
    ├── createCategoriesRoutes(layoutRoute)
    ├── createBrandsRoutes(layoutRoute)
    ├── createUomRoutes(layoutRoute)
    ├── createAttributesRoutes(layoutRoute)
    └── createLocationRoutes(layoutRoute)
```

**Route factory pattern (for modal routes):**
```ts
// shared/routes/settings.factory.tsx
export const createBrandModals = (parentRoute) => {
    const newRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: 'new',
        component: LazyBrandNewSheet,
    });
    const baseRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: '$brandId',
    });
    const editRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: 'edit',
        component: LazyBrandEditSheet,
    });
    return [newRoute, baseRoute.addChildren([editRoute])];
};
```

**Deep-linked modals:** Routes render inside `<Outlet />` in the parent list component. This enables URL-driven modal sheets without losing list context.

### 5.4 Forms (TanStack Form + Valibot)

**Standard form pattern:**
```tsx
import { createForm } from '@tanstack/solid-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { BrandFormSchema, type BrandFormData } from '@app/schema/frontend';
import { FormSubmissionContext } from '@shared/ui/form/form.types';
import TextField from '@shared/ui/TextField';

const form = createForm(() => ({
    defaultValues: { name: '', website: '' } as BrandFormData,
    validatorAdapter: valibotValidator(),
    validators: { onChange: BrandFormSchema, onSubmit: BrandFormSchema },
    onSubmit: async ({ value }) => { /* mutation */ },
}));

// In JSX:
<FormSubmissionContext.Provider value={hasAttemptedSubmit}>
  <form onSubmit={(e) => { e.preventDefault(); setHasAttemptedSubmit(true); form.handleSubmit(); }}>
    <form.Field name="name">
      {(field) => (
        <TextField.Root field={field()}>
          <TextField.Label>Nombre *</TextField.Label>
          <TextField.Input type="text" />
          <TextField.ErrorMessage />
        </TextField.Root>
      )}
    </form.Field>
  </form>
</FormSubmissionContext.Provider>
```

### 5.5 Sheet (Slide-over Modal) Pattern

```tsx
import Sheet from '@shared/ui/Sheet';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';

const MySheet = (props) => {
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    return (
        <Sheet
            bindDismiss={bindDismiss}
            isOpen={true}
            onClose={navigateAway}
            title="..."
            footer={<Button type="submit" form="my-form">Guardar</Button>}
        >
            <form id="my-form" ...>...</form>
        </Sheet>
    );
};
```

- `close()` — runs exit animation then navigates
- `navigateAway()` — navigates without animation (for overlay click / X button)
- `bindDismiss` — wires the Sheet's internal dismiss function

---

## 6. Design System

### 6.1 Theme (CSS Custom Properties)
```css
/* TailwindCSS v4 with @theme directive */
--color-bg, --color-surface, --color-card, --color-card-alt
--color-text, --color-heading, --color-muted
--color-border, --color-border-strong
--color-primary, --color-primary-strong, --color-primary-soft
--color-secondary, --color-secondary-strong
--color-info, --color-success, --color-warning, --color-danger, --color-destructive
--shadow-card, --shadow-card-soft
```
All colors use `light-dark()` for automatic dark mode. Reference via TailwindCSS: `bg-card`, `text-primary`, `border-border`, etc.

### 6.2 Core UI Components (`shared/ui/`)

| Component | Purpose | Notes |
|-----------|---------|-------|
| `TextField` | Text input (compound: Root/Label/Input/ErrorMessage/Description) | Integrates with TanStack Form via `field` prop |
| `Select` | Kobalte Select wrapper | Use for all dropdowns, replaces `<select>` |
| `Autocomplete` | Search-driven selector | Used for entities, cities, categories |
| `Button` | Action button | Supports `to` prop for Link of Tanstack router, `loading`, `icon` |
| `Sheet` | Slide-over panel | Route-driven modals |
| `DataTable` | TanStack Table wrapper | With column pinning, selection, sorting |
| `Badge` / `StatusBadge` | Status indicators | `isActive` prop for active/inactive |
| `SegmentedControl` | Tab-like selector | Kobalte-based |
| `Checkbox` / `Switch` | Toggle inputs | |
| `SkeletonLoader` | Loading placeholders | Types: `table-row`, `text`, `card` |
| `PageHeader` | Page title with icon + actions | |
| `ConfirmDialog` / `DeleteDialog` | Confirmation modals | |
| `Tabs` | Tab navigation | |
| `Tooltip` / `Popover` | Info overlays | |
| `FileUpload` | Drag & drop file upload | |
| `DropdownMenu` / `ActionMenu` | Context menus | |

### 6.3 Selectors (`shared/ui/selectors/`)

| Selector | Component | Data Source |
|----------|-----------|-------------|
| `CategorySelect` | Autocomplete | `useCategoriesFlat()` |
| `BrandSelect` | Autocomplete | `useBrandsList()` | `WarehouseSelect` | Autocomplete | `useWarehousesList()` |
| `UomSelect` | Kobalte Select | `useUomList()` — grouped by magnitude |

---

## 7. Settings Module Pattern

Settings has been focused and simplified to primarily manage `warehouses`. Former settings child components like `brands`, `uoms` (`uom`), `attributes` and `locations` have been refactored into fully standalone top-level modules (e.g. `/brands`, `/uom`, `/attributes`, `/locations`) to improve chunking, clean up routing trees, and support dedicated `DataTable` integration.

### 7.1 SettingsTable<T>
Generic table component for simple configuration lists (e.g., warehouses) to eliminate boilerplate.
```tsx
<SettingsTable<WarehouseItem>
    title="Bodegas"
    data={query.data}
    isLoading={query.isPending}
    columns={[{ key: 'name', label: 'Nombre', render: (item) => item.name }]}
    onRowClick={handleEdit}
    onToggleActive={handleToggle}
    getIsActive={(item) => item.is_active ?? true}
/>
```

### 7.2 Data Layer Pattern (per entity)
```
data/
├── {entity}.api.ts       ← interface + Eden wrappers
├── {entity}.keys.ts      ← query key factory
├── {entity}.queries.ts   ← useXxxList() hook
└── {entity}.mutations.ts ← useCreateXxx(), useUpdateXxx(), useDeactivateXxx()
```

---

## 8. Database Schema Domains

> **Multi-tenant:** All transactional tables include `company_id` FK to the root `companies` table.  
> **Timestamps:** All timestamps use `{ withTimezone: true, mode: "date" }` via the `TZ` constant from `utils.ts`.

| Domain | Tables File | Key Tables |
|--------|-------------|------------|
| Config | `config.ts` | `companies`, `sriEstablishments`, `sriCertificates`, `uom` |
| Catalogs | `catalogs.ts` | `brands`, `categories`, `attributeDefinitions`, `categoryAttributes` |
| SRI Lookup | `sri.ts` | `sriProduccion` (Ecuador RUC search database) |
| Auth | `auth.ts` | `authUsers`, `authRoles`, `authPermissions`, `authRolePermissions`, `authUserRoles`, `sessions`, `authMenuItems` |
| Entities | `entities.ts` | `entities`, `entityContacts`, `entityAddresses`, `employeeDetails`, `carrierVehicles`, `carrierDrivers` |
| Products | `products.ts` | `products`, `productVariants`, `productComponents`, `productUomConversions`, `variantPriceHistory` |
| Inventory | `inventory.ts`, `inventory_defaults.ts` | `warehouses`, `warehouseLocations`, `productVariantWarehouseLocations`, `inventoryStock` (with `quantity_reserved`), `inventoryDimensionalItems`, `inventoryMovements` |
| Documents | `documents.ts` | `electronicDocuments`, `invoices`, `creditNotes`, `debitNotes`, `purchaseLiquidations`, `withholdingReceipts`, `withholdingReceiptDetails`, `remissionGuides`, `invoiceItems`, `invoicePayments`, `taxRetentions`, `documentSequences` |
| Manufacturing | `manufacturing.ts` | `workOrders`, `workOrderItems`, `manufacturingOrders`, `manufacturingOrderInputs`, `manufacturingLog`, `employeeWorkSchedules`, `bomTemplates`, `bomTemplateDetails`, `bomHeaders`, `bomDetails` |
| Suppliers | `suppliers.ts` | `supplierProducts`, `purchaseOrders`, `purchaseOrderItems`, `goodsReceipts`, `goodsReceiptItems` |
| POS | `pos.ts` | `cashRegisters`, `posSessions`, `posSales`, `posSalePayments`, `posSaleItems` |
| Requests | `requests.ts` | `requestTemplates`, `materialRequests`, `materialRequestItems`, `materialRequestDispatches`, `requestReturns`, `requestReturnItems` |
| Finance | `finance.ts` | `accountsReceivable`, `accountsPayable`, `fiscalPeriods`, `purchaseQuotes`, `purchaseQuoteItems` |
| Visits | `visits.ts` | `technicalVisits`, `quotations`, `quotationItems` |
| Audit | `audit.ts` | `auditLogs`, `auditQueue` |

### Key Relationships
- **Multi-tenant root**: `companies` → all transactional entities via `company_id`.
- **Entity model**: Unified `entities` table with `is_client`, `is_supplier`, `is_employee`, `is_carrier` flags.
- **Product model**: `products` → `productVariants` (1:many). Each variant = 1 SKU. `variantPriceHistory` tracks price changes via DB trigger.
- **Inventory**: `warehouses` → `warehouseLocations` (hierarchical via `ltree` for `path`, with automatic database trigger-based reparenting cascades). Stock is prohibited in abstract `VIEW` locations by DB triggers. Defaults are warehouse-specific via `productVariantWarehouseLocations`.
- **Movements**: Perfect double-entry bookkeeping with mandatory (`notNull()`) `source_location_id` / `destination_location_id`. Utilizes system-level virtual locations (`SUPPLIER`, `CUSTOMER`, `ADJUSTMENT`, `PRODUCTION`) automatically seeded during tenant provisioning.
- **SRI Documents**: `electronicDocuments` (parent) → child tables per type: `invoices`, `creditNotes`, `debitNotes`, `purchaseLiquidations`, `withholdingReceipts`, `remissionGuides`.
- **Note on Product Families**: The `productFamilies` table has been deprecated/removed from schemas and backend services. Product classifications are handled directly via Category structure and custom Attributes.

---

## 9. Key Conventions

### Naming
- **Files**: `kebab-case` (routes, services, plugins). `PascalCase.tsx` (components).
- **DB columns**: `snake_case`.
- **TS interfaces**: `PascalCase` (e.g., `BrandItem`, `WarehouseFormData`).
- **Query keys**: `['module', 'entity']` hierarchy.
- **Route paths**: `/module/entity/$entityId/action`.

### Import Aliases
```
@app/schema       → packages/schema/src
@shared           → frontend/src/shared
@modules          → frontend/src/modules
@backend          → backend/src
```

### Error Handling
- **Backend**: `throwApiError()` wraps Eden errors. Custom `AppError` class in `services/errors.ts`.
- **Frontend**: `throwApiError()` in `shared/utils/api-errors.ts`. Toast notifications via `solid-sonner`.

### State Management
- **Server state**: TanStack Query (no manual caching).
- **Auth state**: SolidJS signals in `auth/store/auth.store.ts`.
- **UI state**: SolidJS `createSignal` / `createStore` locally in components.
- **Global stores**: `shared/store/` — SSE, broadcast, modules, layout.

### Soft Delete Pattern
All settings entities use `is_active` boolean (default `true`). Never physically delete. Use `deactivate` / `restore` mutations.

---

## 10. Real-Time Architecture

```
Backend Service
    ↓ broadcast(event, data)
SSE Plugin (Redis pub/sub)
    ↓ EventSource
Frontend sse.store.ts
    ↓ window.dispatchEvent(CustomEvent)
useDataTableSSE hook
    ↓ queryClient.invalidateQueries()
UI reactively updates
```

### Cross-Tab Sync
```
Tab A mutation → broadcast.emit('type', data)
    ↓ BroadcastChannel
Tab B → broadcast.on('type', handler) → re-fetch
```

---

## 11. Development Quick Reference

| Action | Command |
|--------|---------|
| Start backend | `cd backend && bun run dev` |
| Start frontend | `cd frontend && bun run dev` |
| DB migrate | `cd backend && bun run migrate` |
| DB seed | `cd backend && bun run seed` |
| Generate migration | `cd backend && bunx drizzle-kit generate` |
| Lint | `bun run lint` (root) |
| Format | `bun run format` (root) |

### Ports
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/api/swagger`
- SSE: `http://localhost:3000/api/sse`

### Docker
- `Dockerfile.backend` — Bun runtime
- `Dockerfile.frontend` — Vite build → Caddy serve
- `Caddyfile` — Reverse proxy + CSP headers

### Domains (Production)
- `zelys.app` — Landing page (Astro static)
- `in.zelys.app` — Default login/register entry point
- `{slug}.zelys.app` — Tenant-branded SPA (wildcard DNS `*.zelys.app`)
- `api.zelys.app` — Backend API

---

## 11.5 Landing Page (Astro)

Static marketing site at `web/` built with Astro 6.x and pure CSS (no Tailwind).

**Design system:** Palette derived from the Zelys Z logo (navy #0C1728 → cyan #00C0E8 → mint #00E8CC). Tokens in `web/src/styles/tokens.css`.

**Sections:** Hero (with CSS dashboard mockup), Business Types (infinite scroll), Problem (3 pain cards), Features (CSS-only tabs for 6 modules), Invoicing (animated flow diagram), How It Works (4 steps), Pricing ($15/$35/Enterprise), FAQ (details/summary), CTA.

**Fonts:** Plus Jakarta Sans (display), Inter (body), JetBrains Mono (stats/mono).

**Key URLs in landing:**
- Register: `https://in.zelys.app/register`
- Login: `https://in.zelys.app`
- Support: `soporte@zelys.app`

---

## 12. Adding a New Settings Entity (Checklist)

1. **Schema**: Add `pgTableV2` in `packages/schema/src/tables/config.ts` (or relevant domain file)
2. **Enums**: If needed, add const array in `enums.ts`
3. **Backend schemas**: Add TypeBox schema in `backend.ts`
4. **Frontend schemas**: Add Valibot schema + `type XxxFormData` in `frontend.ts`
5. **Relations**: Add to `relations.ts`
6. **Migration**: `bunx drizzle-kit generate` → review SQL → `bun run migrate`
7. **Backend service**: Create `services/xxx.service.ts`
8. **Backend routes**: Create `routes/xxx.routes.ts`, register in `server.ts`
9. **Frontend data layer**: Create `data/xxx.api.ts`, `xxx.keys.ts`, `xxx.queries.ts`, `xxx.mutations.ts`
10. **Frontend components**: Create `XxxList.tsx` (using `SettingsTable<T>`), `XxxNewSheet.tsx`, `XxxEditSheet.tsx`
11. **Route factory**: Add `createXxxModals()` in `settings.factory.tsx`
12. **Routes**: Register in `settings.routes.tsx` with `addChildren()`
13. **SettingsPage**: Add entry to `SECTIONS[]` array (with `newAction` + `newLabel`)
14. **Selector** (optional): Create `XxxSelect.tsx` in `shared/ui/selectors/`, export from `index.ts`

---

## 13. Adding a New Module (Checklist)

1. Create `frontend/src/modules/{name}/`
2. Add `{name}.routes.tsx` with `createXxxRoutes(layoutRoute)` factory
3. Register in `router.tsx` inside `layoutRoute.addChildren([])`
4. Create `views/`, `components/`, `data/` subdirectories
5. Add backend route + service if needed
6. Add sidebar entry in `modules.store.ts` / backend `menu.service.ts`

---

## 14. Common Pitfalls

| Pitfall | Solution |
|---------|----------|
| Eden types collapse to `never` | Use `Type.Literal()` for enums in TypeBox, not generic helpers |
| `<select>` native HTML | Always use `Select` from `@shared/ui/Select` (Kobalte) |
| Manual `createSignal` for form state | Use `createForm()` + `valibotValidator()` + schema from `frontend.ts` |
| Inline Sheet in list component | Use route-based Sheet with `<Outlet />` pattern |
| Hardcoded labels in SettingsPage | Add `newLabel` to `SECTIONS[]` array — auto-derived |
| `query.data` type assertion | Cast via `as XxxItem[]` at usage site or in queryFn return |
| Number inputs from `<input type="number">` | `TextField.Input type="number"` auto-coerces via `context.onChange()` |

---

## 15. DataTable Pattern (TanStack Table + Virtual)

Full-featured table used for CRUD list pages (Suppliers, Clients, Products, Users).

### 15.1 Architecture
```
useDataTable hook (state: page, search, sorting, selection, cursor)
      ↓ provides state to
DataTable component (TanStack Table + TanStack Virtual)
      ↑ feeds data from
TanStack Query (server-side pagination, sorting, filtering)
      ↑ invalidated by
useDataTableSSE hook (SSE room subscription → smart cache update)
```

### 15.2 useDataTable Hook
Manages all table state centrally:
```ts
const dt = useDataTable<SupplierRow>({
    data: () => query.data?.data ?? [],
    meta: () => query.data?.meta,
    isCursorBased: true,
});
```

Returns: `search`, `page`, `pageSize`, `cursor`, `direction`, `sorting`, `rowSelection`, `columnPinning`, `columnVisibility`, `sortBy`, `sortOrder`, `selectedItems`, `handleSearchInput`, `handleNextPage`, etc.

### 15.3 DataTable Component Props
```tsx
<DataTable<TData>
    data={items()}
    columns={columns}
    isLoading={query.isPending}
    isPlaceholderData={query.isPlaceholderData}
    // Server-side pagination
    pagination={{ pageIndex: dt.page() - 1, pageSize: dt.pageSize() }}
    onPaginationChange={...}
    pageCount={meta()?.pageCount ?? 1}
    totalRows={dt.totalRows()}
    // Optional cursor pagination
    cursorPagination={{
        hasNextPage: dt.hasNextPage(),
        hasPrevPage: dt.hasPrevPage(),
        onNextPage: dt.handleNextPage,
        onPrevPage: dt.handlePrevPage,
        onFirstPage: dt.handleFirstPage,
    }}
    // Selection
    enableRowSelection
    rowSelection={dt.rowSelection()}
    onRowSelectionChange={dt.setRowSelection}
    // Column pinning
    enableColumnPinning
    columnPinning={dt.columnPinning()}
    // Virtualization
    enableVirtualization
    estimatedRowHeight={52}
    // Row interactions
    onRowClick={handleRowClick}
    getRowId={(row) => String(row.id)}
/>
```

### 15.4 useDataTableSSE — Real-time Cache Updates
```ts
useDataTableSSE<SupplierRow>({
    room: 'suppliers',           // SSE room to subscribe to
    queryKey: supplierKeys.lists(), // TanStack Query key to invalidate
});
```

Behavior:
- **CREATED**: Invalidates first-page queries only
- **UPDATED**: Direct cache update via `setQueryData` (no refetch). Handles active/inactive filter edge cases.
- **DELETED**: Removes items from cache via `removeCacheItems`
- **Own mutations skipped**: Uses `clientId` to avoid double-processing

### 15.5 Column Definition Pattern
```ts
const columns: ColumnDef<SupplierRow>[] = [
    {
        id: 'select',
        size: 40,
        header: ({ table }) => <Checkbox ... />,
        cell: ({ row }) => <Checkbox ... />,
    },
    {
        accessorKey: 'business_name',
        header: 'Razón Social',
        cell: ({ row }) => <span>{row.original.business_name}</span>,
        size: 200,
    },
    {
        id: 'actions',
        size: 80,
        header: '',
        cell: ({ row }) => <ActionMenu items={[...]} />,
    },
];
```

---

## 16. RBAC System

### 16.1 Permission Model
```
PermissionSlug = `${RbacModule}.${RbacAction}`
Examples: 'suppliers.create', 'invoices.read', 'users.delete'
```

**Modules**: `dashboard`, `crm`, `clients`, `visits`, `budgets`, `invoices`, `products`, `services`, `categories`, `brands`, `uom`, `attributes`, `inventory`, `movements`, `orders`, `locations`, `reception_materials`, `remission_guides`, `operations`, `work_orders`, `schedule`, `projects`, `production`, `planning`, `bom`, `dispatch_requests`, `materials`, `quality`, `suppliers`, `purchase_quotes`, `purchase_orders`, `purchase_invoices`, `retentions`, `pos_sell`, `pos_sessions`, `pos_history`, `documents`, `receivable`, `payable`, `hr`, `payroll`, `schedules`, `hours`, `system`, `config`, `users`, `audit`, `roles`, `permissions`, `manufacturing`, `pos`, `menu`, `companies`, `stock_taking`

**Actions** (10): `read`, `create`, `update`, `delete`, `restore`, `destroy`, `export`, `import`, `assign`, `unassign`

### 16.2 System Roles
```ts
SYSTEM_ROLES = { SUPERADMIN: 'superadmin', ADMIN: 'admin' }
```
- `superadmin` — bypasses ALL permission checks
- `admin` — must have explicit permissions assigned
- Custom roles — checked against `currentPermissions[]`

### 16.3 Backend Usage
```ts
// In route definition:
.get('/sensitive', handler, { permission: 'suppliers.read' as PermissionSlug })
```
The `rbac` plugin macro resolves `currentRoles` and `currentPermissions` from `authGuard.derive()`.

### 16.4 Auth Flow (Multi-Tenant)
```
1. User visits {slug}.zelys.app → serveSpa() SSR-injects branding into index.html
2. branding-fallback.js applies theme before JS loads (from localStorage cache)
3. SolidJS branding.store hydrates from <script id="tenant-data"> JSON
4. Login → POST /api/auth/login { email, password }
   a. If user belongs to 1 company → returns { user, sessionId }
   b. If user belongs to N companies → returns { requiresTenantSelection, tenants[] }
   c. User selects tenant → POST /api/auth/select-tenant { tenantId }
5. JWT set in HttpOnly cookie (credentials: 'include')
6. getMe() returns user + roles + permissions + companySlug
7. Frontend redirects to {companySlug}.zelys.app if not already on correct subdomain
8. authGuard.derive() validates cookie → resolves user + roles + permissions per request
9. 401 interceptor in eden.ts + queryClient.ts → auto-redirect to /login
10. Rolling sessions: cookie expiry auto-extended on activity
```

**Frontend auth module structure:**
```
modules/auth/
├── pages/Login.tsx       ← Multi-step: email → password → tenant select
├── pages/Register.tsx    ← Company registration with RUC
├── pages/VerifyEmail.tsx ← Email verification with typed search params
├── store/auth.store.ts   ← Auth signals (user, isAuthenticated, initSession)
├── store/branding.store.ts ← Tenant branding (hydrates from SSR JSON)
├── auth.routes.tsx       ← TanStack Router definitions
└── types/auth-error.ts   ← Typed auth error handling
```

---

## 17. Layout Architecture

```
┌──────────────────────────────────────────────────┐
│  MainLayout (flex h-screen)                       │
│  ┌─────────┐  ┌────────────────────────────────┐  │
│  │ Sidebar  │  │  <main> (flex-1, overflow)     │  │
│  │          │  │  ┌────────────────────────────┐│  │
│  │ • Logo   │  │  │  <Outlet />                ││  │
│  │ • Nav    │  │  │  (page content)            ││  │
│  │ • User   │  │  │                            ││  │
│  │          │  │  └────────────────────────────┘│  │
│  └─────────┘  └────────────────────────────────┘  │
│  MobileHeader (sm:hidden, absolute top)           │
└──────────────────────────────────────────────────┘
```

- **Sidebar**: Hidden on mobile, collapsible on desktop. Nav items from `modules.store`.
- **MobileHeader**: Hamburger + logo, only visible `< sm`.
- **LayoutSkeleton**: Pixel-perfect skeleton matching sidebar + content during route loading.
- **Page pattern**: Each page fills available height. Uses `PageHeader` + scrollable content area.

### Page Template
```tsx
const MyPage: Component = () => (
    <div class="h-full flex flex-col">
        <div class="flex-shrink-0 p-3 sm:p-4">
            <PageHeader icon={...} title="..." actions={<Button ... />} />
        </div>
        <div class="flex-1 min-h-0 overflow-y-auto px-3 pb-3 sm:px-4 sm:pb-4">
            {/* Content */}
        </div>
    </div>
);
```

---

## 18. EntityForm — Complex Form Reference

The `EntityForm` (`shared/forms/entity/EntityForm.tsx`, ~1065 LOC) is the most complex form in the app. It handles unified entity CRUD (clients, suppliers, employees, carriers) with:

- **TanStack Form + Valibot** validation (`EntityFormSchema`)
- **Dynamic sub-forms**: `AddressRow` (with GeoNames city autocomplete), `ContactRow`
- **Conditional sections**: Employee details shown only when `isEmployee` checked
- **Cross-field validation**: Tax ID format validated by type (Cédula=10 digits, RUC=13 digits, etc.)
- **Auto-derived fields**: `personType` changes when `taxIdType` changes

**Key pattern**: Uses `form.setFieldValue()` reactively in `createEffect()` for cross-field logic. Sub-forms use `form.Field name={\`addresses[${index}].city\`}` for nested array fields.

---

## 19. SSE Event System — Complete Reference

### 19.1 Event Names (`realtime-events.ts`)
```ts
RealtimeEvents = {
    ENTITY: { CREATED, UPDATED, DELETED },   // 'entity:created', etc.
    USER:   { CREATED, UPDATED, DELETED, PROFILE_UPDATED, SESSION_REVOKED, SESSION_CREATED },
    ROOMS:  { SUPPLIERS, CLIENTS, PRODUCTS, EMPLOYEES, CARRIERS, USERS },
}
```

### 19.2 Payload Shape
```ts
interface BaseEventPayload<TEntity> {
    id?: number;
    ids?: number[];
    entity?: TEntity;
    clientId?: string;  // sender's tab ID — used to skip own mutations
}
```

### 19.3 Backend Broadcasting
```ts
// In a service:
import { broadcast } from '../plugins/sse';
broadcast('entity:updated', {
    id: entity.id,
    entity: updatedEntity,
    clientId: requestClientId, // from x-client-id header
}, 'suppliers'); // room name
```

### 19.4 Frontend Subscription Flow
```
onMount → subscribe('suppliers')              // Join SSE room
       → window.addEventListener('entity:updated', handler)
onCleanup → unsubscribe('suppliers')          // Leave room
         → window.removeEventListener(...)
```

### 19.5 Cross-Tab Sync (`broadcast.store.ts`)
```ts
// Emit (sender tab):
broadcast.emit('auth:profile_update', { username: 'new' });

// Listen (all tabs including sender):
const cleanup = broadcast.on('auth:profile_update', (data) => {
    queryClient.invalidateQueries({ queryKey: ['profile'] });
});
// cleanup() to unsubscribe
```
Uses single `BroadcastChannel('app_sync')` for all events.

---

## 20. Drizzle Custom Types

### 20.1 ltree (PostgreSQL Hierarchical Path)
```ts
// packages/schema/src/tables/config.ts
import { customType } from 'drizzle-orm/pg-core';
export const ltree = customType<{ data: string }>({
    dataType: () => 'ltree',
});
```
Used in `warehouse_locations.path` for hierarchical tree queries: `SELECT * FROM warehouse_locations WHERE path <@ 'root.zone_a'`.

### 20.2 Table Definition Pattern
```ts
import { pgTableV2 } from './config';  // Wrapper around drizzle's pgTable

export const warehouses = pgTableV2("warehouses", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    is_active: boolean("is_active").default(true),
    // FK reference pattern:
    manager_id: integer("manager_id").references(() => entities.id),
});
```

### 20.3 Drizzle Schema Types (`types.ts`)
```ts
export type Product = InferSelectModel<typeof tables.products>;
export type NewProduct = InferInsertModel<typeof tables.products>;
```

---

## 21. Complete Enum Registry

All enums defined in `packages/schema/src/enums.ts` as `const` arrays with derived TypeScript types and `pgEnum` definitions.

| Category | Enum Name | Values |
|----------|-----------|--------|
| **Entity** | `TAX_ID_TYPES` | RUC, CEDULA, PASAPORTE, CONSUMIDOR_FINAL, EXTERIOR |
| | `TAX_ID_TYPES_FORM` | RUC, CEDULA, PASAPORTE, EXTERIOR |
| | `PERSON_TYPES` | NATURAL, JURIDICA |
| | `TAX_REGIME_TYPES` | RIMPE_NEGOCIO_POPULAR, RIMPE_EMPRENDEDOR, GENERAL |
| **Document** | `DOCUMENT_TYPES` | INVOICE, CREDIT_NOTE, DEBIT_NOTE, REMISSION_GUIDE, PURCHASE_LIQUIDATION, WITHHOLDING |
| | `INVOICE_STATUSES` | DRAFT, SIGNED, SENDING, AUTHORIZED, ANNULLED, REJECTED |
| | `QUOTATION_STATUSES` | DRAFT, SENT, APPROVED, REJECTED, CONVERTED_TO_WO |
| | `PAYMENT_STATUSES` | PENDING, PARTIAL, PAID, OVERDUE, WRITTEN_OFF |
| **Production** | `PRODUCTION_STATUSES` | PLANNED, IN_CUTTING, ASSEMBLY, COMPLETED, CANCELLED |
| | `WORK_ORDER_STATUSES` | DRAFT, APPROVED, IN_PROGRESS, COMPLETED, INVOICED |
| | `MATERIAL_REQUEST_STATUSES` | PENDING, APPROVED, IN_TRANSIT, RECEIVED, COMPLETED |
| **Inventory** | `LOCATION_TYPES` | VIEW, INTERNAL |
| | `CONDITIONS` | GOOD, DAMAGED, UNUSABLE |
| | `MOVEMENT_TYPES` | PURCHASE, SALE, PRODUCTION_CONSUMPTION, PRODUCTION_OUTPUT, ADJUSTMENT, TRANSFER_OUT, TRANSFER_IN |
| | `MOVEMENT_REFERENCE_TYPES` | INVOICE, PURCHASE_ORDER, MANUFACTURING_ORDER, MATERIAL_REQUEST, ADJUSTMENT, POS_SALE, RETURN |
| | `UOM_GROUPS` | VOLUMEN, LONGITUD, PESO, AREA, CANTIDAD, TIEMPO, DATA |
| **Product** | `PRODUCT_TYPES` | PRODUCTO, SERVICIO |
| | `PRODUCT_SUBTYPES` | SIMPLE, COMPUESTO, FABRICADO |
| | `ATTRIBUTE_DATA_TYPES` | TEXT, NUMBER, SELECT, BOOLEAN |
| | `IVA_RATE_CODES` | 0 (0%), 2 (12%), 3 (14%), 4 (15%), 6 (No objeto), 7 (Exento) — Ecuador SRI |
| **Purchase** | `PURCHASE_ORDER_STATUSES` | DRAFT, SENT, PARTIAL, RECEIVED, CANCELLED |
| | `PURCHASE_QUOTE_STATUSES` | DRAFT, SENT, APPROVED, REJECTED, CONVERTED_TO_PO |
| **Other** | `BOM_CALCULATION_TYPES` | FIXED, AREA, PERIMETER, VOLUMEN |
| | `TECHNICAL_VISIT_STATUSES` | SCHEDULED, COMPLETED, CANCELLED |
| | `POS_SESSION_STATUSES` | OPEN, CLOSED, RECONCILED |
| | `PAYMENT_METHODS_SRI` | 01, 15, 16, 17, 18, 19, 20, 21 |
| | `JUSTIFICATION_TYPES` | LIBRE, FALTA, IESS, VACACIONES, FERIADO, SAB, DOM |
| | `PRICE_CHANGE_TYPES` | COST, SALE |
| | `PRICE_CHANGE_SOURCES` | PURCHASE_ORDER, GOODS_RECEIPT, MANUAL, IMPORT |
| | `BUSINESS_TYPES` | COMERCIO, OPTICA, CLINICA, TURISMO, MANUFACTURA, CONSTRUCCION, IMPORTADORA |
| | `SAAS_PLANS` | free, starter, pro, enterprise |

---

## 22. Backend Service Patterns — Pagination

### 22.1 Cursor-Based Pagination (Default for large tables)
```ts
// Used by: suppliers, clients, products, users
const result = await db.select()
    .from(table)
    .where(and(...filters, cursorCondition))
    .orderBy(desc(table.id))
    .limit(limit + 1); // Fetch one extra to detect hasNextPage

const hasNextPage = result.length > limit;
if (hasNextPage) result.pop();

return {
    data: result,
    meta: { total, hasNextPage, hasPrevPage, nextCursor, prevCursor }
};
```

### 22.2 Simple List (Default for config entities)
```ts
// Used by: brands, uom, warehouses, categories
const result = await db.select().from(table).orderBy(table.name);
return result;
```

### 22.3 Audit Service (Background Worker)
```ts
// Audit logs are written asynchronously via a queue + worker
startAuditWorker(); // Called in server.ts at startup
// Table: audit_logs — PARTITIONED BY RANGE (created_at) for query performance
```
