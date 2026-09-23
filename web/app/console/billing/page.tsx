"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import * as api from "@/lib/api-client";
import { openSubscriptionCheckout } from "@/lib/razorpay";
import type { BillingStatus } from "@/lib/types";
import { IconCheck, IconShield, Spinner } from "@/components/icons";
import { ErrorNote, PageHeader, Skeleton } from "@/components/console/ui";

const GROWTH_FEATURES = [
  "5,000 order executions a month, then counted as overage",
  "Real merchant connectors — Swiggy Instamart, Amazon, Flipkart",
  "Email support, 2-business-day response",
];

const STATUS_COPY: Record<string, { label: string; tone: string }> = {
  created: { label: "Checkout not finished", tone: "bg-border text-muted" },
  authenticated: { label: "Active", tone: "bg-primary-tint text-primary" },
  active: { label: "Active", tone: "bg-primary-tint text-primary" },
  pending: { label: "Payment retrying", tone: "bg-accent-tint text-accent" },
  halted: { label: "Payment failed", tone: "bg-danger-tint text-danger" },
  cancelled: { label: "Cancelled", tone: "bg-border text-muted" },
  completed: { label: "Ended", tone: "bg-border text-muted" },
  expired: { label: "Expired", tone: "bg-border text-muted" },
};

