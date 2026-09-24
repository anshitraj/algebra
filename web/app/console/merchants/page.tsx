"use client";

import { useEffect, useState } from "react";
import * as api from "@/lib/api-client";
import type { Merchant } from "@/lib/types";
import { Panel } from "@/components/console/ui";
import { useSession } from "@/lib/session";
import { StoreLogo } from "@/components/store-logo";
import { merchantLabel } from "@/lib/agent/steps";

const CAP_LABELS: { key: keyof Merchant["capabilities"]; label: string }[] = [
  { key: "search", label: "Search" },
  { key: "cart", label: "Cart" },
  { key: "checkout", label: "Checkout" },
  { key: "coupons", label: "Coupons" },
  { key: "order_tracking", label: "Tracking" },
];

function Dot({ on }: { on: boolean }) {
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full ${on ? "bg-primary" : "bg-border-strong"}`}
      aria-label={on ? "yes" : "no"}
    />
  );
}

export default function MerchantsPage() {
  const mode = useSession().user?.mode;
  const [merchants, setMerchants] = useState<Merchant[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listMerchants()
      .then((list) => setMerchants(api.merchantsFor(list, mode)))
      .catch((err) => setError(err.message));
  }, [mode]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
        Merchants
      </h1>
      <p className="mt-1.5 text-sm text-muted">
        Every registered connector, its computed capability matrix, and
        readiness — from <code className="font-mono text-xs">GET /api/v1/merchants</code>.
      </p>

      {error && (
        <p className="mt-6 rounded-lg bg-danger-tint px-4 py-3 text-sm text-danger">{error}</p>
      )}

      {merchants && (
        <Panel className="mt-8 overflow-x-auto p-0">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-5 py-3 font-medium">Merchant</th>
                <th className="px-5 py-3 font-medium">Mode</th>
                {CAP_LABELS.map((c) => (
                  <th key={c.key} className="px-3 py-3 text-center font-medium">
                    {c.label}
                  </th>
                ))}
                <th className="px-5 py-3 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {merchants.map((m) => (
                <tr key={m.name} className="border-b border-border last:border-b-0">
                  <td className="px-5 py-4 font-display text-sm font-semibold text-foreground">
                    <span className="flex items-center gap-3">
                      <StoreLogo store={m.name} size={30} />
                      {merchantLabel(m.name)}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-muted">{m.mode}</td>
                  {CAP_LABELS.map((c) => (
                    <td key={c.key} className="px-3 py-4 text-center">
                      <Dot on={m.capabilities[c.key]} />
                    </td>
                  ))}
                  <td className="px-5 py-4 text-sm text-muted">{m.status?.detail ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}
