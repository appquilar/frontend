# Appquilar Frontend

This is the frontend for Appquilar, built with React and Vite and structured using Domain-Driven Design (DDD), Clean Architecture, CQS, and a shared Ubiquitous Language with the Symfony backend.

The project supports:

- Local development with Vite (hot reload)
- Production-ready static builds
- Modular architecture based on domain modules

## Project Structure

The following tree is kept narrow on purpose so it renders cleanly in most viewers:

```
frontend/
  Makefile
  src/
    domain/
      models/           # User, AuthSession, Address, Location, UserRole, etc.
      repositories/     # Repository interfaces
    application/
      services/         # AuthService, UserService
      hooks/            # Application-level hooks
    infrastructure/
      http/             # ApiClient
      auth/             # AuthSessionStorage
      repositories/     # ApiAuthRepository, ApiUserRepository
    context/            # React context providers
    components/         # UI components
    pages/              # Routing and screens
  public/
  package.json
```

## Architecture Overview

## Inventory Modes

Product inventory has only two supported modes in the frontend contract:

- `unmanaged`: the provider confirms requests manually and the platform does not block stock.
- `managed_serialized`: the platform manages real serialized units with unique codes and date-based occupancy.

The removed `managed_bulk` mode is intentionally unsupported in the frontend and should not be reintroduced in DTOs, mocks, or UI fallbacks.
The serialized dashboard flow now lives behind the product `Inventario` tab so inventory queries and agenda UI mount only on demand.
It must show persisted units right after saving, allow inline code renaming, and render a unit-by-unit occupancy agenda that stays understandable on mobile.

### Inventory endpoint map

The frontend contract currently relies on these backend routes:

- `GET /api/products/{product_id}/inventory` for the dashboard summary card, wrapped as `{ success: true, data: ProductInventorySummary }`.
- `GET /api/products/{product_id}/inventory/allocations` for the serialized agenda/timeline, wrapped as `{ success: true, data: InventoryAllocation[] }`.
- `GET /api/products/{product_id}/inventory/units` for the persisted serialized units list, wrapped as `{ success: true, data: InventoryUnit[] }`.
- `PATCH /api/products/{product_id}/inventory/units/{unit_id}` for inline unit code/status edits, wrapped as `{ success: true, data: InventoryUnit }`.
- `POST /api/products/{product_id}/inventory/adjustments` to synchronize operational quantity after a product save.
- `GET /api/products/{product_id}/availability` for public and mobile date + quantity validation without leaking stock counts.

Important behavior:

- The product form only mounts inventory queries after the user opens the `Inventario` tab.
- Public product detail flows must never call inventory summary/units endpoints.
- Quantity changes are persisted through the product save flow and then synchronized through `inventory/adjustments`, which is what creates or retires serialized units in the backend.
- Newly created serialized products show the informational empty state until that first save has generated the persisted units. After saving, the inventory tab must reload the units list and agenda from those dashboard endpoints.

## Product management contract

- `DELETE /api/products/{product_id}` is the destructive dashboard action. The FE must not emulate deletion by archiving. When the backend answers with `product.delete.has_rents`, the UI should keep the product visible and explain why it cannot be deleted.
- `GET /api/companies/{owner_id}/products` and `GET /api/users/{owner_id}/products` support `publicationStatus` as a comma-separated list, for example `draft,published`.
- Dashboard product filters should boot with `draft,published` selected so archived products are excluded by default but can still be recovered through the multi-select filter.

### Domain Layer (`src/domain`)

Pure business and core concepts:

- Domain models
- Value objects
- Enums
- Repository interfaces

No dependencies on React, infrastructure, or browser APIs.

### Application Layer (`src/application`)

Implements use cases:

- AuthService
- UserService
- Application-level hooks

Depends only on:

- Domain models  
- Domain repository interfaces  

No HTTP calls here.

### Infrastructure Layer (`src/infrastructure`)

Implements external integrations:

- ApiClient
- ApiAuthRepository / ApiUserRepository
- DTO <-> Domain mappers
- AuthSessionStorage (localStorage + JWT decode)

Depends on backend and browser APIs, never on UI.

### UI Layer (`src/components`, `src/pages`, `src/context`)

React UI:

- Components
- Screens
- Context providers

Depends on application services and domain, never infrastructure.

## Development Workflow

### Run Vite locally without Docker

```
npm install
npm run dev
```

