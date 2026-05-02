# Replit Project Notes

## Overview
A pnpm monorepo containing **Duka POS** — a Point of Sale system for a Kenyan retail shop, with M-Pesa STK Push integration via Safaricom Daraja.

## Artifacts
- `artifacts/api-server` — Express + Drizzle backend at `/api`.
- `artifacts/pos` — React + Vite frontend at `/`. Persistent sidebar with Register, Products, Orders, Dashboard.
- `artifacts/mockup-sandbox` — Canvas component preview server.

## Domain model
All money is stored as **integer cents** (KES * 100) and rendered with `formatKES(cents)` as `KSh 1,250`.

### Tables (`lib/db/src/schema`)
- `products` — name, sku, description, priceCents, stock, category, imageUrl.
- `orders` — reference (`DUKA-<ts36>-<rnd>`), status (`pending|paid|cancelled|failed`), totalCents, paymentMethod (`mpesa|cash`), customer phone/name.
- `order_items` — orderId, productId, productName snapshot, quantity, unitPriceCents, lineTotalCents.
- `transactions` — provider (`mpesa|cash`), status (`pending|success|failed`), mpesaCheckoutRequestId/MerchantRequestId/ReceiptNumber, raw callback payload.

### Order lifecycle
- **Cash orders** are created with `status=paid` and decrement stock immediately (single DB transaction).
- **M-Pesa orders** are created with `status=pending`. The frontend then calls `POST /api/mpesa/stkpush` which records a pending transaction. When Daraja calls back at `POST /api/mpesa/callback`, the callback updates the transaction, marks the order paid, and decrements stock — all in one DB transaction. Insufficient stock causes the order to be rejected before insertion.

## API
OpenAPI spec at `lib/api-spec/openapi.yaml`. Routes:
- `GET/POST /api/products`, `GET/PATCH/DELETE /api/products/:id`
- `GET/POST /api/orders`, `GET /api/orders/:id`
- `GET /api/transactions`
- `POST /api/mpesa/stkpush`, `POST /api/mpesa/callback`
- `GET /api/dashboard/summary` (revenue, today, low stock, top products, last 14 days sales)

Generated client lives in `lib/api-client-react/src/generated`. The frontend imports hooks like `useListProducts`, `useCreateOrder`, `useMpesaStkPush`, `useGetDashboardSummary`.

## M-Pesa configuration
Required env vars (placeholders are set; replace with real Daraja credentials):
- `MPESA_ENVIRONMENT` — `sandbox` or `production`
- `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`
- `MPESA_SHORTCODE` (sandbox: `174379`)
- `MPESA_PASSKEY`
- `MPESA_CALLBACK_URL` — must be a public HTTPS URL pointing to `/api/mpesa/callback` of the deployed app

If any variable still contains the substring `REPLACE`, the M-Pesa endpoints return HTTP 400 with a helpful error so the rest of the app keeps working.

Phone numbers are normalized to `2547XXXXXXXX` / `2541XXXXXXXX` server-side.

## Frontend
Wouter router with `base={import.meta.env.BASE_URL.replace(/\/$/, "")}`. Cart lives in a React context (client-side only) and is persisted to the backend only via `useCreateOrder`. Receipt page polls `useGetOrder` until paid for M-Pesa flows.

## Auth & business identity
The app is gated behind a single-owner login. Sessions are cookie-based via `express-session` + `connect-pg-simple` (the `user_sessions` table is created on boot from `lib/auth.ts`). On startup `lib/seed.ts` ensures a default user **admin / admin** exists if the `users` table is empty — change it from the Settings page.

Public endpoints: `GET /api/healthz`, `GET /api/settings` (so the login screen can show the brand), `POST /api/mpesa/callback` (Daraja webhook), and the storage `GET /storage/objects/*` / `GET /storage/public-objects/*` readers. Everything else (`products`, `orders`, `transactions`, `dashboard`, `mpesa/stkpush`, storage upload URL, settings PATCH, credentials PATCH) requires `requireAuth`.

Auth routes (in `routes/auth.ts`): `GET /api/auth/me`, `POST /api/auth/login`, `POST /api/auth/logout`, `PATCH /api/auth/credentials` (current password + optional `newUsername`/`newPassword`). Settings live in a singleton row (id=1) in `settings` table — `GET /api/settings` returns `{ businessName, logoUrl }`, `PATCH /api/settings` updates them. Logo upload reuses the App Storage flow; the path is stored on `settings.logoUrl` and resolved through `BrandMark` (`/objects/...` → `/api/storage/objects/...`). The sidebar, mobile header and login screen all show the logo inside a rounded boundary next to the business name (with a fallback Store icon if no logo is set).

Frontend gate: `AuthProvider` (`useGetCurrentUser`) wraps the app inside `App.tsx`. `AuthGate` shows `<Login />` when not authenticated and the full layout otherwise. The Settings page (`/settings`) lets the owner edit business name, upload/replace/remove the logo, and change username and/or password.

## Product images
Products can have an image uploaded from the Add/Edit Product dialog. Images are stored in **App Storage** (Replit-managed GCS) via presigned-URL upload (`POST /api/storage/uploads/request-url`) and served back through `GET /api/storage/objects/<path>`. The `imageUrl` column stores either a normalized object path (`/objects/...`) or an arbitrary public URL — the frontend resolver in `src/pages/Products.tsx` (`resolveProductImageSrc`) prepends `/api/storage` for the former and passes through the latter. Both Register cards and the Products table display the image with a graceful fallback icon.

## Commands
- `pnpm run typecheck:libs` — rebuild composite TS project references after editing shared libs.
- `pnpm --filter @workspace/db run push` — sync Drizzle schema to Postgres.
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client + zod after editing the OpenAPI spec.
