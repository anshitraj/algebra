"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";
import { Container } from "./container";
import { GitHubMark, GoogleMark, IconArrowRight, IconCheck, IconMail, IconShield } from "./icons";

const STEPS = [
  {
    title: "Sign in",
    body: "Google, GitHub or email. No card, no wallet, nothing to install.",
  },
  {
    title: "Set your guardrails",
    body: "When it should ask you, a daily cap, what it never buys. Four taps — and they become real policy.",
  },
  {
    title: "Ask for anything",
    body: "Say it the way you'd text a friend. The agent searches every connected store and picks by your rules.",
  },
  {
    title: "Approve and track",
    body: "Under your line it just happens. Above it, one tap. Every step lands on an audit trail you can read.",
  },
];

const DURATION = 4200;
const EASE = [0.16, 1, 0.3, 1] as const;

export function GetStarted() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20% 0px" });
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduce || paused || !inView) return;
    const id = window.setTimeout(() => setActive((a) => (a + 1) % STEPS.length), DURATION);
    return () => window.clearTimeout(id);
  }, [active, paused, inView, reduce]);

  return (
    <section id="get-started" className="scroll-mt-24 pt-20 pb-6 md:pt-28">
      <Container>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <h2 className="font-display max-w-xl text-3xl font-semibold tracking-tight text-balance text-foreground md:text-[2.6rem] md:leading-[1.08]">
            From sign-up to first order in four steps.
          </h2>
          <Link href="/signup" className="group inline-flex items-center gap-1.5 text-sm font-medium text-primary">
            Start now — it takes about a minute
            <IconArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div
          ref={ref}
          className="mt-12 grid gap-8 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-12"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <ol className="flex flex-col" role="tablist" aria-label="Steps">
            {STEPS.map((s, i) => {
              const on = i === active;
              return (
                <li key={s.title} className="relative">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setActive(i)}
                    className={`relative flex w-full gap-4 overflow-hidden rounded-2xl px-5 py-5 text-left transition-colors ${
                      on ? "bg-surface shadow-[0_14px_36px_-24px_rgba(32,36,29,0.5)]" : "hover:bg-surface/60"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-sm transition-colors ${
                        on ? "bg-primary text-primary-tint" : "border border-border-strong text-muted"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-[1.05rem] font-semibold tracking-tight ${on ? "text-foreground" : "text-foreground/80"}`}>
                        {s.title}
                      </span>
                      <AnimatePresence initial={false}>
                        {on && (
                          <motion.span
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.35, ease: EASE }}
                            className="block overflow-hidden"
                          >
                            <span className="block pt-1.5 text-[0.95rem] leading-relaxed text-muted">{s.body}</span>
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </span>
                    {on && !reduce && (
                      <motion.span
                        key={`bar-${active}-${paused}`}
                        className="absolute bottom-0 left-0 h-[2px] bg-primary"
                        initial={{ width: "0%" }}
                        animate={{ width: paused || !inView ? "0%" : "100%" }}
                        transition={{ duration: paused || !inView ? 0 : DURATION / 1000, ease: "linear" }}
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="relative min-h-[380px] overflow-hidden rounded-3xl border border-border bg-primary-tint/50 p-5 sm:p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10, filter: "blur(6px)" }}
                transition={{ duration: 0.4, ease: EASE }}
                className="flex h-full items-center justify-center"
              >
                {active === 0 && <SignInScene />}
                {active === 1 && <GuardrailScene />}
                {active === 2 && <AskScene />}
                {active === 3 && <ApproveScene />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </Container>
    </section>
  );
}

const card = "w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-[0_24px_50px_-30px_rgba(32,36,29,0.55)]";

function SignInScene() {
  return (
    <div className={card}>
      <p className="font-display text-lg font-semibold text-foreground">Create your account</p>
      <div className="mt-4 space-y-2">
        {[
          { icon: <GitHubMark size={16} />, label: "Continue with GitHub" },
          { icon: <GoogleMark size={16} />, label: "Continue with Google" },
          { icon: <IconMail size={16} />, label: "Continue with email" },
        ].map((b, i) => (
          <motion.div
            key={b.label}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.12 + i * 0.08, ease: EASE }}
            className={`flex h-10 items-center justify-center gap-2 rounded-xl border text-sm font-medium ${
              i === 1 ? "border-primary bg-primary-tint text-foreground" : "border-border-strong text-foreground"
            }`}
          >
            {b.icon} {b.label}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function GuardrailScene() {
  const rows = [
    { k: "Ask me above", v: "₹1,000" },
    { k: "Daily cap", v: "₹5,000" },
    { k: "Never buy", v: "Gift cards, alcohol" },
  ];
  return (
    <div className={card}>
      <p className="font-display text-lg font-semibold text-foreground">When should it check with you?</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {["Every purchase", "Above ₹500", "Above ₹1,000", "Above ₹2,500"].map((c, i) => (
          <motion.span
            key={c}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.08 * i }}
            className={`rounded-full border px-3 py-1.5 text-xs ${i === 2 ? "border-primary bg-primary text-primary-tint" : "border-border-strong text-foreground"}`}
          >
            {c}
          </motion.span>
        ))}
      </div>
      <ul className="mt-5 space-y-2 border-t border-border pt-4">
        {rows.map((r, i) => (
          <motion.li
            key={r.k}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 + i * 0.1 }}
            className="flex items-center justify-between text-sm"
          >
            <span className="flex items-center gap-2 text-muted">
              <IconCheck size={13} className="text-primary" strokeWidth={2.4} /> {r.k}
            </span>
            <span className="font-mono text-foreground">{r.v}</span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

function AskScene() {
  const steps = ["Searching 4 stores", "3 quotes · best ₹92 on Instamart", "Guardrails: under ₹1,000 — approved"];
  return (
    <div className={card}>
      <div className="flex justify-end">
        <p className="rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-tint">🥤 Help me purchase a Coke Zero, under ₹100</p>
      </div>
      <ol className="mt-4 space-y-2.5">
        {steps.map((s, i) => (
          <motion.li
            key={s}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 + i * 0.45, ease: EASE }}
            className="flex items-center gap-2.5 text-sm text-foreground"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-tint">
              <IconCheck size={11} strokeWidth={2.8} />
            </span>
            {s}
          </motion.li>
        ))}
      </ol>
    </div>
  );
}

function ApproveScene() {
  return (
    <div className="w-full max-w-sm space-y-3">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-accent/60 bg-surface p-4 shadow-[0_24px_50px_-30px_rgba(32,36,29,0.55)]">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-tint">
            <IconShield size={17} />
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Approve ₹1,849 at Amazon?</p>
            <p className="text-xs text-muted">Above your ₹1,000 line · bound to these items</p>
            <div className="mt-3 flex gap-2">
              <motion.span
                initial={{ scale: 1 }}
                animate={{ scale: [1, 0.96, 1] }}
                transition={{ delay: 0.9, duration: 0.3 }}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-tint"
              >
                Approve
              </motion.span>
              <span className="rounded-lg border border-border-strong px-3 py-1.5 text-xs text-foreground">Reject</span>
            </div>
          </div>
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.3, ease: EASE }}
        className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-tint">
          <IconCheck size={17} strokeWidth={2.4} />
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">Order placed</p>
          <p className="font-mono text-xs text-muted">AMZ-408-2291 · arriving Thu</p>
        </div>
      </motion.div>
    </div>
  );
}
