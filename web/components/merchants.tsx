"use client";

import { useEffect, useState } from "react";
import { Container } from "./container";

type MerchantStatus = {
  name: string;
  mode: "real" | "sandbox" | "mock";
  status: { integration: string; ready: boolean; detail: string };
};

const FALLBACK: MerchantStatus[] = [
  { name: "zepto", mode: "sandbox", status: { integration: "official_mcp", ready: false, detail: "Account linking is live; checkout waits on Zepto publishing its tool schemas." } },
  { name: "swiggy_instamart", mode: "sandbox", status: { integration: "official_mcp", ready: true, detail: "Search → cart → quote → Cash-on-Delivery checkout, opt-in." } },
  { name: "amazon", mode: "sandbox", status: { integration: "official_api", ready: false, detail: "Catalog search only — Amazon offers no third-party cart or order API." } },
  { name: "flipkart", mode: "sandbox", status: { integration: "affiliate_api", ready: false, detail: "Catalog search only — no cart/order API exists." } },
  { name: "blinkit", mode: "real", status: { integration: "deep_link_handoff", ready: true, detail: "No official API — a handoff link to Blinkit's own search page is the full, working capability." } },
];

const displayName: Record<string, string> = {
  zepto: "Zepto",
  swiggy_instamart: "Swiggy Instamart",
  amazon: "Amazon",
  flipkart: "Flipkart",
  blinkit: "Blinkit",
};

export function Merchants() {
  const [merchants, setMerchants] = useState<MerchantStatus[]>(FALLBACK);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    // Same-origin: /api/v1 is proxied to the Go API (next.config.ts).
    fetch("/api/v1/merchants", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: MerchantStatus[]) => {
        const named = data.filter((m) => m.name in displayName);
        if (named.length > 0) {
          setMerchants(named);
          setLive(true);
        }
      })
      .catch(() => {})
      .finally(() => clearTimeout(timeout));
    return () => controller.abort();
  }, []);

  return (
    <section id="merchants" className="pt-20 pb-20 md:pt-28 md:pb-28">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display max-w-lg text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              Every merchant, its real capability.
            </h2>
            <p className="mt-4 max-w-xl text-[1.0625rem] leading-relaxed text-muted">
              No merchant gets a status it hasn&rsquo;t earned. What&rsquo;s
              real, sandboxed, or a handoff link is labeled as such.
            </p>
          </div>
          <span className="flex items-center gap-2 font-mono text-xs text-muted">
            <span
              className={`h-1.5 w-1.5 rounded-full ${live ? "bg-primary" : "bg-border-strong"}`}
            />
            {live ? "live from GET /api/v1/merchants" : "static — API not reachable"}
          </span>
        </div>

        <div className="mt-12 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-5 py-3 font-medium">Merchant</th>
                <th className="px-5 py-3 font-medium">Integration</th>
                <th className="px-5 py-3 font-medium">Ready</th>
                <th className="px-5 py-3 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {merchants.map((m) => (
                <tr key={m.name} className="border-b border-border last:border-b-0">
                  <td className="px-5 py-4 font-display text-sm font-semibold text-foreground">
                    {displayName[m.name] ?? m.name}
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-muted">
                    {m.status.integration}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono text-xs ${
                        m.status.ready
                          ? "bg-primary-tint text-primary"
                          : "bg-accent-tint text-accent"
                      }`}
                    >
                      {m.status.ready ? "ready" : "not yet"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-muted">
                    {m.status.detail}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Container>
    </section>
  );
}
