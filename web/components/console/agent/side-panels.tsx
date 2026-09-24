"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import * as api from "@/lib/api-client";
import type { Merchant, Order, Overview } from "@/lib/types";
import { merchantLabel } from "@/lib/agent/steps";
import { StoreLogo } from "@/components/store-logo";
import { useSession } from "@/lib/session";
import { IconBan, IconGauge, IconGlobe, IconShield, IconTag } from "@/components/icons";
import { formatMoney } from "../ui";

const rupees = (m: number) => `₹${(m / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

function PanelHeading({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 pt-5 pb-3">
      <h2 className="text-[0.8rem] font-semibold tracking-wide text-foreground uppercase">{children}</h2>
      {action}
    </div>
  );
}

function GuardRow({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <li className="flex gap-3 px-5 py-3">
      <span className="mt-0.5 text-muted [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-foreground">{label}</span>
          <span className="shrink-0 font-mono text-sm text-primary tabular-nums">{value}</span>
        </div>
        <p className="mt-0.5 text-xs leading-snug text-muted">{hint}</p>
      </div>
    </li>
  );
}

export function GuardsPanel({
  overview,
  session,
}: {
  overview: Overview | null;
  session: { spent: number; orders: number; steps: number };
}) {
  const g = overview?.guardrails;
  const spent = overview?.spent_today.minor_units ?? 0;
  const pct = g && g.max_per_day_minor_units > 0 ? Math.min(100, (spent / g.max_per_day_minor_units) * 100) : 0;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <PanelHeading action={<Link href="/console/guardrails" className="text-xs font-medium text-primary hover:underline">Edit</Link>}>
        Active guardrails
      </PanelHeading>
      {!g ? (
        <div className="space-y-3 px-5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-border/60" />
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          <GuardRow
            icon={<IconShield />}
            label="Auto-approve"
            value={g.approval_threshold_minor_units <= 1 ? "Never" : `< ${rupees(g.approval_threshold_minor_units)}`}
            hint={g.approval_threshold_minor_units <= 1 ? "Every purchase waits for you" : "Above this, you approve"}
          />
          <GuardRow icon={<IconTag />} label="Per purchase" value={rupees(g.max_per_purchase_minor_units)} hint="Hard cap — denied above" />
          <li className="px-5 py-3">
            <div className="flex gap-3">
              <span className="mt-0.5 text-muted">
                <IconGauge size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-foreground">Daily cap</span>
                  <span className="font-mono text-sm text-primary tabular-nums">{rupees(g.max_per_day_minor_units)}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                  <div
                    className={`h-full rounded-full transition-[width] duration-700 ${pct > 85 ? "bg-danger" : pct > 60 ? "bg-accent" : "bg-primary"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-muted">{rupees(spent)} spent today</p>
              </div>
            </div>
          </li>
          <GuardRow
            icon={<IconBan />}
            label="Never buys"
            value={String(g.blocked_categories.length)}
            hint={g.blocked_categories.length ? g.blocked_categories.map((c) => c.replace(/_/g, " ")).join(", ") : "Nothing blocked"}
          />
          <GuardRow
            icon={<IconGlobe />}
            label="International"
            value={g.international_requires_approval ? "Ask" : "Allow"}
            hint="Foreign merchants"
          />
        </ul>
      )}

      <PanelHeading>This chat</PanelHeading>
      <dl className="grid grid-cols-3 gap-px overflow-hidden border-y border-border bg-border">
        {[
          { k: "Spent", v: rupees(session.spent) },
          { k: "Orders", v: String(session.orders) },
          { k: "Steps", v: String(session.steps) },
        ].map((s) => (
          <div key={s.k} className="bg-background px-3 py-3 text-center">
            <dt className="text-[0.7rem] text-muted">{s.k}</dt>
            <dd className="mt-0.5 font-mono text-sm text-foreground tabular-nums">{s.v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-auto px-5 py-5 text-xs leading-relaxed text-muted">
        Guardrails are checked on Algebra&apos;s server for every purchase. The agent can read them; it can&apos;t change them.
      </p>
    </div>
  );
}

function capabilityLabel(m: Merchant) {
  if (m.capabilities.checkout) return "Checkout";
  if (m.capabilities.search) return "Search only";
  if (m.status?.integration === "deep_link_handoff") return "Handoff link";
  return "Not connected";
}

export function StoresPanel({ refreshKey }: { refreshKey: number }) {
  const { user } = useSession();
  const mode = user?.mode;
  const [merchants, setMerchants] = useState<Merchant[] | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    api
      .listMerchants()
      .then((list) => setMerchants(api.merchantsFor(list, mode)))
      .catch(() => setMerchants([]));
  }, [mode]);

  useEffect(() => {
    api
      .listMyOrders(4)
      .then(setOrders)
      .catch(() => setOrders([]));
  }, [refreshKey]);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <PanelHeading action={<Link href="/console/merchants" className="text-xs font-medium text-primary hover:underline">All</Link>}>
        Stores
      </PanelHeading>
      <ul className="divide-y divide-border border-y border-border">
        {merchants === null
          ? [0, 1, 2].map((i) => (
              <li key={i} className="px-5 py-3">
                <div className="h-8 animate-pulse rounded-lg bg-border/60" />
              </li>
            ))
          : merchants.map((m) => {
              const ready = !!m.status?.ready;
              return (
                <li key={m.name} className="flex items-center gap-3 px-5 py-3" title={m.status?.detail}>
                  <span className="relative shrink-0">
                    <StoreLogo store={m.name} size={30} className={ready ? "" : "opacity-70 grayscale"} />
                    <span
                      className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-background ${ready ? "bg-success" : "bg-border-strong"}`}
                      aria-hidden="true"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{merchantLabel(m.name)}</p>
                    <p className="truncate text-xs text-muted">{ready ? capabilityLabel(m) : "Needs setup"}</p>
                  </div>
                  <span className="font-mono text-[0.68rem] text-muted uppercase">{m.mode}</span>
                </li>
              );
            })}
      </ul>

      <PanelHeading action={<Link href="/console/orders" className="text-xs font-medium text-primary hover:underline">All</Link>}>
        Recent orders
      </PanelHeading>
      {orders && orders.length === 0 && <p className="px-5 text-sm text-muted">No orders yet. Your first one will land here.</p>}
      {orders && orders.length > 0 && (
        <ul className="divide-y divide-border border-y border-border">
          {orders.map((o) => (
            <li key={o.order_id}>
              <Link href={`/console/intents/${o.intent_id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-primary-tint/40">
                <StoreLogo store={o.merchant} size={28} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{o.items.map((i) => i.name).join(", ") || merchantLabel(o.merchant)}</p>
                  <p className="text-xs text-muted">
                    {merchantLabel(o.merchant)} · {new Date(o.placed_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-sm text-foreground tabular-nums">{formatMoney(o.total)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
