// Turns a raw tool call + result into a human step for the UI trace:
// "Running your guardrails → Approved: under your ₹1,000 line". Pure,
// server-side, and defensive — tool results are whatever the API returned.

import type { StepDetail, StepStatus } from "./events";
import type { ToolResult } from "./execute-tool";

type Money = { minor_units?: number; currency?: string };

function money(m: Money | undefined): string {
  if (!m || typeof m.minor_units !== "number") return "—";
  const symbol = m.currency === "INR" || !m.currency ? "₹" : m.currency === "USD" ? "$" : `${m.currency} `;
  return `${symbol}${(m.minor_units / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

const MERCHANT_LABELS: Record<string, string> = {
  mock: "Demo store",
  swiggy_instamart: "Swiggy Instamart",
  zepto: "Zepto",
  amazon: "Amazon",
  flipkart: "Flipkart",
  blinkit: "Blinkit",
  "generic-browser": "Web",
};

export function merchantLabel(m: string | undefined) {
  if (!m) return "merchant";
  return MERCHANT_LABELS[m] ?? m;
}

const REASONS: Record<string, string> = {
  AMOUNT_AT_OR_ABOVE_APPROVAL_THRESHOLD: "At or above your auto-approve line",
  AMOUNT_EXCEEDS_PER_TRANSACTION_LIMIT: "Over your per-purchase cap",
  AMOUNT_EXCEEDS_DAILY_LIMIT: "Would exceed today's spending cap",
  CATEGORY_BLOCKED: "Category is on your never-buy list",
  MERCHANT_BLOCKED: "Merchant is blocked",
  MERCHANT_NOT_ALLOWLISTED: "Merchant isn't on your allow-list",
  PAYMENT_PROFILE_NOT_ALLOWED: "Payment method isn't allowed",
  SHIPPING_PROFILE_NOT_ALLOWED: "Delivery address isn't allowed",
  INTERNATIONAL_MERCHANT_REQUIRES_APPROVAL: "International merchant needs your OK",
  CURRENCY_NOT_SUPPORTED: "Currency isn't supported",
};

export function reasonText(code: string) {
  return REASONS[code] ?? code.replace(/_/g, " ").toLowerCase();
}

const TITLES: Record<string, string> = {
  create_purchase_intent: "Understanding your request",
  search_products: "Searching stores",
  web_search: "Searching the web",
  search_and_discover: "Finding the best price",
  get_quotes: "Comparing quotes",
  select_quote: "Choosing the best offer",
  request_purchase: "Running your guardrails",
  execute_purchase: "Placing the order",
  get_order_status: "Checking the order",
  list_merchants: "Checking connected stores",
  get_audit_trail: "Reading the audit trail",
  cancel_intent: "Cancelling",
  get_commerce_profile: "Reading your preferences",
  update_commerce_preferences: "Remembering a preference",
};

export function stepTitle(tool: string, input: Record<string, unknown>): string {
  if ((tool === "search_products" || tool === "web_search") && typeof input.query === "string") {
    return `${TITLES[tool]} for “${input.query}”`;
  }
  return TITLES[tool] ?? tool.replace(/_/g, " ");
}

export type StepOutcome = { status: Exclude<StepStatus, "running">; summary?: string; detail?: StepDetail };

export function summarizeStep(tool: string, input: Record<string, unknown>, result: ToolResult): StepOutcome {
  if (!result.ok) {
    const notConfigured = /not implemented|not configured/i.test(result.error);
    return { status: "error", summary: notConfigured ? "Not available on this server" : result.error };
  }
  const data = result.data as Record<string, unknown> | undefined;

  switch (tool) {
    case "create_purchase_intent": {
      const items = Array.isArray(input.items) ? (input.items as { query?: string; quantity?: number }[]) : [];
      const list = items.map((i) => `${i.quantity ?? 1}× ${i.query ?? "item"}`).join(", ");
      const budget = typeof input.max_total_minor_units === "number" ? ` · budget ${money({ minor_units: input.max_total_minor_units })}` : "";
      return { status: "done", summary: `${list}${budget}` };
    }
    case "search_products":
    case "web_search": {
      const results = (data?.results as Record<string, unknown>[] | undefined) ?? [];
      if (tool === "web_search") {
        const listings = results.map((r) => ({
          merchant: String(r.store || "Web"),
          name: [r.title, r.snippet].filter(Boolean).join(" · ") || String(r.url ?? ""),
          price:
            typeof r.price_minor_units === "number" && r.price_minor_units > 0
              ? money({ minor_units: r.price_minor_units, currency: String(r.currency ?? "INR") })
              : undefined,
          url: typeof r.url === "string" ? r.url : undefined,
        }));
        const stores = new Set(listings.map((l) => l.merchant)).size;
        return {
          status: "done",
          summary: listings.length
            ? `${listings.length} listing${listings.length === 1 ? "" : "s"} on ${stores} store${stores === 1 ? "" : "s"} · prices as seen on the web`
            : "No listings found",
          detail: listings.length ? { products: listings, note: "Prices as listed on each store's site — may have changed. Opens the store." } : undefined,
        };
      }
      const products: NonNullable<StepDetail["products"]> = [];
      let handoffs = 0;
      for (const r of results) {
        const merchant = merchantLabel(String(r.merchant ?? ""));
        if (r.handoff_url) handoffs++;
        for (const p of ((r.products as Record<string, unknown>[] | undefined) ?? []).slice(0, 3)) {
          products.push({
            merchant,
            name: String(p.name ?? p.title ?? "Product"),
            price:
              typeof p.price_minor_units === "number"
                ? money({ minor_units: p.price_minor_units, currency: String(p.currency ?? "INR") })
                : undefined,
            url: typeof p.url === "string" ? p.url : undefined,
          });
        }
      }
      const summary = products.length
        ? `${products.length} match${products.length === 1 ? "" : "es"} across ${new Set(products.map((p) => p.merchant)).size} store${new Set(products.map((p) => p.merchant)).size === 1 ? "" : "s"}`
        : handoffs
          ? "No priced results — handoff links only"
          : "Nothing found";
      return { status: "done", summary, detail: products.length ? { products: products.slice(0, 6) } : undefined };
    }
    case "search_and_discover":
    case "get_quotes": {
      const quotes = (data?.quotes as Record<string, unknown>[] | undefined) ?? [];
      if (quotes.length === 0) return { status: "error", summary: "No store could quote this" };
      const rows = quotes.slice(0, 4).map((q) => ({
        merchant: merchantLabel(String(q.merchant ?? "")),
        total: money(q.final_payable as Money),
        eta: typeof q.delivery_eta === "string" ? q.delivery_eta : undefined,
        items: ((q.items as { name?: string; quantity?: number }[] | undefined) ?? [])
          .map((i) => `${i.quantity ?? 1}× ${i.name ?? "item"}`)
          .join(", "),
      }));
      const merchants = new Set(quotes.map((q) => q.merchant)).size;
      return {
        status: "done",
        summary: `${quotes.length} quote${quotes.length === 1 ? "" : "s"} from ${merchants} store${merchants === 1 ? "" : "s"}`,
        detail: { quotes: rows },
      };
    }
    case "select_quote":
      return { status: "done", summary: "Offer locked in" };
    case "request_purchase": {
      const decision = String(data?.decision ?? "");
      const codes = ((data?.reason_codes as string[] | undefined) ?? []).filter((c) => !c.endsWith("_OK") && c !== "AMOUNT_WITHIN_HARD_LIMITS");
      if (decision === "ALLOW") return { status: "done", summary: "Approved by your guardrails" };
      if (decision === "REQUIRE_APPROVAL") {
        return { status: "waiting", summary: "Waiting for your approval", detail: { reasons: codes.map(reasonText) } };
      }
      return { status: "blocked", summary: "Blocked by your guardrails", detail: { reasons: codes.map(reasonText) } };
    }
    case "execute_purchase": {
      const order = data?.order as Record<string, unknown> | undefined;
      const status = String(data?.intent_status ?? "");
      if (order) {
        return {
          status: "done",
          summary: `Order placed with ${merchantLabel(String(order.merchant ?? ""))} · ${money(order.total as Money)}`,
          detail: {
            rows: [
              { label: "Order", value: String(order.merchant_order_id ?? order.order_id ?? "") },
              { label: "Mode", value: String(order.provider_mode ?? "") },
            ],
          },
        };
      }
      return { status: status === "SUCCEEDED" ? "done" : "error", summary: String(data?.reason ?? status.replace(/_/g, " ").toLowerCase()) };
    }
    case "get_order_status":
      return { status: "done", summary: `${String(data?.status ?? "unknown").toLowerCase()} · ${money(data?.total as Money)}` };
    case "list_merchants": {
      const list = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
      const ready = list.filter((m) => (m.status as Record<string, unknown> | undefined)?.ready).length;
      return { status: "done", summary: `${ready} of ${list.length} ready` };
    }
    case "get_audit_trail": {
      const n = Array.isArray(data) ? data.length : 0;
      return { status: "done", summary: `${n} event${n === 1 ? "" : "s"}` };
    }
    case "update_commerce_preferences": {
      const attrs = (input.attributes ?? {}) as Record<string, unknown>;
      const pairs = Object.entries(attrs).map(([k, v]) => `${k.replace(/_/g, " ")}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
      return { status: "done", summary: pairs.join(" · ") || "Saved" };
    }
    case "cancel_intent":
      return { status: "done", summary: "Cancelled" };
    default:
      return { status: "done" };
  }
}