For the HTTPS local development stack, use the infrastructure repository.

## Makefile Commands

```
make install
make dev
make dev-landing
make landing-sync
make landing-build-sync
make build-landing
make clean
```

## Environment Variables (Vite)

Create `.env.local`:

```
VITE_API_BASE_URL=http://localhost:8000
VITE_USE_MOCK_DATA=false
VITE_LANDING_ONLY_MODE=false
VITE_LANDING_ENTRY=/landing/index.html
```

Access via:

```
import.meta.env.VITE_API_BASE_URL
```

## Landing-only Mode

Use this mode to show only the landing and completely hide the platform shell.

Behavior:

- If `VITE_LANDING_ONLY_MODE=true`, `src/main.tsx` does not mount `App`.
- The app redirects to `VITE_LANDING_ENTRY` (default: `/landing/index.html`).
- Because `App` is never mounted, platform repositories/hooks are not initialized and platform API endpoints are not called.

Landing sync commands:

```bash
# If landing dist already exists
make landing-sync

# Build landing first (from sibling folder) and then sync
make landing-build-sync
```

Run locally in landing-only mode:

```bash
make dev-landing
```

Build FE in landing-only mode:

```bash
make build-landing
```

Landing source discovery order used by the sync script:

1. `--landing-root=...`
2. `APPQUILAR_LANDING_ROOT`
3. `../appquilar-landing`
4. `../appquilar-landing1`

## Feature Development Checklist

1. Domain  
   - Add or update domain models or repository interfaces.

2. Infrastructure  
   - Map backend DTOs to domain models.  
   - Implement or extend repositories.

3. Application  
   - Add or extend services.  
   - Expose functionality via hooks.

4. UI  
   - Build components or pages.  
   - Use application hooks only.  
   - Do not call fetch or use storage directly.

## Design Goals

- Clear separation of concerns  
- Domain stability  
- Replaceable infrastructure  
- Testable architecture  
- Scalable for future contexts (Products, Rentals, Companies, Messaging, etc.)  

## Dashboard E2E Suite (Seeded)

Default commands already include the dashboard suite:

```bash
npm test
npm run test:e2e
make test
make test-e2e
```

Run only the public Playwright suite:

```bash
npm run test:e2e:public
```

In CI, Playwright runs in parallel contexts using `PLAYWRIGHT_WORKERS=2` for both the public suite and dashboard shards.

For deterministic dashboard E2E tests and manual QA with seeded data:

```bash
make test-e2e-dashboard
```

Run one shard (console):

```bash
make test-e2e-dashboard-shard SHARD=1 TOTAL=4
```

Run one shard (UI):

```bash
make test-e2e-dashboard-ui-shard SHARD=1 TOTAL=4
```

Generate E2E coverage report (app + dashboard suites):

```bash
make coverage-e2e
```

Coverage files:

- Scoped report (used for E2E target/gating):
  - `coverage-e2e/index.html`
  - `coverage-e2e/lcov.info`
  - `coverage-e2e/coverage-summary.json`
- Full report (complete visibility across instrumented FE files):
  - `coverage-e2e-full/index.html`
  - `coverage-e2e-full/lcov.info`
  - `coverage-e2e-full/coverage-summary.json`
- Scope metadata:
  - `coverage-e2e/scope.json`

Detailed setup and CSV import flow:

- `docs/e2e-dashboard-playwright.md`
- `docs/frontend-test-coverage-matrix.md`

### Import manual CSV cases

Generate/update the Playwright file from your manual dashboard matrix (optional, only when you want to re-sync external test docs):

```bash
make e2e-dashboard-generate CSV="/Users/victor/Downloads/Testing manual Appquilar - Dashboard.csv"
```

Generated file:

- `src/test/e2e/dashboard/generated/dashboard-cases.generated.spec.ts`

Important:
- The suite is already committed in code and CI runs it directly.
- You do NOT need the CSV/Excel to execute tests.
- CSV is only a maintenance input to regenerate when your manual matrix changes.

### Run manually with seeded backend

Terminal 1:

```bash
make e2e-seed-server
```

Terminal 2:

```bash
make dev-e2e-seed
```

Then open `http://127.0.0.1:4173`.

### FE pipeline integration

The frontend GitHub Actions pipeline includes the seeded dashboard suite in:

- `.github/workflows/frontend-tests.yml`

Parallel shard job:

- `Dashboard E2E Shard 1/4 ... 4/4`
