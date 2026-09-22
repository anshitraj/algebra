"use client";

import { useCallback, useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import * as api from "@/lib/api-client";
import { ApiError } from "@/lib/api-client";
import type { Approval, AuditEvent, Intent, Order, PolicyDecision, Quote } from "@/lib/types";
import { getTrackedIntents } from "@/lib/intent-history";
import { Button, Panel, StatusBadge, formatMoney } from "@/components/console/ui";

const STAGES = ["Agent", "Discovery", "Policy", "Approval", "Merchant", "Order"] as const;

function stageForStatus(status: string): number {
  if (["DRAFT"].includes(status)) return 0;
  if (["DISCOVERING", "QUOTED"].includes(status)) return 1;
  if (["POLICY_CHECK", "POLICY_REJECTED"].includes(status)) return 2;
  if (["APPROVAL_REQUIRED", "APPROVED", "REAPPROVAL_REQUIRED"].includes(status)) return 3;
  if (["EXECUTING", "AUTHENTICATION_REQUIRED", "MERCHANT_INTERVENTION_REQUIRED", "USER_INTERVENTION_REQUIRED"].includes(status)) return 4;
  if (["SUCCEEDED", "PARTIALLY_COMPLETED", "FAILED", "CANCELLED", "EXPIRED"].includes(status)) return 5;
  return 0;
}

export default function IntentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [intent, setIntent] = useState<Intent | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [policyDecision, setPolicyDecision] = useState<PolicyDecision | null>(null);
  const [approval, setApproval] = useState<Approval | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [audit, setAudit] = useState<AuditEvent[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const fresh = await api.getIntent(id);
    setIntent(fresh);
    if (["APPROVAL_REQUIRED", "REAPPROVAL_REQUIRED", "APPROVED"].includes(fresh.status)) {
      try {
        setApproval(await api.getApprovalForIntent(id));
      } catch {
        // no approval exists yet for this status transition — fine
      }
    }
    if (["SUCCEEDED", "PARTIALLY_COMPLETED", "EXECUTING", "AUTHENTICATION_REQUIRED"].includes(fresh.status)) {
      try {
        setOrder(await api.getOrder(id));
      } catch {
        // order not placed yet
      }
    }
    return fresh;
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching from the REST API on mount
    refresh().catch((err) => setError(err instanceof Error ? err.message : "Failed to load intent"));
  }, [refresh]);

  async function run<T>(label: string, fn: () => Promise<T>) {
    setBusy(label);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  if (error && !intent) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="rounded-lg bg-danger-tint px-4 py-3 text-sm text-danger">{error}</p>
        <Link href="/console" className="mt-4 inline-block text-sm text-primary hover:underline">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  if (!intent) {
    return <div className="mx-auto max-w-2xl text-sm text-muted">Loading…</div>;
  }

  const stage = stageForStatus(intent.status);
  // The API's intent response is deliberately thin (id/status only — see
  // lib/types.ts) — the item summary comes from this browser's own
  // creation-time record instead.
  const summary =
    getTrackedIntents().find((t) => t.id === id)?.summary ?? "Purchase intent";

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/console" className="text-sm text-muted hover:text-foreground">
        ← Dashboard
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
          {summary}
        </h1>
        <StatusBadge status={intent.status} />
      </div>
      <p className="mt-1 font-mono text-xs text-muted">{intent.intent_id}</p>

      <ol className="mt-8 flex items-center gap-1">
        {STAGES.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`h-2 w-2 rounded-full ${
                  i < stage ? "bg-primary" : i === stage ? "bg-accent" : "bg-border-strong"
                }`}
              />
              <span className={`text-[0.6875rem] ${i <= stage ? "text-foreground" : "text-muted"}`}>
                {s}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div className={`h-px flex-1 ${i < stage ? "bg-primary" : "bg-border"}`} />
            )}
          </li>
        ))}
      </ol>

      {error && (
        <p className="mt-6 rounded-lg bg-danger-tint px-4 py-3 text-sm text-danger">{error}</p>
      )}

      <div className="mt-8">
        {intent.status === "DRAFT" && (
          <Panel>
            <p className="text-sm text-foreground">Ready to search merchants for these items.</p>
            <Button className="mt-4" disabled={busy !== null} onClick={() => run("discover", async () => setQuotes((await api.discover(id)).quotes))}>
              {busy === "discover" ? "Searching…" : "Run discovery"}
            </Button>
          </Panel>
        )}

        {intent.status === "QUOTED" && (
          <div className="space-y-3">
            {(quotes.length > 0 ? quotes : null)?.map((q) => (
              <QuoteCard
                key={q.quote_id}
                quote={q}
                busy={busy === `select-${q.quote_id}`}
                onSelect={() =>
                  run(`select-${q.quote_id}`, () => api.selectQuote(id, q.quote_id))
                }
              />
            ))}
            {quotes.length === 0 && (
              <Panel>
                <p className="text-sm text-muted">
                  Quoted already — reload quotes to pick one.
                </p>
                <Button
                  variant="secondary"
                  className="mt-3"
                  onClick={() => run("quotes", async () => setQuotes((await api.getQuotes(id)).quotes))}
                >
                  Load quotes
                </Button>
              </Panel>
            )}
            {intent.selected_quote_id && (
              <Panel>
                <p className="text-sm text-foreground">Quote selected.</p>
                <Button
                  className="mt-3"
                  disabled={busy !== null}
                  onClick={() => run("request-purchase", async () => setPolicyDecision(await api.requestPurchase(id)))}
                >
                  {busy === "request-purchase" ? "Evaluating…" : "Request purchase"}
                </Button>
                {policyDecision && (
                  <PolicyDecisionCard decision={policyDecision} />
                )}
              </Panel>
            )}
          </div>
        )}

        {(intent.status === "APPROVAL_REQUIRED" || intent.status === "REAPPROVAL_REQUIRED") && (
          <Panel>
            <div className="flex items-center gap-2">
              <StatusBadge status={intent.status} />
              <p className="text-sm text-foreground">A human needs to approve this purchase.</p>
            </div>
            {approval && (
              <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-muted">Merchant</dt>
                <dd className="text-foreground">{approval.Merchant}</dd>
                <dt className="text-muted">Amount</dt>
                <dd className="font-mono text-foreground">{formatMoney(approval.Amount)}</dd>
                <dt className="text-muted">Payment source</dt>
                <dd className="text-foreground">{approval.PaymentSourceAlias}</dd>
                <dt className="text-muted">Expires</dt>
                <dd className="text-foreground">{new Date(approval.ExpiresAt).toLocaleTimeString()}</dd>
              </dl>
            )}
            <div className="mt-5 flex gap-3">
              <Button
                disabled={busy !== null || !approval}
                onClick={() =>
                  run("approve", () =>
                    intent.status === "REAPPROVAL_REQUIRED"
                      ? api.reapproveApproval(approval!.ID)
                      : api.approveApproval(approval!.ID)
                  )
                }
              >
                {busy === "approve" ? "Approving…" : "Approve"}
              </Button>
              {intent.status === "APPROVAL_REQUIRED" && (
                <Button
                  variant="secondary"
                  disabled={busy !== null || !approval}
                  onClick={() => run("reject", () => api.rejectApproval(approval!.ID))}
                >
                  Reject
                </Button>
              )}
            </div>
          </Panel>
        )}

        {intent.status === "APPROVED" && (
          <Panel>
            <p className="text-sm text-foreground">Approved — ready to execute against the merchant.</p>
            <Button
              className="mt-4"
              disabled={busy !== null}
              onClick={() => run("execute", () => api.execute(id, crypto.randomUUID()))}
            >
              {busy === "execute" ? "Executing…" : "Execute"}
            </Button>
          </Panel>
        )}

        {intent.status === "POLICY_REJECTED" && (
          <Panel>
            <div className="flex items-center gap-2">
              <StatusBadge status="DENY" />
              <p className="text-sm text-foreground">Policy denied this purchase.</p>
            </div>
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() => run("explain", async () => setPolicyDecision(await api.policyExplain(id)))}
            >
              Why?
            </Button>
            {policyDecision && <PolicyDecisionCard decision={policyDecision} />}
          </Panel>
        )}

        {["EXECUTING", "AUTHENTICATION_REQUIRED"].includes(intent.status) && (
          <Panel>
            <p className="text-sm text-foreground">
              {intent.status === "AUTHENTICATION_REQUIRED"
                ? "Waiting on 3DS/OTP/UPI authentication completed on your own device."
                : "Executing against the merchant connector…"}
            </p>
          </Panel>
        )}

        {["SUCCEEDED", "PARTIALLY_COMPLETED"].includes(intent.status) && order && (
          <Panel>
            <div className="flex items-center gap-2">
              <StatusBadge status={order.status} />
              <p className="text-sm text-foreground">Order placed with {order.merchant}.</p>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-muted">Total</dt>
              <dd className="font-mono text-foreground">{formatMoney(order.total)}</dd>
              <dt className="text-muted">Merchant order</dt>
              <dd className="font-mono text-foreground">{order.merchant_order_id}</dd>
              <dt className="text-muted">Provider mode</dt>
              <dd className="text-foreground">{order.provider_mode}</dd>
            </dl>
          </Panel>
        )}

        {["FAILED", "MERCHANT_INTERVENTION_REQUIRED", "USER_INTERVENTION_REQUIRED", "CANCELLED", "EXPIRED"].includes(intent.status) && (
          <Panel>
            <p className="text-sm text-foreground">This intent ended without an order.</p>
          </Panel>
        )}
      </div>

      <div className="mt-10">
        <button
          type="button"
          onClick={() => run("audit", async () => setAudit(await api.getAuditTrail(id)))}
          className="text-sm font-medium text-primary hover:underline"
        >
          {audit ? "Refresh audit trail" : "Show audit trail"}
        </button>
        {audit && (
          <ol className="mt-4 space-y-3 border-l border-border pl-4">
            {audit.length === 0 && <li className="text-sm text-muted">No events yet.</li>}
            {audit.map((ev) => (
              <li key={ev.event_id} className="text-sm">
                <span className="font-mono text-xs text-muted">
                  {new Date(ev.timestamp).toLocaleTimeString()}
                </span>{" "}
                <span className="text-foreground">{ev.action}</span>
                {ev.result && <span className="text-muted"> · {ev.result}</span>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function QuoteCard({ quote, busy, onSelect }: { quote: Quote; busy: boolean; onSelect: () => void }) {
  return (
    <Panel>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-sm font-semibold text-foreground">{quote.merchant}</p>
          <ul className="mt-1.5 text-xs text-muted">
            {quote.items.map((it) => (
              <li key={it.merchant_product_id}>
                {it.quantity}× {it.name}
              </li>
            ))}
          </ul>
        </div>
        <div className="text-right">
          <p className="font-mono text-sm font-medium text-foreground">
            {formatMoney(quote.final_payable)}
          </p>
          <Button variant="secondary" className="mt-2" disabled={busy} onClick={onSelect}>
            {busy ? "Selecting…" : "Select"}
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function PolicyDecisionCard({ decision }: { decision: PolicyDecision }) {
  return (
    <div className="mt-4 rounded-lg bg-primary-tint/40 p-4">
      <div className="flex items-center gap-2">
        <StatusBadge status={decision.decision} />
        <span className="font-mono text-xs text-muted">{decision.policy_version}</span>
      </div>
      <p className="mt-2 font-mono text-xs text-muted">{decision.reason_codes.join(" · ")}</p>
    </div>
  );
}
