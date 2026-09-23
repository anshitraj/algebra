"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import * as api from "@/lib/api-client";
import { firstName, useSession } from "@/lib/session";
import type { OnboardingAnswers } from "@/lib/types";
import { Logo } from "@/components/logo";
import { IconArrowLeft, IconArrowRight, IconCheck, IconMapPin, Spinner } from "@/components/icons";
import {
  DAILY_CAPS,
  DIETARY,
  FOOD_CATEGORIES,
  HOUSEHOLDS,
  NEVER_BUY,
  PRIORITIES,
  STORES,
  THRESHOLDS,
  USE_CASES,
  type Choice,
  joinList,
  labelOf,
  rupees,
} from "./options";

type Address = { recipient_name: string; phone: string; line1: string; city: string; state: string; postal_code: string };

type Answers = {
  name: string;
  useCases: string[];
  priority: string;
  household: string;
  dietary: string[];
  threshold: string;
  dailyCap: string;
  neverBuy: string[];
  stores: string[];
  address: Address;
  skipAddress: boolean;
};

const STEPS = [
  { id: "shop", title: "What should your agent shop for?", sub: "Pick everything that applies. You can change this any time." },
  { id: "style", title: "How should it choose?", sub: "When three stores have it, this decides which one wins." },
  { id: "limits", title: "When should it check with you?", sub: "These become real policy rules. The agent can't argue with them." },
  { id: "deliver", title: "Where should orders go?", sub: "Encrypted at rest. The agent only ever sees “home”, never the address." },
] as const;

const EASE = [0.16, 1, 0.3, 1] as const;

function addressComplete(a: Address) {
  return a.recipient_name.trim() && a.line1.trim() && a.city.trim() && /^\d{6}$/.test(a.postal_code.trim());
}

