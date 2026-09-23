"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import * as api from "@/lib/api-client";
import type { AuditEvent, Intent, Order, PolicyDecision, Quote } from "@/lib/types";
import { merchantLabel, reasonText } from "@/lib/agent/steps";
import { IconArrowLeft, IconBan, IconCheck, IconClock, IconPackage, Spinner } from "@/components/icons";
import { ApprovalCard } from "@/components/console/agent/approval-card";
import { useConsoleData } from "@/components/console/console-data";
import { friendlyStatus } from "@/components/console/intent-list";
import { ErrorNote, Skeleton, StatusBadge, formatMoney, itemsSummary, rupees } from "@/components/console/ui";

const STAGES = ["Requested", "Compared", "Guardrails", "Approval", "Ordered"] as const;

function stageForStatus(status: string): number {
  if (["DRAFT", "DISCOVERING"].includes(status)) return 0;
  if (["QUOTED"].includes(status)) return 1;
  if (["POLICY_CHECK", "POLICY_REJECTED"].includes(status)) return 2;
  if (["APPROVAL_REQUIRED", "APPROVED", "REAPPROVAL_REQUIRED"].includes(status)) return 3;
  return 4;
}

const TERMINAL = ["SUCCEEDED", "PARTIALLY_COMPLETED", "FAILED", "CANCELLED", "EXPIRED", "POLICY_REJECTED"];

const ACTIONS: Record<string, string> = {
  IntentCreated: "Request created",
  DiscoveryStarted: "Searching stores",
  DiscoveryFailed: "No store could quote",
  ConnectorFailed: "A store didn't respond",
  QuoteCreated: "Quotes received",
  PolicyEvaluationStarted: "Checking guardrails",
  PolicyEvaluated: "Guardrails decided",
  ApprovalRequested: "Waiting for your approval",
  ApprovalGranted: "Approved",
  ApprovalRejected: "You rejected it",
  ReapprovalRequired: "Price changed — needs approval again",
  IntentPolicyRejected: "Blocked by guardrails",
  ExecutionStarted: "Placing order",
  PrivacyProfileResolved: "Address shared with the store, for checkout only",
  PaymentChallengeCreated: "Payment needs your confirmation",
  OrderCompleted: "Order placed",
  OrderFailed: "Order failed",
  OrderCancelled: "Order cancelled",
  IntentCancelled: "Cancelled",
};

