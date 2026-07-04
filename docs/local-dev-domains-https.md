# Local dev domains with HTTPS

This setup serves:

- Frontend: `https://dev.appquilar.com`
- API: `https://dev.api.appquilar.com`

## Requirements

- Docker / docker-compose
- `mkcert`

Install mkcert on macOS:

```bash
brew install mkcert nss
```

## One-step (recommended)

From `appquilar/`:

```bash
make up
```

`make up` already runs setup automatically and then starts everything.

It will:

- installs local mkcert CA (if missing)
- tries to install `mkcert` with Homebrew when available
- creates cert/key in `docker/dev-domains/certs/`
- adds `/etc/hosts` entries automatically (asks sudo password if needed)
- starts API + FE + HTTPS proxy

## Start stack (manual)

From `appquilar/`:

```bash
make up
```

This starts:

- Backend stack (`../api/docker-compose.yml`)
- Frontend dev stack (`docker-compose.dev.yml`)
- Caddy HTTPS reverse proxy (`docker/dev-domains/docker-compose.yml`)

## Stop stack

```bash
make down
```

## Notes

- FE is still Vite dev mode behind Caddy.
- `VITE_API_BASE_URL` is forced to `https://dev.api.appquilar.com` in `make up`.
- Caddy config: `docker/dev-domains/Caddyfile`.

## Stripe in local

Use the local HTTPS domains for browser flows:

- Checkout / portal return URLs should point back to `https://dev.appquilar.com/...`
- The frontend should keep calling `https://dev.api.appquilar.com`

For webhooks, do not create a Stripe Dashboard webhook that points directly at this local stack. The local `dev.api.appquilar.com` certificate is generated with `mkcert`, so it is trusted only on your machine. Stripe's servers will not trust it.

Instead, forward Stripe events through Stripe CLI:

```bash
cd appquilar
make up
make stripe-check-account
make stripe-listen
```

`make stripe-listen` forwards the billing events Appquilar handles to:

```text
https://dev.api.appquilar.com/api/billing/webhook/stripe
```

The forwarded events include Checkout completion/expiration, subscription lifecycle updates, paid invoices, payment failures, and payments requiring customer action. The backend records processed Stripe event IDs, so repeated webhook deliveries are ignored after the first successful processing.

When Stripe CLI prints a webhook signing secret, copy it into a local backend override:

```bash
cp ../api/.env.local.example ../api/.env.local
```

Then edit `../api/.env.local` and set:

```dotenv
STRIPE_WEBHOOK_SECRET=whsec_...
```

If your API container is already running, restart it once after updating the secret:

```bash
docker-compose -f ../api/docker-compose.yml restart php
```

What you need to do:

1. Run `stripe login` once on your machine if Stripe CLI is not authenticated yet.
2. Run `make stripe-check-account` and confirm Stripe CLI is using `acct_1T1MQ2COjGpVsE06`.
3. Create `../api/.env.local` from the example and paste the local `whsec_...` secret there.
4. Keep `make stripe-listen` running in a second terminal while testing billing locally.

You only need a real Stripe Dashboard webhook endpoint when you want Stripe to hit a shared remote environment with a public, trusted TLS certificate.
