// Turns a raw tool call + result into a human step for the UI trace:
// "Running your guardrails → Approved: under your ₹1,000 line". Pure,
// server-side, and defensive — tool results are whatever the API returned.

import type { Deal } from "../types";
import type { StepDetail, StepHint, StepStatus } from "./events";
import { storeFor } from "../stores";
import type { ToolResult } from "./execute-tool";

type Money = { minor_units?: number; currency?: string };

function money(m: Money | undefined): string {
  if (!m || typeof m.minor_units !== "number") return "—";
  const symbol = m.currency === "INR" || !m.currency ? "₹" : m.currency === "USD" ? "$" : `${m.currency} `;
  return `${symbol}${(m.minor_units / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

const MERCHANT_LABELS: Record<string, string> = {
  mock: "Demo store (test)",
  demo_checkout: "Demo checkout",
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
  community_deals: "Checking community deals",
  find_deals: "Checking deals and card offers",
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
  if ((tool === "search_products" || tool === "web_search" || tool === "find_deals" || tool === "community_deals") && typeof input.query === "string" && input.query) {
    const max = input.max_price_minor_units;
    const budget = tool === "web_search" && typeof max === "number" && max > 0 ? ` under ${money({ minor_units: max })}` : "";
    return `${TITLES[tool]} for “${input.query}”${budget}`;
  }
  return TITLES[tool] ?? tool.replace(/_/g, " ");
}

/** The query and budget a running step is working with, shown while it runs. */
export function stepHint(tool: string, input: Record<string, unknown>): StepHint | undefined {
  const query = typeof input.query === "string" && input.query ? input.query : undefined;
  const max = input.max_price_minor_units ?? input.max_total_minor_units;
  const budget = typeof max === "number" && max > 0 ? money({ minor_units: max }) : undefined;
  return query || budget ? { query, budget } : undefined;
}

export type StepOutcome = { status: Exclude<StepStatus, "running">; summary?: string; detail?: StepDetail };

/** The listing's own delivery time, else the store's typical one (flagged as such). */
function delivery(r: Record<string, unknown>): { eta?: string; etaTypical?: boolean } {
  if (typeof r.delivery === "string" && r.delivery.trim()) return { eta: r.delivery.trim() };
  const store = storeFor(typeof r.store === "string" ? r.store : typeof r.url === "string" ? r.url : undefined);
  return store ? { eta: store.typicalDelivery, etaTypical: true } : {};
}

/** The scam shield's flags (internal/domain/websearch.FlagSuspicious) in words. */
function listingWarning(warnings: unknown): string | undefined {
  if (!Array.isArray(warnings) || !warnings.includes("price_far_below_others")) return undefined;
  return warnings.includes("unknown_store")
    ? "Far below other stores' price, from an unfamiliar store — likely a scam"
    : "Far below other listings of this product — check it's the same item";
}

function shortDate(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
}

/** One deal as a listing row: what it is, what it saves, until when. */
function dealListing(d: Deal): NonNullable<StepDetail["products"]>[number] {
  const until = shortDate(d.ends_at);
  if (d.kind === "bank_offer") {
    const off = d.discount_percent
      ? `${d.discount_percent}% off${d.max_discount_minor_units ? ` up to ${money({ minor_units: d.max_discount_minor_units })}` : ""}`
      : `${money({ minor_units: d.flat_discount_minor_units })} off`;
    const bits = [
      `${d.bank ?? "Card"} card${d.matches_user_card ? " (yours)" : ""}: ${off}`,
      d.min_order_minor_units ? `on ${money({ minor_units: d.min_order_minor_units })}+` : "",
      until ? `till ${until}` : "",
    ].filter(Boolean);
    return {
      merchant: merchantLabel(d.merchant),
      name: bits.join(" · "),
      price: d.estimated_discount_minor_units ? `save ~${money({ minor_units: d.estimated_discount_minor_units })}` : undefined,
      url: d.url,
    };
  }
  const bits = [
    d.title,
    d.savings_percent ? `${d.savings_percent}% off${d.basis_label ? ` ${d.basis_label}` : ""}` : d.description,
    d.badge,
    d.prime_only ? "Prime members" : "",
    until ? `till ${until}` : "",
  ].filter(Boolean);
  return {
    merchant: merchantLabel(d.merchant),
    name: bits.join(" · "),
    price: d.price_minor_units ? money({ minor_units: d.price_minor_units, currency: d.currency }) : undefined,
    url: d.url,
    image: d.image_url,
  };
}

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
          title: typeof r.title === "string" ? r.title : undefined,
          ...delivery(r),
          storePage: r.product_page === false,
          price:
            typeof r.price_minor_units === "number" && r.price_minor_units > 0
              ? money({ minor_units: r.price_minor_units, currency: String(r.currency ?? "INR") })
              : undefined,
          url: typeof r.url === "string" ? r.url : undefined,
          // A favicon stand-in adds nothing the store's own icon tile doesn't.
          image: typeof r.image_url === "string" && !r.image_url.includes("/s2/favicons") ? r.image_url : undefined,
          warning: listingWarning(r.warnings),
        }));
        const stores = new Set(listings.map((l) => l.merchant)).size;
        const max = input.max_price_minor_units;
        const budget = typeof max === "number" && max > 0 ? money({ minor_units: max }) : "";
        return {
          status: "done",
          summary: listings.length
            ? `${listings.length} listing${listings.length === 1 ? "" : "s"} on ${stores} store${stores === 1 ? "" : "s"}${budget ? ` · all within ${budget}` : " · prices as seen on the web"}`
            : budget
              ? `Nothing listed within ${budget}`
              : "No listings found",
          detail: listings.length
            ? {
                products: listings,
                note: `${budget ? `Only listings at or under ${budget}. ` : ""}Prices as listed on each store's site — may have changed. Opens the store.`,
              }
            : undefined,
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
    case "community_deals": {
      const tips = (data?.tips as Record<string, unknown>[] | undefined) ?? [];
      const searched = ((data?.searched as string[] | undefined) ?? []).join(", ");
      if (tips.length === 0) return { status: "done", summary: searched ? `No recent deals on ${searched}` : "No recent deals" };
      return {
        status: "done",
        summary: `${tips.length} recent tip${tips.length === 1 ? "" : "s"} from ${searched || "the community"} · unverified`,
        detail: {
          products: tips.map((t) => ({
            merchant: String(t.source ?? "Community"),
            name: [t.title, t.summary].filter(Boolean).join(" · "),
            price:
              typeof t.price_minor_units === "number" && t.price_minor_units > 0 ? money({ minor_units: t.price_minor_units, currency: "INR" }) : undefined,
            url: typeof t.url === "string" ? t.url : undefined,
            code: typeof t.code === "string" && t.code ? t.code : undefined,
            posted: typeof t.posted === "string" && t.posted ? t.posted : undefined,
            storePage: true, // a post, not a product to Select
            image: undefined,
          })),
          note: "Community posts — unverified. Codes can expire within hours; check at checkout. Never counted in a price.",
        },
      };
    }
    case "find_deals": {
      const deals = (data?.deals as Deal[] | undefined) ?? [];
      const notes = (data?.notes as { merchant?: string; detail: string }[] | undefined) ?? [];
      const cards = deals.filter((d) => d.kind === "bank_offer").length;
      const storeDeals = deals.length - cards;
      if (deals.length === 0) {
        return {
          status: "done",
          summary: "No live deals found",
          detail: notes.length ? { reasons: notes.map((n) => (n.merchant ? `${merchantLabel(n.merchant)}: ${n.detail}` : n.detail)) } : undefined,
        };
      }
      const parts = [
        storeDeals ? `${storeDeals} store deal${storeDeals === 1 ? "" : "s"}` : "",
        cards ? `${cards} card offer${cards === 1 ? "" : "s"}` : "",
      ].filter(Boolean);
      return {
        status: "done",
        summary: parts.join(" · "),
        detail: {
          products: deals.slice(0, 8).map(dealListing),
          note: "Store deals apply on the store's own site; card offers apply when you pay with that card. No coupon code needed — terms as published, may change.",
        },
      };
    }
    case "search_and_discover":
    case "get_quotes": {
      const quotes = (data?.quotes as Record<string, unknown>[] | undefined) ?? [];
      // Not a failure: the connected stores just don't carry it.
      if (quotes.length === 0) return { status: "done", summary: "No connected store carries this" };
      const rows = quotes.slice(0, 4).map((q) => ({
        merchant: merchantLabel(String(q.merchant ?? "")),
        total: money(q.final_payable as Money),
        eta: typeof q.delivery_eta === "string" ? q.delivery_eta : undefined,
        items: ((q.items as { name?: string; quantity?: number }[] | undefined) ?? [])
          .map((i) => `${i.quantity ?? 1}× ${i.name ?? "item"}`)
          .join(", "),
      }));
      const merchants = new Set(quotes.map((q) => q.merchant)).size;
      const realQuotes = quotes.filter((q) => q.merchant !== "mock");
      if (realQuotes.length === 0) {
        // Every connected store that can actually check out is the test one.
        return {
          status: "done",
          summary: "Only the test store can check out — no real store is connected yet",
          detail: { quotes: rows, note: "A purchase here is a test: nothing ships, no money moves. Buy from a real shop through the web listings instead." },
        };
      }
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
        const isTest = String(order.provider_mode ?? "") !== "real";
        const isDemo = order.merchant === "demo_checkout";
        const eta = typeof order.delivery_eta === "string" ? new Date(order.delivery_eta) : null;
        const rows = [{ label: "Order", value: String(order.merchant_order_id ?? order.order_id ?? "") }];
        if (eta && !Number.isNaN(eta.getTime())) {
          rows.push({
            label: "Arriving",
            value: eta.toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }),
          });
        }
        if (!isDemo) rows.push({ label: "Mode", value: String(order.provider_mode ?? "") });
        return {
          status: "done",
          summary: `${isDemo ? "Demo order" : isTest ? "Test order" : "Order"} placed · ${money(order.total as Money)}`,
          detail: {
            rows,
            links: order.order_id ? [{ title: "Invoice, tracking and delivery map", url: `/console/orders/${String(order.order_id)}` }] : undefined,
            note: isDemo ? "Simulated checkout: no money moved and nothing ships." : undefined,
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
