// Neutral tool definitions shared by all three provider adapters
// (providers/anthropic.ts, openai.ts, gemini.ts). JSON Schema is the one
// tool-input format all three provider APIs agree on, so this list is the
// single source of truth each adapter converts into its own wire format.

export type JsonSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
};

export type AgentTool = {
  name: string;
  description: string;
  parameters: JsonSchema;
};

const intentIdParam = {
  intent_id: { type: "string", description: "The intent_id returned by create_purchase_intent." },
};

export const AGENT_TOOLS: AgentTool[] = [
  {
    name: "create_purchase_intent",
    description:
      "Start a new purchase. Creates a PurchaseIntent in DRAFT status and returns its intent_id. " +
      "Call search_and_discover next to find merchant quotes for it.",
    parameters: {
      type: "object",
      properties: {
        items: {
          type: "array",
          minItems: 1,
          description: "What to buy.",
          items: {
            type: "object",
            properties: {
              query: { type: "string", description: "Product search text, e.g. 'Coke Zero' or 'chips'." },
              quantity: { type: "integer", minimum: 1, description: "How many. Defaults to 1." },
            },
            required: ["query"],
          },
        },
        max_total_minor_units: {
          type: "integer",
          description:
            "Budget ceiling in minor currency units (paise for INR — ₹400 = 40000). Omit for no explicit cap; " +
            "policy's own hard cap still applies.",
        },
        currency: { type: "string", description: "ISO currency code. Defaults to INR." },
        category: {
          type: "string",
          description: "Item category, e.g. 'groceries' or 'gift_cards'. Policy uses this to allow/deny.",
        },
        payment_profile: { type: "string", description: "Defaults to 'payment:personal'." },
        delivery_profile: { type: "string", description: "Defaults to 'shipping:home'." },
      },
      required: ["items"],
    },
  },
  {
    name: "search_and_discover",
    description: "Search merchants for a DRAFT intent's items and fetch quotes. Call once per intent.",
    parameters: { type: "object", properties: { ...intentIdParam }, required: ["intent_id"] },
  },
  {
    name: "get_quotes",
    description: "Re-fetch quotes already retrieved by search_and_discover for this intent, without searching again.",
    parameters: { type: "object", properties: { ...intentIdParam }, required: ["intent_id"] },
  },
  {
    name: "select_quote",
    description: "Pick one quote to proceed with. Required before request_purchase.",
    parameters: {
      type: "object",
      properties: { ...intentIdParam, quote_id: { type: "string", description: "The quote_id to select." } },
      required: ["intent_id", "quote_id"],
    },
  },
  {
    name: "request_purchase",
    description:
      "Ask Algebra's policy engine to evaluate the selected quote against real spend/merchant/category rules. " +
      "Returns decision ALLOW, DENY, or REQUIRE_APPROVAL — this is a real authorization check, not a formality. " +
      "On REQUIRE_APPROVAL you must stop and tell the user a human approval is needed in the console; never call " +
      "execute_purchase next. On DENY, explain the reason_codes in plain language and stop.",
    parameters: { type: "object", properties: { ...intentIdParam }, required: ["intent_id"] },
  },
  {
    name: "execute_purchase",
    description:
      "Place the order with the merchant. Only call this after request_purchase returned ALLOW, or after the " +
      "user has told you they approved a REQUIRE_APPROVAL decision in the console.",
    parameters: { type: "object", properties: { ...intentIdParam }, required: ["intent_id"] },
  },
  {
    name: "get_order_status",
    description: "Get the placed order's status and details for an intent.",
    parameters: { type: "object", properties: { ...intentIdParam }, required: ["intent_id"] },
  },
  {
    name: "list_merchants",
    description: "List merchants Algebra can transact with and their integration status.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_audit_trail",
    description: "Get the full audit log of state transitions and decisions for an intent.",
    parameters: { type: "object", properties: { ...intentIdParam }, required: ["intent_id"] },
  },
  {
    name: "cancel_intent",
    description: "Cancel a purchase intent that hasn't completed yet.",
    parameters: { type: "object", properties: { ...intentIdParam }, required: ["intent_id"] },
  },
];