function toggle(list: string[], v: string) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function OnboardingFlow() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const { user, status, setUser } = useSession();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [a, setA] = useState<Answers>({
    name: "",
    useCases: [],
    priority: "",
    household: "",
    dietary: [],
    threshold: "100000",
    dailyCap: "500000",
    neverBuy: ["gift_cards"],
    stores: [],
    address: { recipient_name: "", phone: "", line1: "", city: "", state: "", postal_code: "" },
    skipAddress: false,
  });

  const needsName = status === "authenticated" && !user?.name;
  const wantsDiet = a.useCases.some((c) => FOOD_CATEGORIES.includes(c));
  const neverBuyChoices = NEVER_BUY.filter((c) => !a.useCases.includes(c.value));

  const valid = [
    a.useCases.length > 0,
    !!a.priority,
    true,
    a.skipAddress || !!addressComplete(a.address),
  ][step];

  const buildAnswers = useCallback(
    (skipping: boolean): OnboardingAnswers => {
      const cap = Number(a.dailyCap);
      return {
        name: a.name.trim() || undefined,
        use_cases: skipping ? [] : a.useCases,
        priority: a.priority || "best_value",
        household: a.household || "solo",
        dietary: wantsDiet ? a.dietary : [],
        preferred_merchants: a.stores,
        guardrails: {
          currency: "INR",
          approval_threshold_minor_units: Number(a.threshold),
          max_per_day_minor_units: cap,
          max_per_purchase_minor_units: cap,
          blocked_categories: a.neverBuy.filter((c) => !a.useCases.includes(c)),
          international_requires_approval: true,
        },
        shipping:
          !skipping && !a.skipAddress && addressComplete(a.address)
            ? { ...a.address, country: "IN", phone: a.address.phone.trim() }
            : undefined,
      };
    },
    [a, wantsDiet]
  );

  const submit = useCallback(
    async (skipping: boolean) => {
      setBusy(true);
      setError(null);
      try {
        const updated = await api.completeOnboarding(buildAnswers(skipping));
        setUser(updated);
        if (skipping) {
          router.replace("/console/agent");
          return;
        }
        setDone(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save your answers. Try again.");
      } finally {
        setBusy(false);
      }
    },
    [buildAnswers, router, setUser]
  );

  const go = useCallback(
    (delta: number) => {
      if (delta > 0 && !valid) return;
      if (delta > 0 && step === STEPS.length - 1) {
        submit(false);
        return;
      }
      setDir(delta);
      setError(null);
      setStep((s) => Math.min(Math.max(s + delta, 0), STEPS.length - 1));
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    },
    [valid, step, submit, reduce]
  );

  // Keyboard: 1–9 picks in the step's primary question, Enter continues.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (done || busy || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      const typing = t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable;
      if (e.key === "Enter" && !typing && t.tagName !== "BUTTON" && t.tagName !== "A") {
        e.preventDefault();
        go(1);
        return;
      }
      if (typing || !/^[1-9]$/.test(e.key)) return;
      const i = Number(e.key) - 1;
      if (step === 0 && USE_CASES[i]) setA((p) => ({ ...p, useCases: toggle(p.useCases, USE_CASES[i].value) }));
      if (step === 1 && PRIORITIES[i]) setA((p) => ({ ...p, priority: PRIORITIES[i].value }));
      if (step === 2 && THRESHOLDS[i]) setA((p) => ({ ...p, threshold: THRESHOLDS[i].value }));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, go, done, busy]);

  const brief = useMemo(() => buildBrief(a, wantsDiet), [a, wantsDiet]);

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted">
        <Spinner size={20} />
      </div>
    );
  }

  if (done) return <Finished name={firstName(user) || a.name} brief={brief} useCases={a.useCases} />;

  const current = STEPS[step];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6 md:px-10">
          <Link href="/" className="flex items-center gap-2 text-foreground">
            <Logo size={22} />
            <span className="font-display hidden text-[0.95rem] font-semibold tracking-tight sm:inline">Algebra</span>
          </Link>
          <div className="flex flex-1 items-center justify-center gap-3">
            <span className="hidden font-mono text-xs text-muted tabular-nums sm:inline">
              {step + 1}/{STEPS.length}
            </span>
            <div className="flex w-full max-w-xs gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} aria-label="Setup progress">
              {STEPS.map((s, i) => (
                <span key={s.id} className="relative h-1 flex-1 overflow-hidden rounded-full bg-border">
                  <motion.span
                    className="absolute inset-0 origin-left rounded-full bg-primary"
                    initial={false}
                    animate={{ scaleX: i <= step ? 1 : 0 }}
                    transition={{ duration: reduce ? 0 : 0.5, ease: EASE }}
                  />
                </span>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => submit(true)}
            disabled={busy}
            className="text-sm text-muted transition-colors hover:text-foreground disabled:opacity-50"
          >
            Skip for now
          </button>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-12 px-6 py-10 md:px-10 md:py-14 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-16">
        <section className="min-w-0">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div
              key={current.id}
              custom={dir}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 28, filter: "blur(4px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -20, filter: "blur(4px)" }}
              transition={{ duration: 0.32, ease: EASE }}
            >
              {step === 0 && needsName && (
                <div className="mb-10 max-w-sm">
                  <label htmlFor="ob-name" className="text-sm font-medium text-foreground">
                    First, what should we call you?
                  </label>
                  <input
                    id="ob-name"
                    value={a.name}
                    onChange={(e) => setA((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Your name"
                    maxLength={80}
                    autoComplete="name"
                    className="mt-2 h-11 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-[0.95rem] text-foreground placeholder:text-muted/80 focus-visible:border-primary focus-visible:outline-none"
                  />
                </div>
              )}
              <h1 className="font-display text-[1.9rem] leading-[1.1] font-semibold tracking-tight text-balance text-foreground md:text-[2.4rem]">
                {current.title}
              </h1>
              <p className="mt-3 max-w-lg text-[0.975rem] leading-relaxed text-muted">{current.sub}</p>

              <div className="mt-9">
                {step === 0 && (
                  <OptionGrid
                    choices={USE_CASES}
                    selected={a.useCases}
                    multi
                    onToggle={(v) => setA((p) => ({ ...p, useCases: toggle(p.useCases, v) }))}
                  />
                )}

                {step === 1 && (
                  <div className="space-y-10">
                    <OptionGrid
                      choices={PRIORITIES}
                      selected={[a.priority]}
                      onToggle={(v) => setA((p) => ({ ...p, priority: v }))}
                    />
                    <Question label="Who's it shopping for?">
                      <ChipRow
                        choices={HOUSEHOLDS}
                        selected={[a.household]}
                        onToggle={(v) => setA((p) => ({ ...p, household: v }))}
                      />
                    </Question>
                    {wantsDiet && (
                      <Question label="Any food preferences?" hint="Applied to every grocery and food search.">
                        <ChipRow
                          choices={DIETARY}
                          selected={a.dietary}
                          multi
                          onToggle={(v) =>
                            setA((p) => {
                              if (v === "no_restrictions") return { ...p, dietary: p.dietary.includes(v) ? [] : [v] };
                              return { ...p, dietary: toggle(p.dietary.filter((d) => d !== "no_restrictions"), v) };
                            })
                          }
                        />
                      </Question>
                    )}
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-10">
                    <Question label="Ask me before buying anything…">
                      <OptionGrid
                        choices={THRESHOLDS}
                        selected={[a.threshold]}
                        recommended="100000"
                        compact
                        onToggle={(v) => setA((p) => ({ ...p, threshold: v }))}
                      />
                    </Question>
                    <Question label="Daily spending cap" hint="A hard stop. Nothing above it goes through, even with your approval.">
                      <ChipRow
                        choices={DAILY_CAPS}
                        selected={[a.dailyCap]}
                        onToggle={(v) => setA((p) => ({ ...p, dailyCap: v }))}
                      />
                    </Question>
                    <Question label="Never buy" hint="Blocked outright, whatever the price.">
                      <ChipRow
                        choices={neverBuyChoices}
                        selected={a.neverBuy}
                        multi
                        onToggle={(v) => setA((p) => ({ ...p, neverBuy: toggle(p.neverBuy, v) }))}
                      />
                    </Question>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-10">
                    <AddressForm
                      value={a.address}
                      skipped={a.skipAddress}
                      onChange={(address) => setA((p) => ({ ...p, address, skipAddress: false }))}
                      onSkip={() => setA((p) => ({ ...p, skipAddress: !p.skipAddress }))}
                    />
                    <Question label="Stores you already use" hint="Optional. Tried first when they carry the item.">
                      <ChipRow
                        choices={STORES}
                        selected={a.stores}
                        multi
                        onToggle={(v) => setA((p) => ({ ...p, stores: toggle(p.stores, v) }))}
                      />
                    </Question>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {error && (
            <p role="alert" className="mt-8 rounded-xl bg-danger-tint px-4 py-3 text-sm text-danger">
              {error}
            </p>
          )}

          <div className="mt-12 flex items-center gap-3 border-t border-border pt-6">
            {step > 0 && (
              <button
                type="button"
                onClick={() => go(-1)}
                className="inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-medium text-muted transition-colors hover:bg-primary-tint hover:text-foreground"
              >
                <IconArrowLeft size={16} /> Back
              </button>
            )}
            <button
              type="button"
              onClick={() => go(1)}
              disabled={!valid || busy}
              className="ml-auto inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-tint shadow-[0_6px_16px_-8px_color-mix(in_srgb,var(--color-primary)_80%,transparent)] transition-[opacity,transform] hover:opacity-95 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy && <Spinner size={15} />}
              {step === STEPS.length - 1 ? "Finish setup" : "Continue"}
              {!busy && <IconArrowRight size={16} />}
            </button>
          </div>
          <p className="mt-3 hidden text-right text-xs text-muted md:block">
            Press <kbd className="font-mono">1</kbd>–<kbd className="font-mono">8</kbd> to pick,{" "}
            <kbd className="font-mono">Enter</kbd> to continue
          </p>
        </section>

        <aside className="hidden lg:block">
          <div className="sticky top-28">
            <BriefCard brief={brief} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function Question({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="text-[0.95rem] font-medium text-foreground">{label}</legend>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      <div className="mt-4">{children}</div>
    </fieldset>
  );
}

function OptionGrid({
  choices,
  selected,
  multi = false,
  compact = false,
  recommended,
  onToggle,
}: {
  choices: Choice[];
  selected: string[];
  multi?: boolean;
  compact?: boolean;
  recommended?: string;
  onToggle: (v: string) => void;
}) {
  return (
    <div role={multi ? "group" : "radiogroup"} className={`grid gap-3 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2"}`}>
      {choices.map((c, i) => {
        const on = selected.includes(c.value);
        return (
          <motion.button
            key={c.value}
            type="button"
            role={multi ? "checkbox" : "radio"}
            aria-checked={on}
            onClick={() => onToggle(c.value)}
            whileTap={{ scale: 0.985 }}
            className={`group relative flex items-start gap-3.5 rounded-2xl border px-4 text-left transition-[border-color,background-color,box-shadow] duration-200 ${
              compact ? "py-3.5" : "py-4"
            } ${
              on
                ? "border-primary bg-primary-tint shadow-[0_8px_20px_-14px_color-mix(in_srgb,var(--color-primary)_90%,transparent)]"
                : "border-border-strong bg-surface hover:border-foreground/35"
            }`}
          >
            {c.icon && (
              <span
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                  on ? "bg-primary text-primary-tint" : "bg-primary-tint text-primary"
                }`}
              >
                {c.icon}
              </span>
            )}
            <span className="min-w-0 flex-1 pr-6">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-[0.95rem] font-medium text-foreground">{c.label}</span>
                {recommended === c.value && (
                  <span className="rounded-full bg-accent-tint px-2 py-0.5 text-[0.7rem] font-medium text-accent">Recommended</span>
                )}
              </span>
              {c.hint && <span className="mt-0.5 block text-sm leading-snug text-muted">{c.hint}</span>}
            </span>
            <span
              className={`absolute top-3.5 right-3.5 flex h-5 w-5 items-center justify-center border transition-all duration-200 ${
                multi ? "rounded-md" : "rounded-full"
              } ${on ? "border-primary bg-primary text-primary-tint" : "border-border-strong text-transparent"}`}
            >
              <IconCheck size={12} strokeWidth={2.6} />
            </span>
            {i < 9 && (
              <span className="absolute right-4 bottom-3 hidden font-mono text-[0.68rem] text-muted/70 group-hover:inline md:group-focus-visible:inline">
                {i + 1}
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

function ChipRow({
  choices,
  selected,
  multi = false,
  onToggle,
}: {
  choices: Choice[];
  selected: string[];
  multi?: boolean;
  onToggle: (v: string) => void;
}) {
  return (
    <div role={multi ? "group" : "radiogroup"} className="flex flex-wrap gap-2">
      {choices.map((c) => {
        const on = selected.includes(c.value);
        return (
          <button
            key={c.value}
            type="button"
            role={multi ? "checkbox" : "radio"}
            aria-checked={on}
            onClick={() => onToggle(c.value)}
            className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm transition-[border-color,background-color,color] duration-200 ${
              on
                ? "border-primary bg-primary text-primary-tint"
                : "border-border-strong bg-surface text-foreground hover:border-foreground/35"
            }`}
          >
            {c.icon && <span className="[&>svg]:h-4 [&>svg]:w-4">{c.icon}</span>}
            {c.label}
            {on && multi && <IconCheck size={14} strokeWidth={2.4} />}
          </button>
        );
      })}
    </div>
  );
}

function AddressForm({
  value,
  skipped,
  onChange,
  onSkip,
}: {
  value: Address;
  skipped: boolean;
  onChange: (a: Address) => void;
  onSkip: () => void;
}) {
  const set = (k: keyof Address) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value });
  const field =
    "h-11 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-[0.95rem] text-foreground placeholder:text-muted/80 focus-visible:border-primary focus-visible:outline-none";
  return (
    <div>
      <div className={`grid gap-3 transition-opacity sm:grid-cols-2 ${skipped ? "pointer-events-none opacity-40" : ""}`} aria-disabled={skipped}>
        <input className={field} placeholder="Recipient name" autoComplete="name" value={value.recipient_name} onChange={set("recipient_name")} aria-label="Recipient name" />
        <input className={field} placeholder="Phone (for the delivery partner)" autoComplete="tel" inputMode="tel" value={value.phone} onChange={set("phone")} aria-label="Phone" />
        <input className={`${field} sm:col-span-2`} placeholder="Flat, building, street" autoComplete="street-address" value={value.line1} onChange={set("line1")} aria-label="Address" />
        <input className={field} placeholder="City" autoComplete="address-level2" value={value.city} onChange={set("city")} aria-label="City" />
        <div className="grid grid-cols-2 gap-3">
          <input className={field} placeholder="State" autoComplete="address-level1" value={value.state} onChange={set("state")} aria-label="State" />
          <input className={field} placeholder="PIN code" autoComplete="postal-code" inputMode="numeric" maxLength={6} value={value.postal_code} onChange={set("postal_code")} aria-label="PIN code" />
        </div>
      </div>
      <button
        type="button"
        role="checkbox"
        aria-checked={skipped}
        onClick={onSkip}
        className="mt-4 inline-flex items-center gap-2.5 text-sm text-muted hover:text-foreground"
      >
        <span className={`flex h-4.5 w-4.5 items-center justify-center rounded-md border ${skipped ? "border-primary bg-primary text-primary-tint" : "border-border-strong"}`}>
          {skipped && <IconCheck size={11} strokeWidth={2.8} />}
        </span>
        I&apos;ll add an address later
      </button>
    </div>
  );
}

type BriefLine = { key: string; label: string; text: string | null };

function buildBrief(a: Answers, wantsDiet: boolean): BriefLine[] {
  const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
  const priorityText: Record<string, string> = {
    lowest_price: "Picks the lowest total price.",
    fastest_delivery: "Picks whatever arrives first.",
    trusted_brands: "Sticks to brands you'd recognise.",
    best_value: "Balances price, speed and quality.",
  };
  const householdText: Record<string, string> = {
    solo: "Sizes staples for one.",
    couple: "Sizes staples for two.",
    family: "Sizes staples for a family.",
    large: "Sizes staples for a big household.",
  };
  const diet = a.dietary.filter((d) => d !== "no_restrictions").map((d) => labelOf(DIETARY, d));
  const threshold = Number(a.threshold);
  const blocked = a.neverBuy.filter((c) => !a.useCases.includes(c)).map((c) => lower(labelOf(NEVER_BUY, c)));
  const lines: BriefLine[] = [
    {
      key: "shop",
      label: "What it shops for",
      text: a.useCases.length ? `Shops for ${joinList(a.useCases.map((c) => lower(labelOf(USE_CASES, c))))}.` : null,
    },
    { key: "priority", label: "How it chooses", text: a.priority ? priorityText[a.priority] : null },
    { key: "household", label: "Quantities", text: a.household ? householdText[a.household] : null },
  ];
  if (wantsDiet) {
    lines.push({
      key: "diet",
      label: "Food preferences",
      text: a.dietary.includes("no_restrictions") ? "No food restrictions." : diet.length ? `${joinList(diet)} only.` : null,
    });
  }
  lines.push(
    {
      key: "approve",
      label: "When it asks you",
      text: threshold === 0 ? "Asks you before every purchase." : `Buys on its own under ${rupees(threshold)}. Asks you above.`,
    },
    { key: "cap", label: "Daily cap", text: `Never spends more than ${rupees(Number(a.dailyCap))} a day.` },
    { key: "never", label: "Never buys", text: blocked.length ? `Never buys ${joinList(blocked)}.` : "No blocked categories." },
    {
      key: "deliver",
      label: "Delivery",
      text: addressComplete(a.address)
        ? `Delivers to ${a.address.city.trim()}.`
        : a.skipAddress
          ? "Will ask for an address at checkout."
          : null,
    },
  );
  if (a.stores.length) {
    lines.push({ key: "stores", label: "Stores", text: `Tries ${joinList(a.stores.map((s) => labelOf(STORES, s)))} first.` });
  }
  return lines;
}

function BriefCard({ brief, saved = false }: { brief: BriefLine[]; saved?: boolean }) {
  const captured = brief.filter((b) => b.text).length;
  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-[0_18px_40px_-28px_rgba(32,36,29,0.4)]">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-[1.05rem] font-semibold tracking-tight text-foreground">Agent brief</h2>
        <span className="font-mono text-xs text-muted tabular-nums">
          {captured}/{brief.length}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">
        {saved ? "Saved. Your agent reads this before every order." : "What your agent will know, as you answer."}
      </p>
      <LayoutGroup>
        <ul className="mt-5 space-y-3.5">
          {brief.map((b) => (
            <motion.li key={b.key} layout="position" className="flex items-start gap-3">
              <span
                className={`mt-[0.3rem] flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border transition-colors duration-300 ${
                  b.text ? "border-primary bg-primary" : "border-border-strong"
                }`}
              >
                {b.text && <IconCheck size={9} strokeWidth={3.2} className="text-primary-tint" />}
              </span>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={b.text ?? "empty"}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -3 }}
                  transition={{ duration: 0.22, ease: EASE }}
                  className={`text-sm leading-snug ${b.text ? "text-foreground" : "text-muted/70"}`}
                >
                  {b.text ?? b.label}
                </motion.span>
              </AnimatePresence>
            </motion.li>
          ))}
        </ul>
      </LayoutGroup>
    </div>
  );
}

function suggestionFor(useCases: string[]) {
  if (useCases.includes("groceries") || useCases.length === 0) return "🥤 Get me 2 cans of Coke Zero, keep it under ₹150";
  if (useCases.includes("pharmacy")) return "💊 Order a strip of paracetamol 500mg";
  if (useCases.includes("electronics")) return "🔌 Find a 20W USB-C charger under ₹1,200";
  if (useCases.includes("food_delivery")) return "🍛 Order a veg thali for dinner under ₹300";
  if (useCases.includes("home")) return "🧽 Restock dish soap and sponges";
  return "🥤 Help me purchase a Coke under ₹100";
}

function Finished({ name, brief, useCases }: { name: string; brief: BriefLine[]; useCases: string[] }) {
  const reduce = useReducedMotion();
  const prompt = suggestionFor(useCases);
  return (
    <div className="flex min-h-dvh items-center justify-center px-6 py-16">
      <div className="grid w-full max-w-5xl items-center gap-12 lg:grid-cols-[1fr_380px]">
        <div>
          <motion.span
            initial={reduce ? false : { scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-tint"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <motion.path
                d="M4.5 12.5l5 5L19.5 7"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={reduce ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, delay: 0.2, ease: EASE }}
              />
            </svg>
          </motion.span>
          <motion.div initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25, ease: EASE }}>
            <h1 className="font-display mt-7 text-[2.2rem] leading-[1.08] font-semibold tracking-tight text-balance text-foreground md:text-[2.8rem]">
              {name ? `You're set, ${name}.` : "You're set."}
            </h1>
            <p className="mt-4 max-w-md text-[1.02rem] leading-relaxed text-muted">
              Your guardrails are live policy now. Try a first order — anything above your line will wait for you.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={`/console/agent?prompt=${encodeURIComponent(prompt)}`}
                className="inline-flex h-12 items-center gap-2.5 rounded-xl bg-primary px-5 text-[0.95rem] font-medium text-primary-tint transition-[opacity,transform] hover:opacity-95 active:scale-[0.99]"
              >
                {prompt}
                <IconArrowRight size={16} />
              </Link>
              <Link href="/console" className="inline-flex h-12 items-center rounded-xl px-4 text-sm font-medium text-muted hover:text-foreground">
                Go to overview
              </Link>
            </div>
            <p className="mt-6 inline-flex items-center gap-2 text-xs text-muted">
              <IconMapPin size={14} /> Change any of this later under Guardrails and Profile.
            </p>
          </motion.div>
        </div>
        <motion.div initial={reduce ? false : { opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.55, delay: 0.35, ease: EASE }}>
          <BriefCard brief={brief} saved />
        </motion.div>
      </div>
    </div>
  );
}
