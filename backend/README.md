# Elysia with Bun runtime

## Getting Started
To get started with this template, simply paste this command into your terminal:
```bash
bun create elysia ./elysia-example
```

## Development
To start the development server run:
```bash
bun run dev
```

Open http://localhost:3000/ with your browser to see the result.

## Initial production bootstrap

Apply the reviewed Drizzle migrations first, using the deployment's one-off job or terminal. The seed does not generate or execute migrations. Run `bun run db:seed` only after the schema is current and the backend can reach PostgreSQL, Redis, and the configured mail provider.

Configure these values as temporary secrets/environment variables for the one-off seed job:

| Variable | Requirement |
| --- | --- |
| `BOOTSTRAP_COMPANY_SLUG` | Valid, non-reserved tenant slug. |
| `BOOTSTRAP_COMPANY_RUC` | Exactly 13 digits. |
| `BOOTSTRAP_COMPANY_BUSINESS_TYPE` | A value from `BUSINESS_TYPES` in `packages/schema/src/enums.ts`. |
| `BOOTSTRAP_COMPANY_NAME` | Legal/business name. |
| `BOOTSTRAP_COMPANY_TRADE_NAME` | Optional trade name. |
| `BOOTSTRAP_COMPANY_MAIN_ADDRESS` | Main address. |
| `BOOTSTRAP_ADMIN_EMAIL` | Email for the initial tenant owner. |
| `BOOTSTRAP_ADMIN_USERNAME` | 3–30 lowercase letters, digits, `_` or `-`. |
| `BOOTSTRAP_ADMIN_NAME` | Owner's display name. |
| `BOOTSTRAP_ADMIN_PASSWORD` | One-time secret, at least 16 characters; do not commit or log it. |
| `RESEND_API_KEY` | Required so the owner can complete mandatory email verification. |

The seed creates a free subscription; it never activates a paid plan from client/config input. It is transactional and safe to retry after an email delivery failure. It will not reset an existing password, claim an existing user as tenant owner, or relink an existing company to another organization. After success, remove `BOOTSTRAP_ADMIN_PASSWORD` and other bootstrap-only secrets from the deployment configuration. The owner must verify the email before using protected ERP features.

### PostgreSQL TLS

`DATABASE_SSL_MODE` is shared by the application, migrations, and seed; valid values are `require`, `verify-full`, and `disable`. Production defaults to `require`. Set `disable` only when PostgreSQL is reachable exclusively over a trusted private network and TLS is intentionally unavailable. `REF_DATABASE_SSL_MODE` and `ADMIN_DATABASE_SSL_MODE` may override the respective auxiliary connections; otherwise they inherit `DATABASE_SSL_MODE`.
