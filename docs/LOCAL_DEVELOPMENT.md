# Local Development

## Prerequisites

- Go 1.26+
- Node 20+ and pnpm (for the web app in `web/`)
- A Postgres database — a hosted one (e.g. Neon) via `DATABASE_URL`, or `make dev-up` for Docker Postgres + Redis
- `openssl` (or anything that can generate 32 random bytes + base64) for `ALGEBRA_MASTER_KEY`

## One-time setup

```bash
cp .env.example .env
openssl rand -base64 32   # paste the output into .env as ALGEBRA_MASTER_KEY
cp web/.env.local.example web/.env.local   # add at least one LLM key for the agent
```

Migrations (`migrations/*.sql`) run automatically on first connect — see `internal/platform/postgres.Migrate`, called from `internal/platform/wiring.Build`. There is no separate "run migrations" step to remember.

## Run it

```bash
go run ./cmd/api                  # REST API on :8080
pnpm --dir web dev                # web app on :3000 — proxies /api/v1 to the API
```

Open http://localhost:3000, create an account, answer the four setup questions, and you land in the agent. The browser only ever talks to the web app's own origin; `web/next.config.ts` rewrites `/api/v1/*` to `ALGEBRA_API_URL` (default `http://localhost:8080`), so the API's HttpOnly session cookie is first-party.

To run a second copy of the web app from the same checkout (Next locks one dev server per build dir), set `NEXT_DIST_DIR=.next-alt` and a different port.

## Run the MCP server

```bash
go run ./cmd/mcp                 # stdio transport (for a local agent/IDE)
go run ./cmd/mcp -http=:8081     # streamable HTTP transport
```

## Tests

```bash
make test               # unit tests — no external dependencies, always run
make test-integration   # needs a reachable DATABASE_URL; exercises real Postgres repos + the sandbox E2E flow
```

Tests that need Postgres check `DATABASE_URL`/`ALGEBRA_MASTER_KEY` at the top and call `t.Skip` if they're not set — `make test` alone never requires a database.

## Accounts and sessions

People sign in to the web app with email + password (argon2id) or Google / GitHub OAuth (`internal/api/v1/auth.go`). A sign-in creates:

- an **HttpOnly, SameSite=Lax session cookie** (`algebra_session`, SHA-256-hashed at rest in `user_sessions`), and
- a **per-session console agent** — the identity every agent-scoped endpoint acts as when called with the cookie. Its token is sealed (AES-256-GCM) on the session row; the web app's server-side LLM loop fetches it via `POST /api/v1/auth/agent-token` so tool calls authenticate as the agent, never as the human.

Signing out revokes both. Human-only endpoints — approving or rejecting a purchase, adding payment methods or addresses, revoking agents, everything under `/api/v1/me` — accept **only** the session cookie. An agent bearer token is rejected there, which is what keeps approval out of any agent's reach, including our own LLM loop.

Google / GitHub buttons appear once their client IDs are set (see `.env.example` for the exact redirect URIs). Password-reset emails go through Resend when `RESEND_API_KEY` is set; otherwise the reset link is printed to the API's log — fine locally, never in production.

## Scripts without a browser

Mint an agent for an external MCP client from a signed-in session (`POST /api/v1/agents` with the cookie), or — for local scripts written before accounts existed — set `ALGEBRA_DEV_AUTH=true` to re-enable the old shortcuts:

```bash
# ALGEBRA_DEV_AUTH=true only. This lets any caller act as any user — never on a reachable host.
curl -X POST localhost:8080/api/v1/users -H 'Content-Type: application/json' -d '{"email":"dev@example.com"}'
curl -X POST localhost:8080/api/v1/agents -H 'Content-Type: application/json' \
  -d '{"user_id":"user_...","client_id":"cli","name":"test-agent","permissions":["shopping.read","shopping.create_intent","shopping.execute","payments.request","orders.read","profiles.read","policy.read"]}'
# Human-only endpoints then accept X-User-ID: user_...
```

Without that flag, `POST /api/v1/users` requires a tenant token and `POST /api/v1/agents` requires a session (for yourself) or a tenant token (for one of the tenant's own users).
