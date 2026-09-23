# Architecture

Project Algebra is agentic-**payments** infrastructure: businesses (card apps, wallets, fintechs, stablecoin apps) integrate it so their own end users can grant AI agents controlled spending authority over payment sources the business already holds — see `docs/B2B_INTEGRATION.md`. It never gives an AI model unrestricted access to money — agents get scoped capabilities and aliases, never secrets.

Two primitives live side by side in the same control plane, sharing policy/approval/audit infrastructure but each with its own state machine:

- **`PurchaseIntent`** (`internal/domain/intent`) — commerce/discovery-shaped: items, merchant search, quotes. Algebra's own first-party reference console (`web/`) uses this.
- **`AgenticPaymentIntent`** (`internal/domain/paymentintent`) — a tenant's agent requesting to spend a bounded amount at a known merchant, no discovery step. The B2B product itself. See `docs/AGENTIC_PAYMENT_INTENT.md`.

## 1. System context

```mermaid
flowchart TD
    U[User] --> AG[AI Agent]
    AG -->|MCP tool calls| MCP[Algebra MCP Server]
    AG -.->|or REST / SDK| API[Algebra REST API v1]
    MCP --> APP
    API --> APP
    subgraph APP[Application Services — single domain layer]
        INT[Intent Service]
        DISC[Discovery Service]
        QUOTE[Quote Service]
        POL[Policy Service]
        APPR[Approval Service]
        PAY[Payment Service]
        ORD[Order Service]
    end
    APP --> PG[(PostgreSQL — authoritative state)]
    APP --> RD[(Redis — cache / locks / idempotency)]
    POL --> PP[PolicyProvider: Local deterministic rule engine]
    PAY --> VP[CardVaultProvider: Sandbox / Spreedly]
    APP --> PR[PrivacyResolver: encrypted profiles]
    DISC --> MC[MerchantConnector: Mock / Swiggy Instamart MCP / Zepto MCP / Amazon Creators API / Flipkart Affiliate API / Blinkit handoff]
    APP --> AUD[(Audit Log — append only)]
```

MCP, REST, and the future TypeScript SDK are **thin transports**. They parse a request, call an application service in `internal/app`, and serialize the result. No commerce logic is duplicated across transports — this is a hard rule (mandate §53), not a style preference, because divergent logic between "what the agent can do" and "what the API can do" is itself a security bug.

## 2. Purchase flow

```mermaid
sequenceDiagram
    participant Agent
    participant MCP as Algebra MCP/API
    participant Policy as PolicyProvider
    participant Privacy as PrivacyResolver
    participant Merchant as MerchantConnector
    participant User

    Agent->>MCP: create_purchase_intent(items, constraints)
    MCP->>MCP: persist intent (DRAFT), audit event
    Agent->>MCP: get_quotes(intent_id)
    MCP->>Merchant: search + cart + checkout quote
    Merchant-->>MCP: normalized CheckoutQuote(s)
    MCP->>Policy: EvaluatePurchaseIntent / EvaluateAmount / EvaluatePaymentSource
    Policy-->>MCP: ALLOW | DENY | REQUIRE_APPROVAL (+ reason codes)
    alt DENY
        MCP-->>Agent: POLICY_REJECTED (terminal)
    else REQUIRE_APPROVAL or ALLOW
        MCP->>Privacy: resolve shipping/payment alias (server-side only, never to Agent)
        MCP-->>User: approval request (merchant, items, final price, payment alias)
        User-->>MCP: approve
        MCP->>MCP: refresh quote, verify against approved hash+tolerance
        MCP->>Merchant: execute checkout
        Merchant-->>MCP: order or AUTHENTICATION_REQUIRED
        MCP-->>User: complete challenge (3DS/OTP/UPI) if required
        MCP-->>Agent: SUCCEEDED + receipt
    end
```

The agent never sees the resolved shipping address, card details, or OTP at any point in this sequence — it sees intent IDs, quote IDs, approval IDs, and final states.

## 3. State machine

`internal/domain/intent` implements the mandate's states as a server-validated transition table (`state_machine.go`). Every transition is checked against an explicit allow-list; an illegal transition returns an error and nothing is persisted. Every successful transition emits an `AuditEvent`.

