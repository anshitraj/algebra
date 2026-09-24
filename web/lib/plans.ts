// The public price list, read from the API's billing config — the same
// numbers checkout charges — so the pricing page can't drift from billing.

export type Plans = {
  currency: string;
  growth_price_minor_units: number;
  developer_included_executions: number;
  growth_included_executions: number;
};

/** Used only when the API can't be reached (e.g. during a static build). Mirrors the API's defaults. */
export const DEFAULT_PLANS: Plans = {
  currency: "INR",
  growth_price_minor_units: 849900,
  developer_included_executions: 100,
  growth_included_executions: 5000,
};

const API_URL = process.env.ALGEBRA_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export async function getPlans(): Promise<Plans> {
  try {
    const res = await fetch(`${API_URL}/api/v1/billing/plans`, { next: { revalidate: 300 } });
    if (res.ok) return { ...DEFAULT_PLANS, ...((await res.json()) as Partial<Plans>) };
  } catch {
    // API unreachable — fall through to the defaults
  }
  return DEFAULT_PLANS;
}

export function formatPrice(minor: number, currency: string) {
  const symbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : `${currency} `;
  return `${symbol}${(minor / 100).toLocaleString(currency === "INR" ? "en-IN" : "en-US", { maximumFractionDigits: 0 })}`;
}
