// Hand-written against the real Go domain structs and REST handlers
// (internal/domain/*, internal/api/v1/*) — openapi/v1.yaml's schemas are
// thinner than what the API actually returns for several endpoints
// (quotes/orders serialize the full domain struct), so these types are the
// ground truth, not the generated lib/api-types.ts.

export type Money = {
  minor_units: number;
  currency: string;
};

export type IntentStatus =
  | "DRAFT"
  | "DISCOVERING"
  | "QUOTED"
  | "POLICY_CHECK"
  | "POLICY_REJECTED"
  | "APPROVAL_REQUIRED"
  | "APPROVED"
  | "REAPPROVAL_REQUIRED"
  | "EXECUTING"
  | "AUTHENTICATION_REQUIRED"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED"
  | "PARTIALLY_COMPLETED"
  | "MERCHANT_INTERVENTION_REQUIRED"
  | "USER_INTERVENTION_REQUIRED";

export type IntentItem = {
  query: string;
  quantity: number;
  product_id?: string;
};

export type IntentConstraints = {
  max_total_minor_units?: number;
  currency?: string;
  delivery_profile?: string;
  payment_profile?: string;
  preferred_merchants?: string[];
  excluded_merchants?: string[];
  category?: string;
  international?: boolean;
};

// NOTE: internal/api/v1/intents.go's intentResponse is deliberately thin —
// createIntent/getIntent/cancelIntent all return only these three fields,
// never the full PurchaseIntent (items, constraints, user_id, agent_id,
// timestamps aren't sent back). Confirmed by reading intentResponse and
// toIntentResponse directly, not assumed from the domain struct. The
// console keeps its own item summary client-side (lib/intent-history.ts)
// because of this.
export type Intent = {
  intent_id: string;
  status: IntentStatus;
  selected_quote_id?: string;
};

export type Offer = {
  type: string;
  description: string;
  amount: Money;
  code?: string;
};

export type QuoteItem = {
  merchant_product_id: string;
  name: string;
  quantity: number;
  unit_price: Money;
};

export type Quote = {
  quote_id: string;
  merchant: string;
  items: QuoteItem[];
  subtotal: Money;
  item_discounts: Money;
  coupon_discount: Money;
  bank_offer: Money;
  card_offer: Money;
  cashback: Money;
  delivery_fee: Money;
  handling_fee: Money;
  platform_fee: Money;
  tax: Money;
  other_fee: Money;
  final_payable: Money;
  effective_cost: Money;
  offers?: Offer[];
  payment_source_requirements?: string[];
  delivery_eta?: string;
  expires_at: string;
  retrieved_at: string;
};

export type PolicyDecisionValue = "ALLOW" | "DENY" | "REQUIRE_APPROVAL";

// NOTE: request-purchase/policy-preview/policy-explain all respond with
// internal/api/v1/intents.go's decisionResponse, not the full
// policy.PolicyDecision — no approval_requirement or evaluated_at comes
// back over REST (confirmed by reading the handlers). The Approval
// resource itself (GET .../approval) is where the human-facing reason
// lives once REQUIRE_APPROVAL creates one.
export type PolicyDecision = {
  decision: PolicyDecisionValue;
  reason_codes: string[];
  policy_version: string;
};

export type ApprovalStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED"
  | "CONSUMED"
  | "REAPPROVAL_REQUIRED";

// NOTE: internal/domain/approval.Approval has no `json:"..."` tags, so the
// REST layer serializes it with raw Go field names (PascalCase) — the one
// endpoint on this API that doesn't follow snake_case. Confirmed by reading
// approval.go and internal/api/v1/approvals.go directly, not assumed.
export type Approval = {
  ID: string;
  IntentID: string;
  QuoteID: string;
  UserID: string;
  AgentID: string;
  Merchant: string;
  Amount: Money;
  PaymentSourceAlias: string;
  ItemsHash: string;
  Status: ApprovalStatus;
  AuthenticationMethod?: string;
  CreatedAt: string;
  DecidedAt?: string;
  ExpiresAt: string;
};

export type OrderItem = {
  merchant_product_id: string;
  name: string;
  quantity: number;
  unit_price: Money;
};

export type OrderStatus =
  | "PLACED"
  | "CONFIRMED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "FAILED";

export type Order = {
  order_id: string;
  intent_id: string;
  approval_id: string;
  merchant: string;
  merchant_order_id: string;
  items: OrderItem[];
  total: Money;
  status: OrderStatus;
  placed_at: string;
  delivery_eta?: string;
  receipt_url?: string;
  provider_mode: "mock" | "sandbox" | "real";
};

// Matches internal/domain/audit.Event exactly (GET .../audit returns the
// raw slice, unwrapped).
export type AuditEvent = {
  event_id: string;
  trace_id?: string;
  timestamp: string;
  user_id?: string;
  agent_id?: string;
  intent_id?: string;
  action: string;
  previous_state?: string;
  new_state?: string;
  policy_decision?: string;
  merchant?: string;
  payment_source_alias?: string;
  result?: string;
  metadata?: Record<string, unknown>;
};

export type MerchantCapabilities = {
  search: boolean;
  cart: boolean;
  checkout: boolean;
  coupons: boolean;
  order_tracking: boolean;
};

export type MerchantStatus = {
  integration:
    | "mock"
    | "official_mcp"
    | "official_api"
    | "affiliate_api"
    | "deep_link_handoff"
    | "not_implemented";
  ready: boolean;
  detail: string;
  source?: string;
};

export type Merchant = {
  name: string;
  mode: "real" | "sandbox" | "mock";
  capabilities: MerchantCapabilities;
  status?: MerchantStatus;
};

export type PaymentSourceType =
  | "CARD"
  | "CRYPTO_CARD"
  | "VIRTUAL_CARD"
  | "WALLET"
  | "STABLECOIN_ACCOUNT"
  | "BANK"
  | "UPI";

export type PaymentSourceCapabilities = {
  can_pay: boolean;
  supported_currencies: string[];
  merchant_restrictions?: string[];
  transaction_limit_minor_units?: number;
  requires_user_auth: boolean;
  requires_3ds?: boolean;
};

export type PaymentSource = {
  id: string;
  alias: string;
  type: PaymentSourceType;
  network?: string;
  last4?: string;
  nickname?: string;
  capabilities: PaymentSourceCapabilities;
  revoked: boolean;
};

export type ExecuteResult = {
  intent_status: IntentStatus;
  order?: Order;
  reason?: string;
};

export type ApiErrorBody = { error: string };
