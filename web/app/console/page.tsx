"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import * as api from "@/lib/api-client";
import { firstName, useSession } from "@/lib/session";
import type { ApprovalActivity, IntentActivity } from "@/lib/types";
import { IconArrowRight, IconChat, IconInbox, IconPlus } from "@/components/icons";
import { useConsoleData } from "@/components/console/console-data";
import { ApprovalRow } from "@/components/console/approval-row";
import { IntentList } from "@/components/console/intent-list";
import { ErrorNote, Skeleton, rupees } from "@/components/console/ui";

const PROMPTS = [
  "🥤 Help me purchase a Coke Zero, under ₹100",
  "🧴 Restock toothpaste and shampoo",
  "🍫 Pick up chocolates for a birthday, under ₹500",
];

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Working late" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function OverviewPage() {
  const { user } = useSession();
  const { overview, refreshOverview } = useConsoleData();
  const [approvals, setApprovals] = useState<ApprovalActivity[] | null>(null);
  const [intents, setIntents] = useState<IntentActivity[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [a, i] = await Promise.all([api.listMyApprovals(), api.listMyIntents(8)]);
      setApprovals(a);
      setIntents(i);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your activity");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching from the REST API on mount
    load();
  }, [load]);

  const g = overview?.guardrails;
  const spent = overview?.spent_today.minor_units ?? 0;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-[2rem] leading-tight font-semibold tracking-tight text-foreground">
            {greeting()}, {firstName(user)}
          </h1>
          <p className="mt-1.5 text-[0.95rem] text-muted">
            {approvals && approvals.length > 0
              ? `${approvals.length} purchase${approvals.length === 1 ? " is" : "s are"} waiting on you.`
              : "Nothing needs you right now."}
          </p>
        </div>
        <div className="flex gap-2.5">
          <Link
            href="/console/agent"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-tint transition-[opacity,transform] hover:opacity-95 active:scale-[0.98]"
          >
            <IconChat size={16} /> Open agent
          </Link>
          <Link
            href="/console/new"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border-strong px-4 text-sm font-medium text-foreground transition-colors hover:bg-primary-tint"
          >
            <IconPlus size={16} /> Order by hand
          </Link>
        </div>
      </div>

      {error && (
        <div className="mt-6">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      {/* Today, in one line of plain facts — not a wall of big numbers. */}
      <div className="mt-8 grid overflow-hidden rounded-2xl border border-border bg-surface sm:grid-cols-3 sm:divide-x sm:divide-border">
        <div className="px-5 py-4">
          <p className="text-xs text-muted">Spent today</p>
          <p className="mt-1 text-[0.95rem] text-foreground">
            <span className="font-mono tabular-nums">{rupees(spent)}</span>
            {g && <span className="text-muted"> of {rupees(g.max_per_day_minor_units)}</span>}
          </p>
          <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-border">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: g ? `${Math.min(100, (spent / g.max_per_day_minor_units) * 100)}%` : 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>
        <Link href="/console/guardrails" className="border-t border-border px-5 py-4 transition-colors hover:bg-primary-tint/40 sm:border-t-0">
          <p className="text-xs text-muted">Auto-approves</p>
          <p className="mt-1 text-[0.95rem] text-foreground">
            {!g ? "…" : g.approval_threshold_minor_units <= 1 ? "Nothing — you approve all" : `Under ${rupees(g.approval_threshold_minor_units)}`}
          </p>
          <p className="mt-2 text-xs text-muted">Edit guardrails →</p>
        </Link>
        <Link href="/console/orders" className="border-t border-border px-5 py-4 transition-colors hover:bg-primary-tint/40 sm:border-t-0">
          <p className="text-xs text-muted">Orders placed</p>
          <p className="mt-1 font-mono text-[0.95rem] text-foreground tabular-nums">{overview?.orders_total ?? "…"}</p>
          <p className="mt-2 text-xs text-muted">View orders →</p>
        </Link>
      </div>

      {approvals && approvals.length > 0 && (
        <section className="mt-10">
          <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold text-foreground">
            <IconInbox size={17} className="text-accent" /> Waiting for your approval
          </h2>
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-accent/50 bg-accent-tint/25">
            {approvals.map((a) => (
              <ApprovalRow
                key={a.approval_id}
                a={a}
                onDone={() => {
                  load();
                  refreshOverview();
                }}
              />
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[0.95rem] font-semibold text-foreground">Recent activity</h2>
          <Link href="/console/activity" className="text-sm text-primary hover:underline">
            See all
          </Link>
        </div>
        <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-surface">
          {intents === null ? (
            <div className="space-y-3 p-5">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : intents.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="font-display text-lg font-semibold text-foreground">Your first order starts with a sentence</p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
                Tell the agent what you need. It searches, compares, checks your guardrails, and buys — or asks you first.
              </p>
            </div>
          ) : (
            <IntentList intents={intents} />
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-[0.95rem] font-semibold text-foreground">Try asking</h2>
        <div className="mt-3 flex flex-wrap gap-2.5">
          {PROMPTS.map((p) => (
            <Link
              key={p}
              href={`/console/agent?prompt=${encodeURIComponent(p)}`}
              className="group inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-4 py-2 text-sm text-foreground transition-[border-color,transform] hover:-translate-y-0.5 hover:border-primary/50"
            >
              {p}
              <IconArrowRight size={14} className="text-muted transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
