# Project Algebra

A security-first, non-custodial **agentic-payments infrastructure**. Card apps, wallets, fintechs, and stablecoin apps integrate Algebra so their own end users can grant AI agents controlled spending authority over payment sources the business already holds — without ever handing an agent a card number, a CVV, a wallet private key, or an OTP. The business keeps its customers, wallet, balance, and card infrastructure; Algebra adds agent identity, policy, delegated authorization, approval, execution, and audit around it. See [docs/B2B_INTEGRATION.md](docs/B2B_INTEGRATION.md).

The consumer-facing app in `web/` — sign up with Google, GitHub or email, a four-question setup that turns into real spending guardrails, and a streaming shopping agent — is Algebra's own reference implementation — proof the infrastructure works, built as a first-party "tenant" of the exact same public API/MCP surface an integrator uses, not a separate product.

> Core principle: give AI agents **permission to spend**, not **access to money**.

## Status

B2B agentic-payments infrastructure, Phase 1 (core primitives: tenants, persisted policy, `AgenticPaymentIntent`, a payment-provider interface with a deterministic demo rail, REST + MCP, outbound webhooks). See [BUILD_PLAN.md](BUILD_PLAN.md) for the original repository audit/plan and [docs/PROVIDER_STATUS.md](docs/PROVIDER_STATUS.md) for exactly which real/sandbox/mock/not-yet-implemented state every external integration is in today.

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
TENANT (card app / wallet / fintech) → owns → End Users → Agents
         │ Tenant token                                       │
         ▼                                                    ▼
   Policy (persisted, versioned)              AgenticPaymentIntent (merchant, amount, payment_source_alias)
         │                                                    │
         └──────────────────► ALLOW / DENY / REQUIRE_APPROVAL ┘
                                          │
                              paymentprovider.Provider (DemoProvider today — see docs/PROVIDER_STATUS.md)
                                          │
                                     Merchant + signed webhook back to Tenant
```

Algebra's own reference console (`web/`) runs the same shape without a Tenant (`PurchaseIntent` + discovery, for a consumer picking products by hand):

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

Full diagrams and both flow sequences: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Threat model: [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md).

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

**B2B agentic-payments infrastructure (the product):**
- [docs/B2B_INTEGRATION.md](docs/B2B_INTEGRATION.md) — the integration guide
- [docs/AGENTIC_PAYMENT_INTENT.md](docs/AGENTIC_PAYMENT_INTENT.md) — state machine + field reference
- [docs/PAYMENT_PROVIDER_INTERFACE.md](docs/PAYMENT_PROVIDER_INTERFACE.md) — the payment-rail interface, how to add a real adapter
- [docs/PROVIDER_STATUS.md](docs/PROVIDER_STATUS.md) — real/sandbox/mock/partner-required/not-implemented, per provider
- [docs/INTEGRATING.md](docs/INTEGRATING.md) — the lighter-weight, stateless policy-only surface (`Integrator`)
- [examples/kite-wallet](examples/kite-wallet) — a runnable example against the `Integrator` surface

**Core platform:**
- [BUILD_PLAN.md](BUILD_PLAN.md) — original repository audit, real/sandbox/mock/not-implemented labeling, phased plan
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md)
- [docs/MCP.md](docs/MCP.md)
- [docs/PAYMENT_SECURITY.md](docs/PAYMENT_SECURITY.md)
- [docs/PRIVACY.md](docs/PRIVACY.md)
- [docs/MERCHANT_CONNECTORS.md](docs/MERCHANT_CONNECTORS.md)
- [docs/GCP_DEPLOYMENT.md](docs/GCP_DEPLOYMENT.md)
- [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md)
- [docs/PRODUCTION.md](docs/PRODUCTION.md) — launch checklist, required env, what's still demo
- [openapi/v1.yaml](openapi/v1.yaml)

## What this is not (yet)

No TypeScript SDK (raw REST/MCP only). No fictional "DemoWallet" reference app showing the B2B integration from a consumer's point of view. No real card-network/processor adapter — every payment executes through `providers/paymentdemo`, a deterministic mock (see [docs/PROVIDER_STATUS.md](docs/PROVIDER_STATUS.md) for exactly which real rails are `NOT_IMPLEMENTED` vs. `PARTNER_REQUIRED` and why). No non-custodial stablecoin execution (the policy crypto-rail fields are real and evaluated; nothing executes against them). No browser executor, no live-verified merchant checkout beyond what's documented in [docs/MERCHANT_CONNECTORS.md](docs/MERCHANT_CONNECTORS.md), no real card tokenization vendor. Each of these is architected for (an interface exists, or a documented reason it's deferred) but not built yet.
