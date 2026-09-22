"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as api from "@/lib/api-client";
import { trackIntent } from "@/lib/intent-history";
import { Button, Field, Input } from "@/components/console/ui";

type ItemRow = { query: string; quantity: number };

const EXAMPLE_ITEMS: ItemRow[] = [
  { query: "Coke Zero", quantity: 1 },
  { query: "chips", quantity: 1 },
];

export default function NewIntentPage() {
  const router = useRouter();
  const [items, setItems] = useState<ItemRow[]>(EXAMPLE_ITEMS);
  const [maxTotal, setMaxTotal] = useState("400");
  const [category, setCategory] = useState("groceries");
  const [paymentProfile, setPaymentProfile] = useState("payment:personal");
  const [deliveryProfile, setDeliveryProfile] = useState("shipping:home");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateItem(i: number, patch: Partial<ItemRow>) {
    setItems((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const validItems = items.filter((it) => it.query.trim());
      if (validItems.length === 0) throw new Error("Add at least one item.");

      const intent = await api.createIntent(
        validItems,
        {
          max_total_minor_units: maxTotal ? Math.round(parseFloat(maxTotal) * 100) : undefined,
          currency: "INR",
          category: category || undefined,
          payment_profile: paymentProfile || undefined,
          delivery_profile: deliveryProfile || undefined,
        },
        crypto.randomUUID()
      );

      trackIntent({
        id: intent.intent_id,
        summary: validItems.map((it) => `${it.quantity}× ${it.query}`).join(", "),
        createdAt: new Date().toISOString(),
      });

      router.push(`/console/intents/${intent.intent_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create intent");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
        New purchase intent
      </h1>
      <p className="mt-1.5 text-sm text-muted">
        Turns into a <code className="font-mono text-xs">PurchaseIntent</code>{" "}
        via <code className="font-mono text-xs">POST /api/v1/intents</code>.
        The mock connector understands groceries — Coke Zero, chips, pasta,
        tomato sauce, garlic bread, parmesan — and a ₹500 gift card, which
        policy blocks by category.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div>
          <span className="text-sm font-medium text-foreground">Items</span>
          <div className="mt-2 space-y-2">
            {items.map((row, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={row.query}
                  onChange={(e) => updateItem(i, { query: e.target.value })}
                  placeholder="e.g. Coke Zero"
                  className="flex-1"
                />
                <Input
                  type="number"
                  min={1}
                  value={row.quantity}
                  onChange={(e) => updateItem(i, { quantity: Number(e.target.value) || 1 })}
                  className="w-20"
                />
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setItems((rows) => rows.filter((_, idx) => idx !== i))}
                    className="px-2 text-sm text-muted hover:text-danger"
                    aria-label="Remove item"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setItems((rows) => [...rows, { query: "", quantity: 1 }])}
            className="mt-2 text-sm font-medium text-primary hover:underline"
          >
            + Add item
          </button>
        </div>

        <Field label="Budget (₹)" hint="Constraints.MaxTotalMinorUnits — over this, or over the ₹2,000 hard cap, the intent is denied.">
          <Input
            type="number"
            value={maxTotal}
            onChange={(e) => setMaxTotal(e.target.value)}
            min={0}
          />
        </Field>

        <Field label="Category" hint='Try "gift_cards" with the ₹500 Gift Card item to see a DENY.'>
          <Input value={category} onChange={(e) => setCategory(e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Payment profile">
            <Input value={paymentProfile} onChange={(e) => setPaymentProfile(e.target.value)} />
          </Field>
          <Field label="Delivery profile">
            <Input value={deliveryProfile} onChange={(e) => setDeliveryProfile(e.target.value)} />
          </Field>
        </div>

        {error && (
          <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Creating…" : "Create intent"}
        </Button>
      </form>
    </div>
  );
}
