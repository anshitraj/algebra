"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import * as api from "@/lib/api-client";
import type { CommerceProfile, ShippingProfile } from "@/lib/types";
import { IconCheck, IconMapPin, IconRefresh, Spinner } from "@/components/icons";
import { ErrorNote, PageHeader, Skeleton } from "@/components/console/ui";

const LABELS: Record<string, string> = {
  shops_for: "Shops for",
  priority: "Picks by",
  household: "Household",
  approval_threshold: "Asks above",
  daily_limit: "Daily cap",
  never_buy: "Never buys",
  preferred_merchants: "Stores first",
  dietary: "Diet",
};

function formatValue(key: string, v: unknown): string {
  if ((key === "approval_threshold" || key === "daily_limit") && typeof v === "number") {
    return v <= 1 ? "every purchase" : `₹${(v / 100).toLocaleString("en-IN")}`;
  }
  if (Array.isArray(v)) return v.length ? v.map((x) => String(x).replace(/_/g, " ")).join(", ") : "—";
  if (typeof v === "string") return v.replace(/_/g, " ");
  return JSON.stringify(v);
}

const EMPTY_ADDRESS: ShippingProfile = { recipient_name: "", line1: "", line2: "", city: "", state: "", postal_code: "", country: "IN", phone: "" };

export default function ProfilePage() {
  const [profile, setProfile] = useState<CommerceProfile | null>(null);
  const [aliases, setAliases] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState<ShippingProfile>(EMPTY_ADDRESS);
  const [savingAddr, setSavingAddr] = useState(false);
  const [addrSaved, setAddrSaved] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, a] = await Promise.all([api.getCommerceProfile(), api.listShippingAliases()]);
      setProfile(p);
      setAliases(a ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your profile");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching from the REST API on mount
    load();
  }, [load]);

  async function saveAddress(e: React.FormEvent) {
    e.preventDefault();
    setSavingAddr(true);
    setError(null);
    try {
      await api.createShippingProfile("shipping:home", address);
      await api.setCommerceProfileDefaults("shipping:home", profile?.default_payment_alias || "payment:personal");
      setAddress(EMPTY_ADDRESS);
      setEditing(false);
      setAddrSaved(true);
      window.setTimeout(() => setAddrSaved(false), 2500);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the address");
    } finally {
      setSavingAddr(false);
    }
  }

  const prefs = profile?.preferences ?? {};
  const hasHome = aliases?.includes("shipping:home");
  const field =
    "h-11 w-full rounded-xl border border-border-strong bg-background px-3.5 text-[0.95rem] text-foreground placeholder:text-muted/80 focus-visible:border-primary focus-visible:outline-none";

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Profile & address"
        description="What your agent knows about how you shop, and where orders go. Preferences are safe to share with the agent; your address never is — it only ever sees “home”."
        actions={
          <Link
            href="/onboarding"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border-strong px-4 text-sm font-medium text-foreground hover:bg-primary-tint"
          >
            <IconRefresh size={15} /> Redo setup
          </Link>
        }
      />
      {error && (
        <div className="mt-6">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-[0.95rem] font-semibold text-foreground">What your agent knows</h2>
        <p className="mt-1 text-sm text-muted">From your setup answers, plus anything you told the agent to remember.</p>
        <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-surface">
          {!profile ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
            </div>
          ) : Object.keys(prefs).length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted">
              Nothing yet. Mention a preference to the agent (&ldquo;I wear size L&rdquo;) and it&apos;ll remember.
            </p>
          ) : (
            <dl className="divide-y divide-border">
              {Object.entries(prefs).flatMap(([cat, attrs]) =>
                Object.entries(attrs).map(([k, v]) => (
                  <div key={`${cat}.${k}`} className="grid grid-cols-[140px_1fr] gap-4 px-5 py-3 sm:grid-cols-[180px_1fr]">
                    <dt className="text-sm text-muted">{LABELS[k] ?? `${cat} · ${k.replace(/_/g, " ")}`}</dt>
                    <dd className="text-sm text-foreground capitalize">{formatValue(k, v)}</dd>
                  </div>
                ))
              )}
            </dl>
          )}
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[0.95rem] font-semibold text-foreground">Delivery address</h2>
          {addrSaved && (
            <span className="flex items-center gap-1 text-sm text-primary">
              <IconCheck size={14} /> Saved
            </span>
          )}
        </div>
        <div className="mt-3 rounded-2xl border border-border bg-surface p-5">
          {aliases === null ? (
            <Skeleton className="h-10" />
          ) : hasHome && !editing ? (
            <div className="flex items-center gap-3.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-tint text-primary">
                <IconMapPin size={18} />
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Home</p>
                <p className="text-xs text-muted">Encrypted on file. Only a merchant sees it, only at checkout.</p>
              </div>
              <button type="button" onClick={() => setEditing(true)} className="text-sm font-medium text-primary hover:underline">
                Replace
              </button>
            </div>
          ) : (
            <form onSubmit={saveAddress} className="grid gap-3 sm:grid-cols-2">
              <input className={field} required placeholder="Recipient name" autoComplete="name" value={address.recipient_name} onChange={(e) => setAddress({ ...address, recipient_name: e.target.value })} />
              <input className={field} placeholder="Phone" autoComplete="tel" inputMode="tel" value={address.phone} onChange={(e) => setAddress({ ...address, phone: e.target.value })} />
              <input className={`${field} sm:col-span-2`} required placeholder="Flat, building, street" autoComplete="street-address" value={address.line1} onChange={(e) => setAddress({ ...address, line1: e.target.value })} />
              <input className={field} required placeholder="City" autoComplete="address-level2" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <input className={field} placeholder="State" autoComplete="address-level1" value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} />
                <input className={field} required placeholder="PIN" inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="postal-code" value={address.postal_code} onChange={(e) => setAddress({ ...address, postal_code: e.target.value })} />
              </div>
              <div className="flex gap-2.5 sm:col-span-2">
                <button type="submit" disabled={savingAddr} className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-tint disabled:opacity-50">
                  {savingAddr && <Spinner size={14} />} Save as home
                </button>
                {hasHome && (
                  <button type="button" onClick={() => setEditing(false)} className="h-10 rounded-xl px-4 text-sm text-muted hover:text-foreground">
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
