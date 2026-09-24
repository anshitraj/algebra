import * as client from "./server-client";
import type { ServerIdentity } from "./server-client";
import type { IntentConstraints, IntentItem } from "../types";

export type ToolResult = { ok: true; data: unknown } | { ok: false; error: string };

function str(input: Record<string, unknown>, key: string): string {
  const v = input[key];
  if (typeof v !== "string" || !v) throw new Error(`Missing required field: ${key}`);
  return v;
}

function items(input: Record<string, unknown>): IntentItem[] {
  const raw = input.items;
  if (!Array.isArray(raw) || raw.length === 0) throw new Error("items must be a non-empty array");
  return raw.map((it) => {
    const obj = (it ?? {}) as Record<string, unknown>;
    const query = obj.query;
    if (typeof query !== "string" || !query) throw new Error("each item needs a query string");
    const quantity = obj.quantity;
    return { query, quantity: typeof quantity === "number" && quantity > 0 ? Math.round(quantity) : 1 };
  });
}

// Used only if the route couldn't read the user's guardrails — the platform
// default per-purchase cap (policy.DefaultRules, ₹2,000).
const FALLBACK_BUDGET_MINOR = 200000;

function constraints(input: Record<string, unknown>, identity: ServerIdentity): IntentConstraints {
  const maxTotal = input.max_total_minor_units;
  const preferred = Array.isArray(input.preferred_merchants)
    ? input.preferred_merchants.filter((m): m is string => typeof m === "string" && m.length > 0)
    : [];
  // The domain requires a positive ceiling on every intent. No stated budget
  // means "up to my per-purchase cap" — policy denies above it anyway.
  const budget =
    typeof maxTotal === "number" && maxTotal > 0 ? Math.round(maxTotal) : identity.defaultBudgetMinor ?? FALLBACK_BUDGET_MINOR;
  return {
    max_total_minor_units: budget,
    currency: typeof input.currency === "string" ? input.currency : "INR",
    category: typeof input.category === "string" ? input.category : undefined,
    payment_profile: typeof input.payment_profile === "string" ? input.payment_profile : "payment:personal",
    delivery_profile: typeof input.delivery_profile === "string" ? input.delivery_profile : "shipping:home",
    preferred_merchants: preferred.length ? preferred : undefined,
  };
}

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  identity: ServerIdentity
): Promise<ToolResult> {
  try {
    switch (name) {
      case "create_purchase_intent": {
        const intent = await client.createIntent(identity, items(input), constraints(input, identity), crypto.randomUUID());
        return { ok: true, data: intent };
      }
      case "search_products": {
        const result = await client.searchProducts(identity, str(input, "query"));
        return { ok: true, data: result };
      }
      case "web_search": {
        const max = input.max_price_minor_units;
        const maxPrice = typeof max === "number" && max > 0 ? Math.round(max) : undefined;
        const result = await client.webSearch(identity, str(input, "query"), 8, maxPrice);
        return { ok: true, data: result };
      }
      case "community_deals": {
        const result = await client.communityDeals(identity, str(input, "query"));
        return { ok: true, data: result };
      }
      case "find_deals": {
        const strings = (key: string) =>
          Array.isArray(input[key]) ? (input[key] as unknown[]).filter((v): v is string => typeof v === "string" && v.length > 0) : undefined;
        const price = input.price_minor_units;
        const result = await client.findDeals(identity, {
          query: typeof input.query === "string" ? input.query : "",
          merchants: strings("merchants"),
          priceMinor: typeof price === "number" && price > 0 ? price : undefined,
          banks: strings("banks"),
        });
        return { ok: true, data: result };
      }
      case "search_and_discover": {
        const result = await client.discover(identity, str(input, "intent_id"));
        return { ok: true, data: result };
      }
      case "get_quotes": {
        const result = await client.getQuotes(identity, str(input, "intent_id"));
        return { ok: true, data: result };
      }
      case "select_quote": {
        const result = await client.selectQuote(identity, str(input, "intent_id"), str(input, "quote_id"));
        return { ok: true, data: result };
      }
      case "request_purchase": {
        const decision = await client.requestPurchase(identity, str(input, "intent_id"));
        return { ok: true, data: decision };
      }
      case "execute_purchase": {
        const result = await client.execute(identity, str(input, "intent_id"), crypto.randomUUID());
        return { ok: true, data: result };
      }
      case "get_order_status": {
        const order = await client.getOrder(identity, str(input, "intent_id"));
        return { ok: true, data: order };
      }
      case "list_merchants": {
        const merchants = await client.listMerchants();
        return { ok: true, data: merchants };
      }
      case "get_audit_trail": {
        const audit = await client.getAuditTrail(identity, str(input, "intent_id"));
        return { ok: true, data: audit };
      }
      case "cancel_intent": {
        const intent = await client.cancelIntent(identity, str(input, "intent_id"));
        return { ok: true, data: intent };
      }
      case "get_commerce_profile": {
        const profile = await client.getCommerceProfile(identity);
        return { ok: true, data: profile };
      }
      case "update_commerce_preferences": {
        const category = str(input, "category");
        const attributes = input.attributes;
        if (typeof attributes !== "object" || attributes === null || Array.isArray(attributes)) {
          throw new Error("attributes must be an object");
        }
        const profile = await client.setCommercePreferences(identity, category, attributes as Record<string, unknown>);
        return { ok: true, data: profile };
      }
      default:
        return { ok: false, error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    if (err instanceof client.ServerApiError) return { ok: false, error: err.message };
    return { ok: false, error: err instanceof Error ? err.message : "Tool execution failed" };
  }
}
