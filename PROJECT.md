# Project: Zelys App Integration Fixes

## Architecture
- Bun Monorepo with workspaces:
  - `packages/schema` (@app/schema): Shared Drizzle schemas, Valibot validators, type definitions.
  - `backend` (ElysiaJS on Bun): REST API, Drizzle ORM PostgreSQL database services, GeoNames proxy service.
  - `frontend` (SolidJS + Vite + TanStack Form + Kobalte UI): Single Page Application with Eden Treaty API client.
  - `Caddyfile`: Reverse proxy and CSP header configurations.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | SRI Business Name Autocomplete Autofill | `Autocomplete.tsx` and `SriBusinessNameSelect.tsx` state binding sync with `setFieldValue` | M1 | ORIGINAL_REQUEST R1 |
| 2 | Manual Free-Text Entry in Autocomplete | Preserve typing, cursor position, and clearOnBlur behavior in `Autocomplete.tsx` | M1 | ORIGINAL_REQUEST R1 |
| 3 | GeoNames CSP Policy Fix | Update `Caddyfile` CSP header (`connect-src` and `img-src`) to allow `https://zelys.app`, `https://*.zelys.app`, `https://secure.geonames.org`, `https://flagcdn.com` | M2 | ORIGINAL_REQUEST R2 |
| 4 | GeoNames Service HTTPS & Fallback | Update `geonames.service.ts` to use HTTPS endpoint and username fallback | M2 | ORIGINAL_REQUEST R2 |
| 5 | E2E Verification & Integration | Build and verify both fixes across frontend and backend | M3 | ORIGINAL_REQUEST R1 & R2 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Autocomplete Autofill State Sync | `frontend/src/shared/ui/Autocomplete.tsx`, `SriBusinessNameSelect.tsx` | none | DONE |
| 2 | M2: GeoNames CSP & API Accessibility | `Caddyfile`, `backend/src/services/geonames.service.ts`, `EntityAddressArray.tsx` | none | DONE |
| 3 | M3: E2E Integration & Verification | Monorepo build, linting, and acceptance criteria verification | M1, M2 | DONE |

## Interface Contracts
### Autocomplete ↔ Form State
- `<Autocomplete.Input value={props.value} onInputChange={...} />`
- `createEffect` syncs external `props.value` mutations to `<input ref={inputRef}>` DOM element value and dispatches standard DOM `'input'` event when `inputRef.value !== (props.value ?? '')`.
- `SriBusinessNameSelect.tsx` debounces `sriQuery` updates by 400ms on `props.value` changes.

### Frontend ↔ Backend GeoNames API & CSP
- Route: GET `/api/geonames/cities?q=...`
- Return type: Array of `{ ciudad: string, pais: string, codigo: string, bandera: string }`
- CSP Policy: `connect-src` and `img-src` permit `https://zelys.app`, `https://*.zelys.app`, `https://secure.geonames.org`, `https://flagcdn.com`.

## Code Layout
- `frontend/src/shared/ui/Autocomplete.tsx`
- `frontend/src/shared/ui/selectors/SriBusinessNameSelect.tsx`
- `frontend/src/shared/forms/entity/sections/EntityAddressArray.tsx`
- `backend/src/services/geonames.service.ts`
- `Caddyfile`
