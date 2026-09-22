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

function constraints(input: Record<string, unknown>): IntentConstraints {
  const maxTotal = input.max_total_minor_units;
  return {
    max_total_minor_units: typeof maxTotal === "number" ? maxTotal : undefined,
    currency: typeof input.currency === "string" ? input.currency : "INR",
    category: typeof input.category === "string" ? input.category : undefined,
    payment_profile: typeof input.payment_profile === "string" ? input.payment_profile : "payment:personal",
    delivery_profile: typeof input.delivery_profile === "string" ? input.delivery_profile : "shipping:home",
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
        const intent = await client.createIntent(identity, items(input), constraints(input), crypto.randomUUID());
        return { ok: true, data: intent };
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
      default:
        return { ok: false, error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    if (err instanceof client.ServerApiError) return { ok: false, error: err.message };
    return { ok: false, error: err instanceof Error ? err.message : "Tool execution failed" };
  }
}
