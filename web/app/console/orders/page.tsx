"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import * as api from "@/lib/api-client";
import { getTrackedIntents } from "@/lib/intent-history";
import type { Order } from "@/lib/types";
import { EmptyState, Panel, StatusBadge, formatMoney } from "@/components/console/ui";

type Row = { intentId: string; order: Order };

export default function OrdersPage() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    (async () => {
      const tracked = getTrackedIntents();
      const results = await Promise.all(
        tracked.map(async (t) => {
          try {
            return { intentId: t.id, order: await api.getOrder(t.id) };
          } catch {
            return null;
          }
        })
      );
      setRows(results.filter((r): r is Row => r !== null));
    })();
  }, []);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
        Orders
      </h1>
      <p className="mt-1.5 text-sm text-muted">
        Orders placed from intents tracked in this browser.
      </p>

      <div className="mt-8">
        {rows === null && <p className="text-sm text-muted">Loading…</p>}
        {rows?.length === 0 && (
          <EmptyState
            title="No orders yet"
            body="An order appears here once an intent's execute step places it with a merchant connector."
          />
        )}
        {rows && rows.length > 0 && (
          <Panel className="divide-y divide-border p-0">
            {rows.map((row) => (
              <Link
                key={row.order.order_id}
                href={`/console/intents/${row.intentId}`}
                className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-primary-tint/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {row.order.merchant} · {row.order.merchant_order_id}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {new Date(row.order.placed_at).toLocaleString()} ·{" "}
                    <span className="font-mono">{row.order.provider_mode}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-foreground">
                    {formatMoney(row.order.total)}
                  </span>
                  <StatusBadge status={row.order.status} />
                </div>
              </Link>
            ))}
          </Panel>
        )}
      </div>
    </div>
  );
}
