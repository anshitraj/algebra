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
            "Budget ceiling in minor currency units (paise for INR — ₹400 = 40000). Use the user's stated budget; " +
            "if they gave none, omit it and their per-purchase cap is used. Quotes above it are rejected.",
        },
        currency: { type: "string", description: "ISO currency code. Defaults to INR." },
        category: {
          type: "string",
          description: "Item category, e.g. 'groceries' or 'gift_cards'. Policy uses this to allow/deny.",
        },
        payment_profile: { type: "string", description: "Defaults to 'payment:personal'." },
        delivery_profile: { type: "string", description: "Defaults to 'shipping:home'." },
        preferred_merchants: {
          type: "array",
          items: { type: "string" },
          description: "Connector names to try first, from the user's profile (e.g. 'swiggy_instamart', 'zepto').",
        },
      },
      required: ["items"],
    },
  },
  {
    name: "search_products",
    description:
      "Look up products and prices across every connected store WITHOUT starting a purchase. Use it when the user " +
      "is browsing or comparing, or to check availability before create_purchase_intent. Stores that can't be " +
      "searched come back with a handoff_url for the user to open.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "Free-text product query, e.g. 'coke zero 300ml'." } },
      required: ["query"],
    },
  },
  {
    name: "web_search",
    description:
      "Live Google search across Indian online stores (Blinkit, Zepto, Instamart, BigBasket, Amazon, Flipkart, ...). " +
      "Returns real listings: title, variant (in snippet), store, the price the result showed (price_minor_units, " +
      "paise) and a link. Use it whenever the user wants to see options, compare prices or sizes, or when connected " +
      "stores return only handoff links. These prices are indicative, not quotes — Algebra can't check out through " +
      "these links; the user buys there themselves, or you use create_purchase_intent for a connected store.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Product to look for, e.g. 'Coke Zero' or 'Coke Zero 750ml'." },
      },
      required: ["query"],
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
  {
    name: "get_commerce_profile",
    description:
      "Get the user's known shopping preferences and default shipping/payment aliases. The current profile is " +
      "already given to you in context at the start of this conversation — call this only if you need to " +
      "double-check the latest state, e.g. after a long conversation or after saving an update.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "update_commerce_preferences",
    description:
      "Save a stable preference the user just stated (their usual size, a color they prefer, a dietary " +
      "restriction, ...) under one category, so it doesn't need to be asked again next time. Merges into " +
      "whatever is already known for that category — does not replace the whole profile. The current profile " +
      "is already given to you in context at the start of this conversation; call this only when the user " +
      "states something new or different from what you already know.",
    parameters: {
      type: "object",
      properties: {
        category: { type: "string", description: "e.g. 'clothing', 'shopping', 'food'." },
        attributes: {
          type: "object",
          description: "Flat key-value attributes to merge in, e.g. {\"usual_size\": \"L\"}.",
          properties: {},
        },
      },
      required: ["category", "attributes"],
    },
  },
];
