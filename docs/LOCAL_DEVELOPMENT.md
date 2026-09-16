# Local Development

## Prerequisites

- Go 1.26+
- Docker (for Postgres + Redis via `docker-compose.yml`)
- `openssl` (or anything that can generate 32 random bytes + base64) for `ALGEBRA_MASTER_KEY`

## One-time setup

```bash
cp .env.example .env
openssl rand -base64 32   # paste the output into .env as ALGEBRA_MASTER_KEY
```

## Start dependencies

```bash
make dev-up      # docker compose up -d — Postgres on :5432, Redis on :6379
```

Migrations (`migrations/*.sql`) run automatically on first connect — see `internal/platform/postgres.Migrate`, called from `internal/platform/wiring.Build`. There is no separate "run migrations" step to remember.

## Run the API

```bash
set -a; source .env; set +a   # or use your shell's equivalent env-loading
go run ./cmd/api
```

## Run the MCP server

```bash
go run ./cmd/mcp                 # stdio transport (for a local agent/IDE)
go run ./cmd/mcp -http=:8081     # streamable HTTP transport
```

## Tests

```bash
make test               # unit tests — no external dependencies, always run
make test-integration   # needs `make dev-up` first; exercises real Postgres repos + the sandbox E2E flow
```

Tests that need Postgres check `DATABASE_URL`/`ALGEBRA_MASTER_KEY` at the top and call `t.Skip` if they're not set — `make test` alone never requires Docker.

## The `X-User-ID` header — READ THIS BEFORE RELYING ON IT

Several REST endpoints (`/api/v1/approvals/*/approve`, `/api/v1/payment-sources`, `/api/v1/profiles/*`) accept a plain `X-User-ID` header instead of a real authenticated session. **This is a development placeholder, not a security boundary.** Phase 1 has no OIDC/OAuth provider configured (that needs a real identity provider's client credentials — an external prerequisite this environment doesn't have; see mandate §46 and the completion report's "External prerequisites" list). Wiring up real user authentication is the very next thing that should happen before any of this runs anywhere other than a developer's own machine.

Agent-facing endpoints (everything under `/api/v1/intents`, `/api/v1/payment-sources` GET, MCP tools) use a *real* mechanism: a bearer token minted by `POST /api/v1/agents`, hashed and checked against `agents.token_hash` — see `internal/domain/agent` and `docs/MCP.md`'s "Agent identity" section. That part is not a placeholder.

## Bootstrapping a user + agent for manual testing

```bash
# 1. Create a user (dev-only bootstrap endpoint; no auth required here since
#    there's no session system yet to authenticate a signup against)
curl -X POST localhost:8080/api/v1/users \
  -H 'Content-Type: application/json' \
  -d '{"email":"dev@example.com"}'
# => {"user_id":"user_...","email":"dev@example.com"}

# 2. Create an agent for that user
curl -X POST localhost:8080/api/v1/agents \
  -H 'Content-Type: application/json' \
  -d '{"user_id":"user_...","client_id":"cli","name":"test-agent","permissions":["shopping.read","shopping.create_intent","shopping.execute","payments.request","orders.read","profiles.read","policy.read"]}'
# => {"agent_id":"agent_...","token":"alg_agent_..."}  — save the token, it is shown once
```

(A real deployment would create the `users` row through a real signup flow instead of this open endpoint; this build's `UserService`/`UserRepo` exist only so foreign keys have something to point at — see `internal/app/user_service.go`'s doc comment.)
