"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import * as api from "@/lib/api-client";
import type { Order } from "@/lib/types";
import { merchantLabel } from "@/lib/agent/steps";
import { IconPackage } from "@/components/icons";
import { ErrorNote, PageHeader, Skeleton, StatusBadge, formatMoney, itemsSummary } from "@/components/console/ui";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listMyOrders(100)
      .then(setOrders)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load orders"));
  }, []);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Orders" description="Everything your agent — or you — actually bought, newest first." />
      <div className="mt-8">
        {error && <ErrorNote>{error}</ErrorNote>}
        {orders === null && !error && (
          <div className="space-y-3">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        )}
        {orders?.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border-strong px-6 py-14 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary-tint text-primary">
              <IconPackage size={20} />
            </span>
            <p className="font-display mt-4 text-lg font-semibold text-foreground">No orders yet</p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
              Ask the agent for something and it lands here once the store confirms.
            </p>
            <Link href="/console/agent" className="mt-5 inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-tint">
              Open the agent
            </Link>
          </div>
        )}
        {orders && orders.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {orders.map((o) => (
              <li key={o.order_id}>
                <Link href={`/console/intents/${o.intent_id}`} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-primary-tint/40">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.95rem] text-foreground">{itemsSummary(o.items)}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {merchantLabel(o.merchant)} · {new Date(o.placed_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} ·{" "}
                      <span className="font-mono">{o.merchant_order_id}</span>
                      {o.provider_mode !== "real" && (
                        <span className="ml-1.5 rounded bg-border px-1.5 py-px font-mono text-[0.65rem] uppercase">{o.provider_mode}</span>
                      )}
                    </p>
                  </div>
                  <span className="font-mono text-sm text-foreground tabular-nums">{formatMoney(o.total)}</span>
                  <StatusBadge status={o.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