function humanAction(a: string) {
  return ACTIONS[a] ?? a.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export default function IntentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { refreshOverview } = useConsoleData();
  const [intent, setIntent] = useState<Intent | null>(null);
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [decision, setDecision] = useState<PolicyDecision | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [audit, setAudit] = useState<AuditEvent[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const fresh = await api.getIntent(id);
    setIntent(fresh);
    if (fresh.status === "QUOTED") setQuotes((await api.getQuotes(id)).quotes);
    if (fresh.status === "POLICY_REJECTED") setDecision(await api.policyExplain(id).catch(() => null));
    if (["SUCCEEDED", "PARTIALLY_COMPLETED", "EXECUTING", "AUTHENTICATION_REQUIRED"].includes(fresh.status)) {
      setOrder(await api.getOrder(id).catch(() => null));
    }
    setAudit(await api.getAuditTrail(id).catch(() => []));
    return fresh;
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching from the REST API on mount
    refresh().catch((err) => setError(err instanceof Error ? err.message : "Couldn't load this order"));
  }, [refresh]);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setError(null);
    try {
      await fn();
      await refresh();
      refreshOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      await refresh().catch(() => undefined);
    } finally {
      setBusy(null);
    }
  }

  // One click: pick the offer, then let the guardrails decide.
  const choose = (q: Quote) =>
    run(`choose-${q.quote_id}`, async () => {
      await api.selectQuote(id, q.quote_id);
      const d = await api.requestPurchase(id);
      setDecision(d);
      if (d.decision === "ALLOW") await api.execute(id, crypto.randomUUID());
    });

  if (error && !intent) {
    return (
      <div className="mx-auto max-w-3xl">
        <ErrorNote>{error}</ErrorNote>
        <Link href="/console/activity" className="mt-4 inline-block text-sm text-primary hover:underline">
          Back to activity
        </Link>
      </div>
    );
  }
  if (!intent) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  const stage = stageForStatus(intent.status);
  const blocked = intent.status === "POLICY_REJECTED";
  const cheapest = quotes?.reduce<Quote | null>((m, q) => (!m || q.final_payable.minor_units < m.final_payable.minor_units ? q : m), null);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/console/activity" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <IconArrowLeft size={15} /> Activity
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-[1.75rem] leading-tight font-semibold tracking-tight text-balance text-foreground">
            {itemsSummary(intent.items ?? [])}
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            {intent.category ? intent.category.replace(/_/g, " ") : "Uncategorized"}
            {intent.max_total_minor_units ? ` · budget ${rupees(intent.max_total_minor_units)}` : ""} ·{" "}
            {new Date(intent.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
        <StatusBadge status={intent.status} label={friendlyStatus(intent.status)} />
      </div>

      <ol className="mt-8 grid grid-cols-5 gap-2" aria-label="Progress">
        {STAGES.map((s, i) => {
          const done = i < stage || (i === stage && TERMINAL.includes(intent.status) && !blocked);
          const failed = blocked && i === stage;
          return (
            <li key={s}>
              <div className="h-1 overflow-hidden rounded-full bg-border">
                <motion.div
                  className={`h-full rounded-full ${failed ? "bg-danger" : done ? "bg-primary" : "bg-accent"}`}
                  initial={{ width: 0 }}
                  animate={{ width: done || failed ? "100%" : i === stage ? "50%" : "0%" }}
                  transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <p className={`mt-2 text-xs ${i <= stage ? "text-foreground" : "text-muted"}`}>{s}</p>
            </li>
          );
        })}
      </ol>

      {error && (
        <div className="mt-6">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <div className="mt-8 space-y-4">
        {intent.status === "DRAFT" && (
          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="text-sm text-foreground">Ready to compare prices across connected stores.</p>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => run("discover", () => api.discover(id))}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-tint disabled:opacity-50"
            >
              {busy === "discover" && <Spinner size={14} />} Compare prices
            </button>
          </div>
        )}

        {intent.status === "QUOTED" && (
          <section>
            <h2 className="text-[0.95rem] font-semibold text-foreground">Pick an offer</h2>
            <p className="mt-1 text-sm text-muted">Choosing runs it past your guardrails. Under your line, it&apos;s ordered right away.</p>
            {quotes === null ? (
              <Skeleton className="mt-3 h-20" />
            ) : quotes.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No store could quote this. Try different wording.</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {quotes.map((q) => (
                  <li key={q.quote_id} className="rounded-2xl border border-border bg-surface p-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-[0.95rem] font-medium text-foreground">
                          {merchantLabel(q.merchant)}
                          {cheapest?.quote_id === q.quote_id && quotes.length > 1 && (
                            <span className="rounded-full bg-primary-tint px-2 py-0.5 text-[0.7rem] font-medium text-primary">Lowest</span>
                          )}
                        </p>
                        <p className="mt-0.5 truncate text-sm text-muted">{q.items.map((it) => `${it.quantity}× ${it.name}`).join(", ")}</p>
                        <p className="mt-1 text-xs text-muted">
                          Items {formatMoney(q.subtotal)}
                          {q.delivery_fee.minor_units > 0 && ` · delivery ${formatMoney(q.delivery_fee)}`}
                          {q.handling_fee.minor_units > 0 && ` · handling ${formatMoney(q.handling_fee)}`}
                          {q.coupon_discount.minor_units > 0 && ` · coupon −${formatMoney(q.coupon_discount)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-lg text-foreground tabular-nums">{formatMoney(q.final_payable)}</span>
                        <button
                          type="button"
                          disabled={!!busy}
                          onClick={() => choose(q)}
                          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-tint transition-[opacity,transform] active:scale-[0.98] disabled:opacity-50"
                        >
                          {busy === `choose-${q.quote_id}` && <Spinner size={14} />} Choose
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {(intent.status === "APPROVAL_REQUIRED" || intent.status === "REAPPROVAL_REQUIRED") && (
          <ApprovalCard intentId={id} onResolved={() => refresh().then(() => refreshOverview())} />
        )}

        {intent.status === "APPROVED" && (
          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="flex items-center gap-2 text-sm text-foreground">
              <IconCheck size={16} className="text-primary" /> Approved. Place the order with the store?
            </p>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => run("execute", () => api.execute(id, crypto.randomUUID()))}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-tint disabled:opacity-50"
            >
              {busy === "execute" && <Spinner size={14} />} Place order
            </button>
          </div>
        )}

        {blocked && (
          <div className="rounded-2xl border border-danger/40 bg-danger-tint/40 p-5">
            <p className="flex items-center gap-2 text-[0.95rem] font-medium text-foreground">
              <IconBan size={17} className="text-danger" /> Your guardrails blocked this purchase
            </p>
            {decision && (
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {decision.reason_codes
                  .filter((c) => !c.endsWith("_OK"))
                  .map((c) => (
                    <li key={c}>{reasonText(c)}</li>
                  ))}
              </ul>
            )}
            <Link href="/console/guardrails" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
              Review guardrails
            </Link>
          </div>
        )}

        {["EXECUTING", "AUTHENTICATION_REQUIRED"].includes(intent.status) && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-surface p-5 text-sm text-foreground">
            <IconClock size={17} className="text-accent" />
            {intent.status === "AUTHENTICATION_REQUIRED"
              ? "Waiting for you to confirm the payment (OTP / 3-D Secure / UPI) on your own device."
              : "Placing the order with the store…"}
          </div>
        )}

        {order && ["SUCCEEDED", "PARTIALLY_COMPLETED"].includes(intent.status) && (
          <div className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-tint">
                <IconPackage size={18} />
              </span>
              <div className="flex-1">
                <p className="text-[0.95rem] font-medium text-foreground">Ordered from {merchantLabel(order.merchant)}</p>
                <p className="font-mono text-xs text-muted">{order.merchant_order_id}</p>
              </div>
              <span className="font-mono text-lg text-foreground tabular-nums">{formatMoney(order.total)}</span>
            </div>
            <ul className="mt-4 divide-y divide-border border-t border-border text-sm">
              {order.items.map((it) => (
                <li key={it.merchant_product_id} className="flex justify-between py-2">
                  <span className="text-foreground">
                    {it.quantity}× {it.name}
                  </span>
                  <span className="font-mono text-muted tabular-nums">{formatMoney({ minor_units: it.unit_price.minor_units * it.quantity, currency: it.unit_price.currency })}</span>
                </li>
              ))}
            </ul>
            {order.provider_mode !== "real" && (
              <p className="mt-3 text-xs text-muted">
                Placed with a {order.provider_mode} store — no real money moved and nothing will ship.
              </p>
            )}
          </div>
        )}

        {["FAILED", "MERCHANT_INTERVENTION_REQUIRED", "USER_INTERVENTION_REQUIRED", "CANCELLED", "EXPIRED"].includes(intent.status) && (
          <div className="rounded-2xl border border-border bg-surface p-5 text-sm text-muted">This request ended without an order.</div>
        )}

        {!TERMINAL.includes(intent.status) && !["EXECUTING", "AUTHENTICATION_REQUIRED"].includes(intent.status) && (
          <button
            type="button"
            disabled={!!busy}
            onClick={() => run("cancel", () => api.cancelIntent(id))}
            className="text-sm text-muted hover:text-danger disabled:opacity-50"
          >
            {busy === "cancel" ? "Cancelling…" : "Cancel this request"}
          </button>
        )}
      </div>

      <section className="mt-12">
        <h2 className="text-[0.95rem] font-semibold text-foreground">Audit trail</h2>
        <p className="mt-1 text-sm text-muted">Append-only. Every decision and hand-off, as it happened.</p>
        {audit === null ? (
          <Skeleton className="mt-3 h-20" />
        ) : audit.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No events yet.</p>
        ) : (
          <ol className="mt-4 border-l border-border pl-5">
            {audit.map((ev) => (
              <li key={ev.event_id} className="relative pb-4 last:pb-0">
                <span className="absolute top-1.5 -left-[23.5px] h-2 w-2 rounded-full bg-border-strong" aria-hidden="true" />
                <p className="text-sm text-foreground">
                  {humanAction(ev.action)}
                  {ev.policy_decision && <span className="ml-2 font-mono text-xs text-muted">{ev.policy_decision}</span>}
                </p>
                <p className="font-mono text-xs text-muted">
                  {new Date(ev.timestamp).toLocaleTimeString()}
                  {ev.merchant ? ` · ${merchantLabel(ev.merchant)}` : ""}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
