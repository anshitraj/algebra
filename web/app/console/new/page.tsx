"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import * as api from "@/lib/api-client";
import type { CommerceProfile, GuardrailsResponse } from "@/lib/types";
import { IconPlus, IconX, Spinner } from "@/components/icons";
import { ErrorNote, PageHeader, rupees } from "@/components/console/ui";

type ItemRow = { id: number; query: string; quantity: number };

const CATEGORIES = [
  ["groceries", "Groceries"],
  ["food_delivery", "Food delivery"],
  ["pharmacy", "Pharmacy"],
  ["electronics", "Electronics"],
  ["fashion", "Fashion"],
  ["home", "Home & kitchen"],
  ["beauty", "Beauty & care"],
  ["subscriptions", "Subscriptions"],
  ["gift_cards", "Gift cards"],
] as const;

const field =
  "h-11 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-[0.95rem] text-foreground placeholder:text-muted/80 focus-visible:border-primary focus-visible:outline-none";


export default function OrderByHandPage() {
  const router = useRouter();
  const nextId = useRef(2);
  const [items, setItems] = useState<ItemRow[]>([{ id: 1, query: "", quantity: 1 }]);
  const [budget, setBudget] = useState("");
  const [category, setCategory] = useState("groceries");
  const [profile, setProfile] = useState<CommerceProfile | null>(null);
  const [guardrails, setGuardrails] = useState<GuardrailsResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getCommerceProfile().then(setProfile).catch(() => setProfile(null));
    api.getGuardrails().then(setGuardrails).catch(() => setGuardrails(null));
  }, []);

  function update(id: number, patch: Partial<ItemRow>) {
    setItems((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const valid = items.filter((it) => it.query.trim()).map((it) => ({ query: it.query.trim(), quantity: Math.max(1, it.quantity) }));
    if (valid.length === 0) {
      setError("Add at least one item.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const preferred = (profile?.preferences?.shopping as { preferred_merchants?: string[] } | undefined)?.preferred_merchants;
      const intent = await api.createIntent(
        valid,
        {
          // Every intent needs a ceiling; blank means "up to my per-purchase cap".
          max_total_minor_units: budget ? Math.round(Number(budget) * 100) : guardrails?.max_per_purchase_minor_units ?? 200000,
          currency: "INR",
          category,
          payment_profile: profile?.default_payment_alias || "payment:personal",
          delivery_profile: profile?.default_shipping_alias || "shipping:home",
          preferred_merchants: preferred?.length ? preferred : undefined,
        },
        crypto.randomUUID()
      );
      // Go straight to comparing prices — creating is never the goal.
      await api.discover(intent.intent_id).catch(() => undefined);
      router.push(`/console/intents/${intent.intent_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start the order");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Order by hand"
        description="List what you want. Algebra compares every connected store, you pick the offer, and your guardrails check it before anything is bought."
      />

      <form onSubmit={handleSubmit} className="mt-10 space-y-8">
        <fieldset>
          <legend className="text-[0.95rem] font-semibold text-foreground">Items</legend>
          <ul className="mt-3 space-y-2.5">
            <AnimatePresence initial={false}>
              {items.map((row, i) => (
                <motion.li
                  key={row.id}
                  layout
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2.5"
                >
                  <label className="sr-only" htmlFor={`item-${row.id}`}>
                    Item {i + 1}
                  </label>
                  <input
                    id={`item-${row.id}`}
                    value={row.query}
                    onChange={(e) => update(row.id, { query: e.target.value })}
                    placeholder={i === 0 ? "e.g. Coke Zero 750ml" : "Another item"}
                    autoFocus={i === items.length - 1 && i > 0}
                    className={`${field} min-w-0 flex-1`}
                  />
                  <div className="flex h-11 shrink-0 items-center rounded-xl border border-border-strong bg-surface" role="group" aria-label={`Quantity for item ${i + 1}`}>
                    <button type="button" onClick={() => update(row.id, { quantity: Math.max(1, row.quantity - 1) })} className="h-full w-9 text-muted hover:text-foreground" aria-label="Fewer">
                      −
                    </button>
                    <span className="w-7 text-center font-mono text-sm text-foreground tabular-nums">{row.quantity}</span>
                    <button type="button" onClick={() => update(row.id, { quantity: Math.min(99, row.quantity + 1) })} className="h-full w-9 text-muted hover:text-foreground" aria-label="More">
                      +
                    </button>
                  </div>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setItems((rows) => rows.filter((r) => r.id !== row.id))}
                      className="flex h-11 w-9 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-danger-tint hover:text-danger"
                      aria-label={`Remove item ${i + 1}`}
                    >
                      <IconX size={15} />
                    </button>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          <button
            type="button"
            onClick={() => setItems((rows) => [...rows, { id: nextId.current++, query: "", quantity: 1 }])}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <IconPlus size={15} /> Add item
          </button>
        </fieldset>

        <div className="grid gap-6 sm:grid-cols-2">
          <label className="block">
            <span className="text-[0.95rem] font-semibold text-foreground">Budget</span>
            <span className="mt-1 block text-sm text-muted">
              {guardrails ? `Blank = up to your ${rupees(guardrails.max_per_purchase_minor_units)} per-purchase cap.` : "Offers above it are skipped."}
            </span>
            <span className="mt-2.5 flex h-11 items-center rounded-xl border border-border-strong bg-surface px-3.5 focus-within:border-primary">
              <span className="text-muted">₹</span>
              <input
                inputMode="numeric"
                value={budget}
                onChange={(e) => setBudget(e.target.value.replace(/[^\d]/g, ""))}
                placeholder={guardrails ? String(guardrails.max_per_purchase_minor_units / 100) : "2000"}
                className="ml-1.5 w-full bg-transparent font-mono text-[0.95rem] text-foreground placeholder:font-sans placeholder:text-muted/80 focus:outline-none"
              />
            </span>
          </label>
          <label className="block">
            <span className="text-[0.95rem] font-semibold text-foreground">Category</span>
            <span className="mt-1 block text-sm text-muted">Your never-buy list is checked against this.</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${field} mt-2.5`}>
              {CATEGORIES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="text-sm text-muted">
          Delivers to <span className="text-foreground">{profile?.default_shipping_alias === "shipping:home" ? "Home" : "your default address"}</span>, paid with{" "}
          <span className="text-foreground">your default payment method</span>. Change these under Profile.
        </p>

        {error && <ErrorNote>{error}</ErrorNote>}

        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[0.95rem] font-medium text-primary-tint transition-[opacity,transform] hover:opacity-95 active:scale-[0.99] disabled:opacity-60"
        >
          {busy && <Spinner size={15} />}
          {busy ? "Comparing stores…" : "Compare prices"}
        </button>
      </form>
    </div>
  );
}
