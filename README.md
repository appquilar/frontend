# Appquilar Frontend

This is the frontend for **Appquilar**, built with **React + Vite** and designed following **DDD (Domain-Driven Design)**, **Clean Architecture**, **CQS**, and a shared **Ubiquitous Language** with the backend (Symfony/PHP).

The project supports:

- **Local development with Vite + hot reload (HMR)**
- **Docker development environment**
- **Production builds served via Nginx**
- A modular, scalable architecture structured around **domain modules**

## Inventory model

The active product inventory contract has only two modes:

- `unmanaged`: the owner manages availability manually.
- `managed_serialized`: Appquilar manages uniquely identified units and their date availability.

`managed_bulk` is removed from the codebase and must not be used in UI, DTOs, mocks, or tests.
In the dashboard, serialized inventory lives in its own product tab so units and agenda are mounted only when the user opens `Inventario`.
Serialized units must refresh immediately after saving, allow inline code editing, and expose a human-friendly occupancy agenda per unit.

### Inventory endpoint map

Dashboard inventory only loads after the user opens the product `Inventario` tab. The active FE contract is:

- `GET /api/products/{product_id}/inventory`: operational summary for the tab, returned as `{ success: true, data: ProductInventorySummary }`.
- `GET /api/products/{product_id}/inventory/allocations`: agenda feed with `assigned_unit_ids`, returned as `{ success: true, data: InventoryAllocation[] }`.
- `GET /api/products/{product_id}/inventory/units`: internal serialized units list, returned as `{ success: true, data: InventoryUnit[] }`.
- `PATCH /api/products/{product_id}/inventory/units/{unit_id}`: inline unit code/status edits, returned as `{ success: true, data: InventoryUnit }`.
- `POST /api/products/{product_id}/inventory/adjustments`: sync operational quantity after saving the product.
- `GET /api/products/{product_id}/availability`: public date + quantity validation without exposing stock counts.

The product editor still saves general product data through `POST /api/products` and `PATCH /api/products/{product_id}`. If quantity changes, the FE then calls `inventory/adjustments` so Appquilar can create or retire serialized units until the stored unit list matches the requested total. A new serialized product will not show editable unit rows until that first save has created the persisted units in the backend.

## Product management endpoints

- `DELETE /api/products/{product_id}` permanently deletes a product from dashboard flows when it has no rents. If the backend returns `product.delete.has_rents`, the FE must keep the product and show an explanatory error.
- `GET /api/companies/{owner_id}/products` and `GET /api/users/{owner_id}/products` accept `publicationStatus` as a comma-separated multi-filter such as `draft,published`.
- Dashboard product listings default to `publicationStatus=draft,published`, so archived products stay hidden until the user explicitly includes them.


---

## 🧩 Architecture Principles

### 🟦 Domain Layer (`src/domain`)
Pure business logic:
- Domain models (`User`, `AuthSession`, `Address`, `Location`, `UserRole`)
- Value Objects
- Enums
- **Repository interfaces**

✔ No dependencies on React, infrastructure, or browser APIs.

---

### 🟧 Application Layer (`src/application`)
Implements **use cases**:
- AuthService: login, logout, registration, password management
- UserService: load profile, update user, update address
- Hooks exposing use cases to the UI (e.g. `useCurrentUser`)

✔ Depends ONLY on:
- domain models
- domain repositories

🚫 **No HTTP calls here**  
🚫 **No UI references**

---

### 🟩 Infrastructure Layer (`src/infrastructure`)
Implements real integrations:
- **ApiClient** (HTTP wrapper)
- **ApiAuthRepository**, **ApiUserRepository**
- DTO ↔ Domain mappers
- AuthSessionStorage (localStorage + JWT decoding)

✔ Depends on backend  
✔ Implements domain repository interfaces

🚫 Never imported by UI directly.

---

### 🟪 UI Layer (`src/components`, `src/pages`, `src/context`)
React components, pages, and contexts:
- Consumes **application services** through hooks or React Context
- Never touches infrastructure or HTTP
- Never decodes JWT directly

---

## 🚀 Development Workflow

### ▶️ Start in Docker (Hot Reload with Vite)

### Landing-only mode

If you want to show only the landing and hide the full platform:

```bash
make landing-build-sync
make dev-landing
```

Environment flags:

```bash
VITE_LANDING_ONLY_MODE=true
VITE_LANDING_ENTRY=/landing/index.html
```

When `VITE_LANDING_ONLY_MODE=true`, the platform app shell is not mounted and platform API endpoints are not called.

### Local domains with HTTPS

```bash
make up
```

In another terminal, forward Stripe webhooks locally:

```bash
make stripe-check-account
make stripe-listen
```

For the host-local API on `http://127.0.0.1:8000`, override the forward target:

```bash
STRIPE_FORWARD_TO=http://127.0.0.1:8000/api/billing/webhook/stripe make stripe-listen
```

After `stripe login` is already done, the local Stripe flow is:

1. Run `make up`.
2. Run `make stripe-check-account` and confirm it reports `acct_1T1MQ2COjGpVsE06`.
3. Run `make stripe-listen` in another terminal.
4. If the `whsec_...` shown by Stripe CLI is different from the one in the backend env, copy `/Users/victor/development/appquilar/api/.env.local.example` to `/Users/victor/development/appquilar/api/.env.local`, set `STRIPE_WEBHOOK_SECRET=whsec_...`, and restart the API container.

Example:

```bash
cp /Users/victor/development/appquilar/api/.env.local.example /Users/victor/development/appquilar/api/.env.local
docker-compose -f /Users/victor/development/appquilar/api/docker-compose.yml restart php
```

You do not need to create a new Stripe Dashboard webhook for local development. Keep `make stripe-listen` running while testing billing.
The local listener forwards the same billing event families handled by the API: Checkout completion/expiration, subscription lifecycle updates, paid invoices, payment failures, and payments requiring customer action.

Domains:

- `https://dev.appquilar.com` (frontend)
- `https://dev.api.appquilar.com` (backend API)

See `docs/local-dev-domains-https.md` for full setup details, including the local Stripe webhook flow.

## Dashboard E2E (Seeded)

Run seeded dashboard E2E suite:

```bash
make test-e2e-dashboard
```

Run one shard:

```bash
make test-e2e-dashboard-shard SHARD=1 TOTAL=4
```

Generate E2E coverage report:

```bash
make coverage-e2e
```

Coverage outputs:

- Scoped (targeted for E2E gate): `coverage-e2e/`
- Full (all instrumented FE files): `coverage-e2e-full/`
- Scope metadata (included/excluded files): `coverage-e2e/scope.json`

Generate tests from manual CSV matrix:

```bash
make e2e-dashboard-generate CSV="/Users/victor/Downloads/Testing manual Appquilar - Dashboard.csv"
```

You can run the suite without CSV. The generated tests are committed in code.

For full setup and CI details:

- `README.appquilar-frontend.md`
- `docs/e2e-dashboard-playwright.md`
