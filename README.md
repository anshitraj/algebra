# Project Algebra

A security-first, non-custodial **agentic-commerce control plane**. An AI agent turns a user instruction ("get me Coke Zero and chips, keep it under ₹400") into a structured `PurchaseIntent`; Algebra is what safely turns that into discovery, policy evaluation, user approval, and merchant checkout — without ever handing the agent a card number, a CVV, a wallet private key, or an OTP.

> Core principle: give AI agents **permission to spend**, not **access to money**.

## Status

Phase 1 (Foundation) of the build mandate. See [BUILD_PLAN.md](BUILD_PLAN.md) for the full audit/plan and the completion report delivered alongside this build for what's real, sandboxed, mocked, or not yet implemented.

## Quick start

```bash
cp .env.example .env
openssl rand -base64 32   # → paste into .env as ALGEBRA_MASTER_KEY
make dev-up               # Postgres + Redis via Docker
go run ./cmd/api           # REST API on :8080 (migrations run automatically)
go run ./cmd/mcp           # MCP server on stdio
```

Full walkthrough, including bootstrapping a test user/agent: [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md).

Merchant options (Swiggy Instamart, Zepto, Amazon, Flipkart, Blinkit) and what each one needs: [docs/MERCHANT_CONNECTORS.md](docs/MERCHANT_CONNECTORS.md). Link a Zepto or Swiggy Instamart account — you sign in on the merchant's own page:

```bash
go run ./cmd/merchant-login -merchant zepto
```

```bash
make test               # unit tests, no external dependencies
make test-integration   # needs `make dev-up` — real Postgres, sandbox E2E flow
```

## Architecture at a glance

```
USER → AI AGENT → MCP (or REST) → Algebra
                                     ├── Intent          (PurchaseIntent + state machine)
                                     ├── Policy           (deterministic PolicyProvider — merchant/INR + crypto-rail rules; ALLOW/DENY/REQUIRE_APPROVAL)
                                     ├── Privacy          (alias → real value, only at merchant-execution time)
                                     ├── Merchant Router   (MerchantConnector: mock / Swiggy Instamart MCP / Zepto MCP / Amazon + Flipkart catalog APIs / Blinkit handoff)
                                     ├── Approval          (binds merchant+items+amount+payment source; expires)
                                     └── Payment Router    (PaymentSource → CardVaultProvider or non-custodial wallet)
                                     → Order + append-only Audit Trail
```

Full diagrams and the purchase-flow sequence: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Threat model: [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md).

## Repository layout

```
cmd/api, cmd/mcp     entrypoints — REST and MCP, sharing one wiring.Bundle
internal/domain      entities + interfaces, zero I/O, fully unit-tested
internal/app         application services — the ONE place business rules live
internal/platform    postgres, redis config, config, structured logging w/ redaction, wiring
internal/api/v1      REST transport (thin)
internal/mcpserver   MCP transport (thin) — tool surface documented in docs/MCP.md
connectors/*         MerchantConnector implementations — what each can really do: docs/MERCHANT_CONNECTORS.md
cmd/merchant-login   links a Zepto / Swiggy Instamart account via the merchant's own OAuth login
providers/*          CardVaultProvider / ConfidentialComputeProvider implementations
migrations/          versioned SQL — Postgres is authoritative for commerce state
docs/                architecture, threat model, MCP, payment security, privacy, connectors, deployment
```

## Documentation index

- [BUILD_PLAN.md](BUILD_PLAN.md) — repository audit, real/sandbox/mock/not-implemented labeling, phased plan
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md)
- [docs/MCP.md](docs/MCP.md)
- [docs/PAYMENT_SECURITY.md](docs/PAYMENT_SECURITY.md)
- [docs/PRIVACY.md](docs/PRIVACY.md)
- [docs/MERCHANT_CONNECTORS.md](docs/MERCHANT_CONNECTORS.md)
- [docs/GCP_DEPLOYMENT.md](docs/GCP_DEPLOYMENT.md)
- [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md)
- [openapi/v1.yaml](openapi/v1.yaml)

## What this is not (yet)

No Next.js console, no TypeScript SDK, no browser executor, no live-verified merchant checkout (the Swiggy Instamart Cash-on-Delivery path is built against Swiggy's published MCP contract but has not run against a real account here), no real card tokenization vendor, no OIDC login. Each of these is architected for (an interface exists, or a documented reason it's deferred) but not built in this session — see the completion report for the exact, current list and what each one needs to become real.
