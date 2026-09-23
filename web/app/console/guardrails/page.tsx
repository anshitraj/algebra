"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import * as api from "@/lib/api-client";
import type { Guardrails, GuardrailsResponse } from "@/lib/types";
import { IconCheck, Spinner } from "@/components/icons";
import { useConsoleData } from "@/components/console/console-data";
import { ErrorNote, PageHeader, Skeleton, rupees } from "@/components/console/ui";

const THRESHOLD_PRESETS = [0, 50000, 100000, 250000, 500000];

function toRupees(minor: number) {
  return String(Math.round(minor / 100));
}
function toMinor(r: string) {
  const n = Number(r.replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n * 100 : 0;
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-border py-7 md:grid-cols-[240px_1fr] md:gap-10">
      <div>
        <h2 className="text-[0.95rem] font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">{hint}</p>
      </div>
      <div>{children}</div>
    </section>
  );
}

function RupeeInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <label className="block max-w-[220px]">
      <span className="sr-only">{label}</span>
      <span className="flex h-11 items-center rounded-xl border border-border-strong bg-surface px-3.5 focus-within:border-primary">
        <span className="text-muted">₹</span>
        <input
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
          className="ml-1.5 w-full bg-transparent font-mono text-[0.95rem] text-foreground tabular-nums focus:outline-none"
        />
      </span>
    </label>
  );
}

export default function GuardrailsPage() {
  const { refreshOverview } = useConsoleData();
  const [data, setData] = useState<GuardrailsResponse | null>(null);
  const [threshold, setThreshold] = useState(0);
  const [perPurchase, setPerPurchase] = useState("");
  const [daily, setDaily] = useState("");
  const [blocked, setBlocked] = useState<string[]>([]);
  const [intl, setIntl] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function hydrate(g: GuardrailsResponse) {
    setData(g);
    setThreshold(g.approval_threshold_minor_units);
    setPerPurchase(toRupees(g.max_per_purchase_minor_units));
    setDaily(toRupees(g.max_per_day_minor_units));
    setBlocked(g.blocked_categories ?? []);
    setIntl(g.international_requires_approval);
  }

  useEffect(() => {
    api
      .getGuardrails()
      .then(hydrate)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load guardrails"));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    const next: Guardrails = {
      currency: data.currency || "INR",
      approval_threshold_minor_units: threshold,
      max_per_purchase_minor_units: toMinor(perPurchase),
      max_per_day_minor_units: toMinor(daily),
      blocked_categories: blocked,
      blocked_merchants: data.blocked_merchants ?? [],
      international_requires_approval: intl,
    };
    try {
      hydrate(await api.setGuardrails(next));
      setSaved(true);
      refreshOverview();
      window.setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Guardrails"
        description="The rules every purchase is checked against on Algebra's server, before a rupee moves. Your agent can read these. It can't change them, and it can't talk its way past them."
      />

      {!data && !error && (
        <div className="mt-10 space-y-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      )}
      {error && !data && (
        <div className="mt-8">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      {data && (
        <form onSubmit={save} className="mt-10">
          <Section title="Ask me before buying" hint="At or above this amount, a purchase waits for your approval. Below it, policy approves on its own.">
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Approval threshold">
              {THRESHOLD_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={threshold === p}
                  onClick={() => setThreshold(p)}
                  className={`h-10 rounded-full border px-4 text-sm transition-colors ${
                    threshold === p ? "border-primary bg-primary text-primary-tint" : "border-border-strong bg-surface text-foreground hover:border-foreground/35"
                  }`}
                >
                  {p === 0 ? "Every purchase" : `Above ${rupees(p)}`}
                </button>
              ))}
            </div>
            {!THRESHOLD_PRESETS.includes(threshold) && (
              <p className="mt-3 text-sm text-muted">Custom: above {rupees(threshold)}</p>
            )}
          </Section>

          <Section title="Hard caps" hint="Denied outright above these — even your own approval can't push a purchase past them.">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-sm text-foreground">Per purchase</p>
                <RupeeInput label="Per purchase cap" value={perPurchase} onChange={setPerPurchase} />
              </div>
              <div>
                <p className="mb-2 text-sm text-foreground">Per day</p>
                <RupeeInput label="Daily cap" value={daily} onChange={setDaily} />
                <p className="mt-1.5 text-xs text-muted">Up to {rupees(data.platform_max_per_day_minor_units)}</p>
              </div>
            </div>
          </Section>

          <Section title="Never buy" hint="Blocked categories, whatever the price.">
            <div className="flex flex-wrap gap-2">
              {data.known_categories.map((c) => {
                const on = blocked.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => setBlocked((b) => (on ? b.filter((x) => x !== c) : [...b, c]))}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm capitalize transition-colors ${
                      on ? "border-danger/60 bg-danger-tint text-danger" : "border-border-strong bg-surface text-foreground hover:border-foreground/35"
                    }`}
                  >
                    {on && <IconCheck size={13} strokeWidth={2.4} />}
                    {c.replace(/_/g, " ")}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="International merchants" hint="Stores outside India are held for your approval.">
            <button
              type="button"
              role="switch"
              aria-checked={intl}
              onClick={() => setIntl((v) => !v)}
              className="inline-flex items-center gap-3 text-sm text-foreground"
            >
              <span className={`relative h-6 w-11 rounded-full transition-colors ${intl ? "bg-primary" : "bg-border-strong"}`}>
                <motion.span
                  className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-surface shadow"
                  animate={{ x: intl ? 20 : 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 32 }}
                />
              </span>
              {intl ? "Ask me first" : "Allow within my limits"}
            </button>
          </Section>

          <div className="sticky bottom-0 -mx-5 flex items-center gap-4 border-t border-border bg-background/90 px-5 py-4 backdrop-blur md:-mx-10 md:px-10">
            {error && <p className="text-sm text-danger">{error}</p>}
            <AnimatePresence>
              {saved && (
                <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 text-sm text-primary">
                  <IconCheck size={15} /> Saved — live on the next purchase
                </motion.p>
              )}
            </AnimatePresence>
            <button
              type="submit"
              disabled={busy}
              className="ml-auto inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-tint transition-[opacity,transform] hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
            >
              {busy && <Spinner size={14} />} Save guardrails
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
