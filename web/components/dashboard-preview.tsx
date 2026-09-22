"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Logo } from "./logo";

const STAGES = ["Agent", "Discovery", "Policy", "Approval", "Merchant", "Order"] as const;

const EVENTS = [
  { stage: 0, text: "IntentCreated", detail: "created" },
  { stage: 1, text: "DiscoveryStarted", detail: "fanning out to merchant connectors" },
  { stage: 1, text: "QuoteCreated", detail: "quotes available" },
  { stage: 2, text: "PolicyEvaluationStarted", detail: "evaluating mock" },
  { stage: 2, text: "PolicyEvaluated", detail: "ALLOW · AMOUNT_OK · MERCHANT_OK" },
  { stage: 3, text: "ApprovalGranted", detail: "auto-approved under policy" },
  { stage: 4, text: "PrivacyProfileResolved", detail: "shipping:home → checkout" },
  { stage: 4, text: "ExecutionStarted", detail: "mock" },
  { stage: 5, text: "OrderCompleted", detail: "₹97.00 · mock" },
] as const;

const NAV = ["Dashboard", "New intent", "Approvals", "Orders", "Payment sources", "Merchants"];

const TICK_MS = 850;
const HOLD_MS = 2200;

const VISIBLE_LOG_LINES = 5;

export function DashboardPreview() {
  const [step, setStep] = useState(0);

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

  const allVisible = EVENTS.slice(0, step);
  const visibleEvents = allVisible.slice(-VISIBLE_LOG_LINES);
  const stage = step === 0 ? 0 : EVENTS[Math.min(step, EVENTS.length) - 1].stage;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgba(32,36,29,0.06),0_24px_48px_-24px_rgba(32,36,29,0.28)]">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Logo size={16} className="text-muted" />
        <span className="rounded-md bg-background px-3 py-1 font-mono text-xs text-muted">
          algebra.dev/console
        </span>
      </div>

      <div className="flex flex-col md:flex-row">
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-3 py-2 md:w-44 md:flex-col md:gap-0.5 md:overflow-visible md:border-b-0 md:border-r md:px-3 md:py-4">
          {NAV.map((label) => (
            <span
              key={label}
              className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs whitespace-nowrap ${
                label === "Dashboard"
                  ? "bg-primary-tint font-medium text-primary"
                  : "text-muted"
              }`}
            >
              {label}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1 p-5 md:p-7">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-display text-sm font-semibold text-foreground">
                Coke Zero + chips, under ₹400
              </p>
              <p className="mt-0.5 font-mono text-[0.6875rem] text-muted">
                pi_0dedd0d3-6c8e-40f9-a207-330ca4b2b346
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 font-mono text-[0.6875rem] font-medium ${
                step >= EVENTS.length
                  ? "bg-primary-tint text-primary"
                  : "bg-accent-tint text-accent"
              }`}
            >
              {step >= EVENTS.length ? "SUCCEEDED" : STAGES[stage].toUpperCase()}
            </span>
          </div>

          <ol className="mt-5 flex items-center gap-1">
            {STAGES.map((s, i) => (
              <li key={s} className="flex flex-1 items-center gap-1 last:flex-none">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-300 ${
                    i < stage || step >= EVENTS.length
                      ? "bg-primary"
                      : i === stage
                        ? "bg-accent"
                        : "bg-border-strong"
                  }`}
                />
                {i < STAGES.length - 1 && (
                  <span
                    className={`h-px flex-1 transition-colors duration-300 ${
                      i < stage || step >= EVENTS.length ? "bg-primary" : "bg-border"
                    }`}
                  />
                )}
              </li>
            ))}
          </ol>

          <div className="relative mt-6 h-[168px] rounded-lg bg-background px-4 py-3">
            <p className="font-mono text-[0.6875rem] text-muted">audit trail</p>
            <ol className="mt-2 h-[118px] space-y-1.5 overflow-hidden">
              {visibleEvents.map((ev) => (
                <motion.li
                  key={ev.text}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25 }}
                  className="font-mono text-[0.6875rem] leading-relaxed"
                >
                  <span className="text-foreground">{ev.text}</span>
                  <span className="text-muted"> · {ev.detail}</span>
                </motion.li>
              ))}
            </ol>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 rounded-b-lg bg-gradient-to-t from-background to-transparent" />
          </div>
        </div>
      </div>
    </div>
  );
}