function money(minor: number, currency: string) {
  const sym = currency === "INR" ? "₹" : `${currency} `;
  return `${sym}${(minor / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function date(iso?: string) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) : "";
}

function cssColor(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#3f5232";
}

function BillingInner() {
  const params = useSearchParams();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"upgrade" | "cancel" | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [justUpgraded, setJustUpgraded] = useState(false);

  const load = useCallback(async () => {
    try {
      setStatus(await api.getBilling());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load billing");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching from the REST API on mount
    load();
  }, [load]);

  async function upgrade() {
    setBusy("upgrade");
    setError(null);
    try {
      const co = await api.startCheckout();
      const result = await openSubscriptionCheckout({
        keyId: co.key_id,
        subscriptionId: co.subscription_id,
        prefill: co.prefill,
        themeColor: cssColor("--color-primary"),
      });
      if (result) {
        await api.confirmCheckout(result);
        setJustUpgraded(true);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upgrade didn't complete");
    } finally {
      setBusy(null);
    }
  }

  async function cancel() {
    setBusy("cancel");
    setError(null);
    try {
      await api.cancelSubscription();
      setConfirmCancel(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't cancel");
    } finally {
      setBusy(null);
    }
  }

  if (!status) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Plan & billing" />
        <div className="mt-8 space-y-4">
          {error ? <ErrorNote>{error}</ErrorNote> : <Skeleton className="h-40" />}
        </div>
      </div>
    );
  }

  const growth = status.plan === "growth";
  const sub = status.subscription;
  const included = status.entitlement.included_executions;
  const pct = Math.min(100, (status.used_this_month / included) * 100);
  const statusCopy = sub ? STATUS_COPY[sub.status] : undefined;
  const wantsUpgrade = params.get("upgrade") === "1" && !growth;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Plan & billing"
        description="What you pay Algebra. This is separate from what you buy — Algebra never holds or moves money for your purchases."
      />

      {status.test_mode && (
        <p className="mt-6 flex items-center gap-2 rounded-xl bg-accent-tint px-4 py-3 text-sm text-accent">
          <IconShield size={16} /> Razorpay test mode — no real money moves. Use a Razorpay test card or UPI ID success@razorpay.
        </p>
      )}
      {error && (
        <div className="mt-6">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
      <AnimatePresence>
        {justUpgraded && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-6 flex items-center gap-2 rounded-xl bg-primary-tint px-4 py-3 text-sm text-primary"
          >
            <IconCheck size={16} /> You&apos;re on Growth. Thanks for backing Algebra.
          </motion.p>
        )}
      </AnimatePresence>

      <section className="mt-8 rounded-2xl border border-border bg-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted">Current plan</p>
            <p className="font-display mt-1 text-2xl font-semibold tracking-tight text-foreground">{growth ? "Growth" : "Developer"}</p>
            <p className="mt-1 text-sm text-muted">
              {growth
                ? sub?.cancel_at_period_end
                  ? `Cancelled — you keep Growth until ${date(sub.current_period_end)}.`
                  : sub?.current_period_end
                    ? `Renews ${date(sub.current_period_end)} at ${money(status.growth_price_minor_units, status.currency)}.`
                    : `${money(status.growth_price_minor_units, status.currency)} a month.`
                : "Free. Up to 100 order executions a month."}
            </p>
          </div>
          {statusCopy && sub?.status !== "created" && (
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusCopy.tone}`}>{statusCopy.label}</span>
          )}
        </div>

        <div className="mt-6">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted">Order executions this month</span>
            <span className="font-mono text-foreground tabular-nums">
              {status.used_this_month.toLocaleString("en-IN")} <span className="text-muted">/ {included.toLocaleString("en-IN")}</span>
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-border">
            <motion.div
              className={`h-full rounded-full ${pct >= 100 ? "bg-danger" : pct > 80 ? "bg-accent" : "bg-primary"}`}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <p className="mt-2 text-xs text-muted">
            An execution is one order actually placed. Searches, quotes and blocked or cancelled requests don&apos;t count.
            {!growth && status.used_this_month >= included && " You've hit this month's limit — upgrade to keep ordering."}
          </p>
        </div>

        {growth && !sub?.cancel_at_period_end && (
          <div className="mt-6 border-t border-border pt-5">
            {!confirmCancel ? (
              <button type="button" onClick={() => setConfirmCancel(true)} className="text-sm text-muted hover:text-danger">
                Cancel Growth
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-foreground">
                  Cancel at the end of this period{sub?.current_period_end ? ` (${date(sub.current_period_end)})` : ""}?
                </p>
                <button
                  type="button"
                  disabled={busy === "cancel"}
                  onClick={cancel}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-danger px-3.5 text-sm font-medium text-danger-tint disabled:opacity-50"
                >
                  {busy === "cancel" && <Spinner size={14} />} Yes, cancel
                </button>
                <button type="button" onClick={() => setConfirmCancel(false)} className="text-sm text-muted hover:text-foreground">
                  Keep Growth
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {!growth && (
        <section
          className={`mt-6 rounded-2xl border p-6 transition-shadow ${
            wantsUpgrade ? "border-primary bg-primary-tint/50 shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-primary)_12%,transparent)]" : "border-border bg-surface"
          }`}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="font-display text-xl font-semibold tracking-tight text-foreground">Growth</p>
            <p className="text-foreground">
              <span className="font-display text-2xl font-semibold">{money(status.growth_price_minor_units, status.currency)}</span>
              <span className="text-sm text-muted"> / month</span>
            </p>
          </div>
          <ul className="mt-4 space-y-2">
            {GROWTH_FEATURES.map((f) => (
              <li key={f} className="flex gap-2.5 text-sm text-foreground">
                <IconCheck size={16} className="mt-0.5 shrink-0 text-primary" /> {f}
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={!status.checkout_available || busy === "upgrade"}
            onClick={upgrade}
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-tint transition-[opacity,transform] hover:opacity-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {busy === "upgrade" && <Spinner size={15} />}
            {busy === "upgrade" ? "Opening checkout…" : "Upgrade with Razorpay"}
          </button>
          <p className="mt-3 text-xs text-muted">
            {status.checkout_available
              ? "UPI, cards and netbanking via Razorpay. Cancel anytime; you keep Growth until the period ends."
              : "Billing isn't configured on this server yet (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)."}
          </p>
        </section>
      )}
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense>
      <BillingInner />
    </Suspense>
  );
}
