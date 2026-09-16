# MCP Server

Algebra's MCP server (`cmd/mcp`, `internal/mcpserver`) is built on the official [`github.com/modelcontextprotocol/go-sdk`](https://github.com/modelcontextprotocol/go-sdk) (v1.7.0+), targeting the current stable spec **2026-07-28**.

## Transport

- **stdio** (default): `go run ./cmd/mcp`. Matches the go-sdk's own quick-start pattern; suited to a locally-run agent (Claude Desktop, an IDE extension, a CLI agent).
- **Streamable HTTP**: `go run ./cmd/mcp -http=:8081`. Stateless at the transport layer — the same `*mcp.Server` (with every tool already registered) is served to every request; there is no per-connection session state to lose or to pin a client to a specific process, per the mandate's "horizontally scalable and stateless at the transport layer" requirement (§5). Persistent commerce state lives entirely in Postgres.

## Agent identity on this transport

MCP's production auth story (OAuth 2.1 as a resource server, over the HTTP transport) needs an authorization server this build doesn't have configured. Until that's wired up, every mutating tool's input carries an explicit `agent_token` field — a bearer token minted by `POST /api/v1/agents` (REST) and resolved, per call, to an `AgentIdentity` via `Server.resolveAgent` (`internal/mcpserver/server.go`). This is intentionally explicit rather than implicit-from-transport-headers: moving to native MCP bearer auth later is a transport-layer change, not a rewrite of any tool handler, because every handler already receives a resolved `*agent.Identity` and never trusts anything else about who's calling.

## Tool surface

Every tool below does exactly one thing: parse input → resolve the agent → call one `internal/app` service method → map the result to a response DTO that cannot structurally carry a secret. See each service's own doc comments (`internal/app/*.go`) for behavior; this table is the routing, not a re-explanation.

| Tool | Service method | Notes |
|---|---|---|
| `commerce.search_products` | `DiscoveryService.SearchProducts` | No intent needed; fans out to every connector with `Capabilities().Search`. Merchants that can't search but offer a handoff link (e.g. Blinkit) are returned with `handoff_url` instead of `products` — a merchant-owned link for the user to open. |
| `commerce.compare_products` | `DiscoveryService.SearchProducts` | Same call, products merged and sorted by price; handoff-only merchants follow as separate entries. |
| `commerce.create_purchase_intent` | `IntentService.CreateIntent` | Idempotency-key aware. Does not start discovery. |
| `commerce.get_purchase_intent` | `IntentService.GetIntent` | |
| `commerce.get_quotes` | `DiscoveryService.Discover` (if `DRAFT`) or `QuoteService.GetQuotes` | Triggers discovery on first call, reads cached quotes after. |
| `commerce.select_quote` | `QuoteService.SelectQuote` | |
| `commerce.request_purchase` | `PolicyService.EvaluateAndTransition` | Real side effects: policy decision persisted, intent transitioned, an `Approval` row created. |
| `commerce.approve_purchase` | `OrderService.Execute` | **Does not grant approval.** Only proceeds if the intent is already `APPROVED` (policy auto-allow, or a human already approved via `POST /api/v1/approvals/{id}/approve`). See "Why approve_purchase can't approve" below. |
| `commerce.cancel_purchase` | `IntentService.CancelIntent` | |
| `commerce.get_order_status` | `OrderService.GetOrderStatus` | |
| `commerce.get_receipt` | `OrderService.GetReceipt` | |
| `commerce.list_merchants` | `app.DescribeMerchants` | Capability matrix and readiness `status` (integration kind, ready, what setup is missing) come from each connector, never hand-typed. Same function backs `GET /api/v1/merchants`. See [MERCHANT_CONNECTORS.md](MERCHANT_CONNECTORS.md). |
| `payments.list_sources` | `PaymentService.ListSources` | Always the `.Safe()` projection — no token, no billing profile ID. |
| `payments.get_source_capabilities` | `PaymentService.GetSpendingCapability` | |
| `payments.get_spending_capability` | `PaymentService.GetSpendingCapability` | Same handler as above — the mandate names both, they answer the same question. |
| `profiles.list_shipping_profiles` | `PrivacyResolver.ListAliases` | Aliases only, e.g. `"shipping:home"` — never a resolved address. |
| `profiles.list_payment_profiles` | `PaymentService.ListSources` (aliases projected out) | Aliases only, e.g. `"payment:personal"`. |
| `policy.evaluate_intent` | `PolicyService.PreviewDecision` | Read-only dry run — no state change, no approval created. |
| `policy.explain_decision` | `PolicyService.ExplainDecision` | Surfaces the actually-recorded decision + reason codes; does not generate new explanatory text. |

## Why `approve_purchase` can't approve

The mandate lists `commerce.approve_purchase` as an agent-facing tool, but also insists user approval is a distinct trust boundary an agent must never cross (§29: "User Approval"). Both are true at once because the tool name describes what the agent is doing from *its* point of view — "okay, let's go" — not what actually authorizes the spend:

- If policy returned `ALLOW`, the intent is already `APPROVED` the moment `request_purchase` ran. No human click was ever required for this purchase.
- If policy returned `REQUIRE_APPROVAL`, the intent sits in `APPROVAL_REQUIRED` and **only** `POST /api/v1/approvals/{id}/approve` — a REST endpoint, called from the human-facing Approval UI, authenticated as the user — can move it to `APPROVED`.

`commerce.approve_purchase` calls `OrderService.Execute`, which hard-requires `intent.Status == APPROVED`. An agent invoking it on a still-pending intent gets a conflict error, not a bypass. This is enforced by the state machine (`internal/domain/intent/state_machine.go`), not by this tool's judgment.

## What deliberately cannot exist here

Per mandate §6, the following must never appear as a tool, and don't: `get_card_number`, `get_cvv`, `get_private_key`, `get_seed_phrase`, `get_merchant_password`, `get_session_cookie`, `get_otp`. Beyond just not registering such tools, no MCP response DTO in `internal/mcpserver` has a field that could carry one — `payment.PaymentSource.Safe()` strips the vault token reference, and privacy aliases are strings that mean nothing outside `PrivacyResolver`.
