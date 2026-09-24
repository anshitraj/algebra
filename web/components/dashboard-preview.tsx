"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Logo } from "./logo";
import { StoreLogo } from "./store-logo";
import { IconCheck } from "./icons";

// An illustrative run of the console: the agent asks three stores for a
// quote, policy clears the best one, the order goes through. Prices are
// examples (the panel says so); the stages and audit events are the real
// ones Algebra records.

const STAGES = ["Agent", "Discovery", "Policy", "Approval", "Merchant", "Order"] as const;

const EVENTS = [
  { stage: 0, text: "IntentCreated", detail: "Coke Zero + chips · budget ₹400" },
  { stage: 1, text: "DiscoveryStarted", detail: "Blinkit · Zepto · Swiggy Instamart" },
  { stage: 1, text: "QuoteCreated", detail: "3 quotes" },
  { stage: 2, text: "PolicyEvaluationStarted", detail: "₹212 at Zepto" },
  { stage: 2, text: "PolicyEvaluated", detail: "ALLOW · AMOUNT_OK · MERCHANT_OK" },
  { stage: 3, text: "ApprovalGranted", detail: "under your ₹1,000 line" },
  { stage: 4, text: "PrivacyProfileResolved", detail: "shipping:home → Zepto" },
  { stage: 4, text: "ExecutionStarted", detail: "Zepto" },
  { stage: 5, text: "OrderCompleted", detail: "₹212.00 · arriving in 11 min" },
] as const;

const QUOTES = [
  { store: "blinkit", name: "Blinkit", items: "Coke Zero 300ml ×4 · Lay's 90g ×2", total: "₹228", eta: "9 min" },
  { store: "zepto", name: "Zepto", items: "Coke Zero 300ml ×4 · Lay's 90g ×2", total: "₹212", eta: "11 min", best: true },
  { store: "swiggy_instamart", name: "Swiggy Instamart", items: "Coke Zero 300ml ×4 · Lay's 90g ×2", total: "₹236", eta: "14 min" },
];

const NAV = ["Agent", "Overview", "Approvals", "Orders", "Stores", "Guardrails"];

const TICK_MS = 900;
const HOLD_MS = 2600;
const VISIBLE_LOG_LINES = 5;
const EASE = [0.16, 1, 0.3, 1] as const;

export function DashboardPreview() {
  const [step, setStep] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    let i = 0;
    let timeout: ReturnType<typeof setTimeout>;
    const advance = () => {
      i = i >= EVENTS.length ? 0 : i + 1;
      setStep(i);
      timeout = setTimeout(advance, i === EVENTS.length ? HOLD_MS : TICK_MS);
    };
    timeout = setTimeout(advance, TICK_MS);
    return () => clearTimeout(timeout);
  }, []);

  const done = step >= EVENTS.length;
  const stage = step === 0 ? 0 : EVENTS[Math.min(step, EVENTS.length) - 1].stage;
  const visibleEvents = EVENTS.slice(0, step).slice(-VISIBLE_LOG_LINES);
  const searching = step === 2;
  const quotesIn = step >= 3;
  const picked = step >= 5;

  return (
    <div className="brand-frame overflow-hidden rounded-2xl">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Logo size={16} className="text-primary" />
        <span className="rounded-md bg-background px-3 py-1 font-mono text-xs text-muted">app.algebra/console/agent</span>
        <span className="ml-auto text-[0.6875rem] text-muted">Illustrative prices</span>
      </div>

      <div className="flex flex-col md:flex-row">
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-3 py-2 md:w-40 md:flex-col md:gap-0.5 md:overflow-visible md:border-r md:border-b-0 md:px-3 md:py-4">
          {NAV.map((label) => (
            <span
              key={label}
              className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs whitespace-nowrap ${label === "Agent" ? "bg-primary-tint font-medium text-primary" : "text-muted"}`}
            >
              {label}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1 p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="font-display text-sm font-semibold text-foreground">Coke Zero + chips for tonight, under ₹400</p>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-[0.6875rem] font-medium transition-colors duration-300 ${
                done ? "bg-primary-tint text-primary" : "bg-accent-tint text-accent"
              }`}
            >
              {done ? "ORDERED" : STAGES[stage].toUpperCase()}
            </span>
          </div>

          <ol className="mt-4 flex items-center gap-1" aria-hidden="true">
            {STAGES.map((s, i) => (
              <li key={s} className="flex flex-1 items-center gap-1 last:flex-none">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-300 ${
                    i < stage || done ? "bg-primary" : i === stage ? "bg-accent" : "bg-border-strong"
                  }`}
                />
                {i < STAGES.length - 1 && (
                  <span className={`h-px flex-1 transition-colors duration-300 ${i < stage || done ? "bg-primary" : "bg-border"}`} />
                )}
              </li>
            ))}
          </ol>

          <div className="mt-5 grid gap-4 md:grid-cols-[1.25fr_1fr]">
            {/* Quotes: the stores answering, then the pick. */}
            <div className="rounded-xl border border-border bg-background/60">
              <p className="flex items-center gap-2 border-b border-border px-3.5 py-2 text-[0.6875rem] text-muted">
                Quotes
                {searching && (
                  <span className="flex items-center gap-1">
                    {QUOTES.map((q, i) => (
                      <motion.span
                        key={q.store}
                        animate={reduce ? undefined : { y: [0, -2, 0] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                      >
                        <StoreLogo store={q.store} size={14} />
                      </motion.span>
                    ))}
                    <span className="ml-1">asking stores…</span>
                  </span>
                )}
              </p>
              <ul className="h-[156px] divide-y divide-border">
                <AnimatePresence initial={false}>
                  {quotesIn &&
                    QUOTES.map((q, i) => {
                      const chosen = picked && q.best;
                      return (
                        <motion.li
                          key={q.store}
                          initial={{ opacity: 0, y: reduce ? 0 : 6 }}
                          animate={{ opacity: picked && !q.best ? 0.55 : 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.35, delay: i * 0.12, ease: EASE }}
                          className={`flex items-center gap-3 px-3.5 py-2.5 transition-colors duration-300 ${chosen ? "bg-primary-tint/70" : ""}`}
                        >
                          <StoreLogo store={q.store} size={30} />
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                              {q.name}
                              {chosen && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-primary px-1.5 py-px text-[0.625rem] font-medium text-primary-tint">
                                  <IconCheck size={9} strokeWidth={3} /> Best total
                                </span>
                              )}
                            </p>
                            <p className="truncate text-[0.6875rem] text-muted">{q.items}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-mono text-xs text-foreground tabular-nums">{q.total}</p>
                            <p className="text-[0.625rem] text-muted">{q.eta}</p>
                          </div>
                        </motion.li>
                      );
                    })}
                </AnimatePresence>
              </ul>
            </div>

            {/* The audit trail underneath it, as recorded. */}
            <div className="relative h-[190px] rounded-xl bg-background px-3.5 py-2.5">
              <p className="text-[0.6875rem] text-muted">Audit trail</p>
              <ol className="mt-2 h-[150px] space-y-1.5 overflow-hidden">
                {visibleEvents.map((ev) => (
                  <motion.li
                    key={ev.text}
                    initial={{ opacity: 0, x: reduce ? 0 : -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25 }}
                    className="font-mono text-[0.6875rem] leading-relaxed"
                  >
                    <span className="text-foreground">{ev.text}</span>
                    <span className="text-muted"> · {ev.detail}</span>
                  </motion.li>
                ))}
              </ol>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 rounded-b-xl bg-gradient-to-t from-background to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