```mermaid
stateDiagram-v2
    [*] --> DRAFT
    DRAFT --> DISCOVERING
    DISCOVERING --> QUOTED
    DISCOVERING --> FAILED
    QUOTED --> POLICY_CHECK
    POLICY_CHECK --> POLICY_REJECTED
    POLICY_CHECK --> APPROVAL_REQUIRED
    POLICY_CHECK --> APPROVED
    APPROVAL_REQUIRED --> APPROVED
    APPROVAL_REQUIRED --> EXPIRED
    APPROVAL_REQUIRED --> CANCELLED
    APPROVED --> EXECUTING
    EXECUTING --> AUTHENTICATION_REQUIRED
    EXECUTING --> SUCCEEDED
    EXECUTING --> FAILED
    EXECUTING --> MERCHANT_INTERVENTION_REQUIRED
    EXECUTING --> USER_INTERVENTION_REQUIRED
    AUTHENTICATION_REQUIRED --> SUCCEEDED
    AUTHENTICATION_REQUIRED --> FAILED
    QUOTED --> REAPPROVAL_REQUIRED
    APPROVED --> REAPPROVAL_REQUIRED
    REAPPROVAL_REQUIRED --> APPROVED
    REAPPROVAL_REQUIRED --> CANCELLED
    SUCCEEDED --> PARTIALLY_COMPLETED
    POLICY_REJECTED --> [*]
    SUCCEEDED --> [*]
    FAILED --> [*]
    CANCELLED --> [*]
    EXPIRED --> [*]
    PARTIALLY_COMPLETED --> [*]
```

## 4. AgenticPaymentIntent flow (B2B)

```mermaid
sequenceDiagram
    participant Tenant as Tenant backend
    participant Agent
    participant API as Algebra REST/MCP
    participant Policy as PolicyProvider (tenant's persisted PolicySet)
    participant PP as paymentprovider.Provider
    participant User as End user (Tenant's own app UI)

    Tenant->>API: POST /tenants/{id}/policy-sets (once, or whenever policy changes)
    Agent->>API: POST /payment-intents (merchant, amount, payment_source_alias)
    API->>Policy: EvaluatePurchaseIntent
    Policy-->>API: ALLOW | DENY | REQUIRE_APPROVAL
    alt DENY
        API-->>Agent: DENIED (terminal) + webhook payment_intent.policy_denied
    else REQUIRE_APPROVAL
        API-->>Agent: APPROVAL_REQUIRED + webhook payment_intent.approval_required
        User->>API: POST /payment-intents/{id}/approve
    end
    Agent->>API: POST /payment-intents/{id}/execute
    API->>PP: RegisterPaymentSource -> CreateDelegatedAuthorization -> RequestAuthentication -> CreateScopedCredential -> ExecutePayment
    PP-->>API: PaymentResult (authoritative — never fabricated)
    API-->>Agent: SUCCEEDED + provider_transaction_id
    API-->>Tenant: webhook payment_intent.succeeded (signed, HMAC-SHA256)
```

There is no `approve` tool on either transport — an agent can request a payment, only a human (through the tenant's own app) can approve one. Full detail: `docs/B2B_INTEGRATION.md`, `docs/AGENTIC_PAYMENT_INTENT.md`, `docs/PAYMENT_PROVIDER_INTERFACE.md`.

## 5. Why Go / Python / TypeScript

- **Go** (this build): everything on the money/authorization path — API gateway, MCP server, intent/policy/approval/payment/order services, audit. Latency-sensitive, needs strong typing and no GIL for concurrent merchant fan-out.
- **Python** (interfaces designed, not built in Phase 1): product discovery, catalog normalization, coupon/offer parsing, ranking. Explicitly **not** the authorization authority — a Python worker can propose a normalized product/offer, it cannot approve a payment.
- **TypeScript** (interfaces designed, not built in Phase 1): Next.js console, browser extension, SDK. Calls the same REST/MCP surface as any other client — no special back-door.

## 6. Module boundaries (Go modular monolith)

```
internal/domain     entities + interfaces, zero I/O, fully unit-testable
internal/app        application services — the ONE place business rules live
internal/platform   postgres, redis, config, logging/redaction
internal/api/v1     REST transport (thin)
internal/mcpserver  MCP transport (thin)
connectors/*        MerchantConnector implementations; connectors/remotemcp is the shared OAuth + MCP client for remote-MCP merchants
providers/*         CardVaultProvider / ConfidentialComputeProvider / paymentprovider.Provider implementations
policy/             public (non-internal/) package — policy.Rules/Provider/LocalProvider, go-gettable by third parties
```

`internal/app` depends on `internal/domain` interfaces, never on concrete connectors/providers directly — those are injected at `cmd/api` / `cmd/mcp` startup. This is what makes "split into services later" realistic: the seam is already an interface boundary, not a package-private function call.

## 7. Deployment shape (target — see [GCP_DEPLOYMENT.md](GCP_DEPLOYMENT.md))

Go API/MCP → Cloud Run. Postgres → Cloud SQL. Redis → Memorystore. Async events → Pub/Sub. Secrets → Secret Manager. Envelope-encryption keys → Cloud KMS. Nothing in this repo deploys itself yet; this is the target mapping, not a claim of an existing deployment.
