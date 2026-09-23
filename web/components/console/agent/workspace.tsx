"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import type { AgentEvent } from "@/lib/agent/events";
import { firstName, useSession } from "@/lib/session";
import { IconArrowUp, IconRefresh, IconShield, IconStop } from "@/components/icons";
import { useConsoleData } from "../console-data";
import { ApprovalCard, type ApprovalOutcome } from "./approval-card";
import { ModelPicker, type ModelChoice, type ProviderEntry } from "./model-picker";
import { RichText } from "./rich-text";
import { GuardsPanel, StoresPanel } from "./side-panels";
import { Timeline, type Step } from "./timeline";

type Turn = {
  id: string;
  user: string;
  steps: Step[];
  notes: string[];
  approvals: { intentId: string; resolved?: ApprovalOutcome }[];
  reply?: string;
  error?: string;
  status: "running" | "done" | "error" | "stopped";
};

const SUGGESTIONS = [
  "🥤 Help me purchase a Coke Zero, under ₹100",
  "🍿 Snacks for a movie night for four, under ₹400",
  "💊 Paracetamol 500mg and a few ORS sachets",
  "🔌 Compare 20W USB-C chargers under ₹1,200",
];

const MODEL_KEY = "algebra:agent-model";
const EASE = [0.16, 1, 0.3, 1] as const;

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random());
}

export function AgentWorkspace() {
  const { user } = useSession();
  const { overview, refreshOverview } = useConsoleData();
  const params = useSearchParams();

  const [providers, setProviders] = useState<ProviderEntry[] | null>(null);
  const [choice, setChoice] = useState<ModelChoice>(null);
  const [lockedProvider, setLockedProvider] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [history, setHistory] = useState<unknown[]>([]);
  const [input, setInput] = useState(() => params.get("prompt") ?? "");
  const [running, setRunning] = useState(false);
  const [session, setSession] = useState({ spent: 0, orders: 0, steps: 0 });
  const [ordersKey, setOrdersKey] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/agent/providers")
      .then((r) => r.json())
      .then((d: { providers: ProviderEntry[] }) => {
        setProviders(d.providers);
        try {
          const saved = JSON.parse(window.localStorage.getItem(MODEL_KEY) ?? "null") as ModelChoice;
          const p = saved && d.providers.find((x) => x.id === saved.provider && x.available);
          if (p && p.models.some((m) => m.id === saved!.model)) setChoice(saved);
        } catch {
          // no saved choice — Auto
        }
      })
      .catch(() => setProviders([]));
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Keep the newest content in view unless the user scrolled up to read.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [turns]);

  const anyProvider = providers?.some((p) => p.available) ?? false;

  const updateTurn = useCallback((id: string, fn: (t: Turn) => Turn) => {
    setTurns((ts) => ts.map((t) => (t.id === id ? fn(t) : t)));
  }, []);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || running) return;
      const id = uid();
      setTurns((ts) => [...ts, { id, user: text, steps: [], notes: [], approvals: [], status: "running" }]);
      setInput("");
      setRunning(true);
      stickRef.current = true;
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      let finished = false;

      const handle = (e: AgentEvent) => {
        switch (e.type) {
          case "step":
            if (e.status === "running") {
              updateTurn(id, (t) => ({
                ...t,
                steps: [...t.steps, { id: e.id, tool: e.tool, title: e.title, status: "running", startedAt: Date.now() }],
              }));
              setSession((s) => ({ ...s, steps: s.steps + 1 }));
            } else {
              updateTurn(id, (t) => ({
                ...t,
                steps: t.steps.map((s) =>
                  s.id === e.id ? { ...s, status: e.status, summary: e.summary, detail: e.detail, endedAt: Date.now() } : s
                ),
              }));
            }
            break;
          case "text":
            updateTurn(id, (t) => ({ ...t, notes: [...t.notes, e.text] }));
            break;
          case "approval":
            updateTurn(id, (t) =>
              t.approvals.some((a) => a.intentId === e.intentId) ? t : { ...t, approvals: [...t.approvals, { intentId: e.intentId }] }
            );
            refreshOverview();
            break;
          case "spend":
            setSession((s) => ({ ...s, spent: s.spent + e.amount.minor_units, orders: s.orders + 1 }));
            setOrdersKey((k) => k + 1);
            refreshOverview();
            break;
          case "done":
            finished = true;
            setHistory(e.history);
            setLockedProvider(e.provider);
            updateTurn(id, (t) => ({ ...t, reply: e.reply, status: "done" }));
            break;
          case "error":
            finished = true;
            updateTurn(id, (t) => ({ ...t, error: e.error, status: "error" }));
            break;
        }
      };

      try {
        const res = await fetch("/api/agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: choice?.provider, model: choice?.model, message: text, history }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? "The agent couldn't start.");
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (line) {
              try {
                handle(JSON.parse(line) as AgentEvent);
              } catch {
                // ignore a malformed line rather than killing the turn
              }
            }
          }
        }
        if (!finished) updateTurn(id, (t) => ({ ...t, status: "error", error: "The connection dropped before the agent finished." }));
      } catch (err) {
        if (ctrl.signal.aborted) {
          updateTurn(id, (t) => ({
            ...t,
            status: "stopped",
            steps: t.steps.map((s) => (s.status === "running" ? { ...s, status: "error", summary: "Stopped", endedAt: Date.now() } : s)),
          }));
        } else {
          updateTurn(id, (t) => ({ ...t, status: "error", error: err instanceof Error ? err.message : "Something went wrong." }));
        }
      } finally {
        abortRef.current = null;
        setRunning(false);
        inputRef.current?.focus();
      }
    },
    [running, choice, history, updateTurn, refreshOverview]
  );

  function newChat() {
    abortRef.current?.abort();
    setTurns([]);
    setHistory([]);
    setLockedProvider(null);
    setSession({ spent: 0, orders: 0, steps: 0 });
    setInput("");
    inputRef.current?.focus();
  }

  function onApprovalResolved(turnId: string, intentId: string, o: ApprovalOutcome) {
    updateTurn(turnId, (t) => ({ ...t, approvals: t.approvals.map((a) => (a.intentId === intentId ? { ...a, resolved: o } : a)) }));
    refreshOverview();
    send(o === "approved" ? "I approved it — go ahead and place the order." : "I rejected it. Don't place this order.");
  }

  function pickModel(c: ModelChoice) {
    setChoice(c);
    try {
      window.localStorage.setItem(MODEL_KEY, JSON.stringify(c));
    } catch {
      // storage blocked — choice still applies for this page
    }
  }

  const title = turns[0]?.user ?? "New chat";
  const threshold = overview?.guardrails.approval_threshold_minor_units;

  return (
    <div className="grid h-full lg:grid-cols-[272px_minmax(0,1fr)] xl:grid-cols-[272px_minmax(0,1fr)_288px]">
      <aside className="hidden min-h-0 border-r border-border lg:block">
        <GuardsPanel overview={overview} session={session} />
      </aside>

      <section className="flex min-h-0 min-w-0 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border px-5">
          <h1 className="min-w-0 flex-1 truncate text-[0.95rem] font-medium text-foreground">{title.replace(/^\p{Extended_Pictographic}\s*/u, "")}</h1>
          <div className="hidden items-center gap-4 text-xs text-muted sm:flex">
            <span>
              Spent <span className="font-mono text-primary tabular-nums">₹{(session.spent / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
            </span>
            <span className="h-3 w-px bg-border-strong" aria-hidden="true" />
            <span>
              <span className="font-mono text-foreground tabular-nums">{session.orders}</span> order{session.orders === 1 ? "" : "s"}
            </span>
          </div>
          {turns.length > 0 && (
            <button
              type="button"
              onClick={newChat}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm text-muted transition-colors hover:bg-primary-tint hover:text-foreground"
            >
              <IconRefresh size={15} /> New chat
            </button>
          )}
        </header>

        <div
          ref={scrollRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
          }}
          className="min-h-0 flex-1 overflow-y-auto"
        >
          <div className="mx-auto w-full max-w-[720px] px-5 py-8">
            {turns.length === 0 ? (
              <EmptyState
                name={firstName(user)}
                threshold={threshold}
                anyProvider={anyProvider}
                loadingProviders={providers === null}
                onPick={(s) => {
                  setInput(s);
                  inputRef.current?.focus();
                }}
              />
            ) : (
              <div className="space-y-10">
                {turns.map((t, i) => (
                  <TurnView key={t.id} turn={t} latest={i === turns.length - 1} onResolved={onApprovalResolved} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 px-5 pb-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="mx-auto w-full max-w-[720px] rounded-2xl border border-border-strong bg-surface shadow-[0_10px_30px_-18px_rgba(32,36,29,0.35)] transition-[border-color,box-shadow] focus-within:border-primary/70 focus-within:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-primary)_10%,transparent),0_10px_30px_-18px_rgba(32,36,29,0.35)]"
          >
            <label htmlFor="agent-input" className="sr-only">
              Message the agent
            </label>
            <textarea
              id="agent-input"
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                const el = e.target;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={2}
              maxLength={4000}
              disabled={!anyProvider && providers !== null}
              placeholder={anyProvider || providers === null ? "Ask for anything — your agent finds it, checks your guardrails, and buys it…" : "Connect an AI model to start"}
              className="block max-h-[200px] w-full resize-none bg-transparent px-4 pt-3.5 text-[0.95rem] leading-relaxed text-foreground placeholder:text-muted/80 focus:outline-none disabled:cursor-not-allowed"
            />
            <div className="flex items-center gap-2 px-2.5 pt-1 pb-2.5">
              <ModelPicker providers={providers} value={choice} onChange={pickModel} lockedProvider={lockedProvider} />
              <span className="hidden text-xs text-muted/80 sm:ml-auto sm:inline">
                <kbd className="font-mono">Enter</kbd> to send · <kbd className="font-mono">Shift+Enter</kbd> new line
              </span>
              {running ? (
                <button
                  type="button"
                  onClick={() => abortRef.current?.abort()}
                  aria-label="Stop"
                  className="ml-auto flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-background transition-transform active:scale-95 sm:ml-0"
                >
                  <IconStop size={16} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim() || !anyProvider}
                  aria-label="Send"
                  className="ml-auto flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-tint transition-[transform,opacity] active:scale-95 disabled:opacity-35 sm:ml-0"
                >
                  <IconArrowUp size={17} strokeWidth={2} />
                </button>
              )}
            </div>
          </form>
          <p className="mx-auto mt-2 max-w-[720px] text-center text-xs text-muted/80">
            Payments go through your guardrails on Algebra&apos;s server. Anything above your line waits for your tap.
          </p>
        </div>
      </section>

      <aside className="hidden min-h-0 border-l border-border xl:block">
        <StoresPanel refreshKey={ordersKey} />
      </aside>
    </div>
  );
}

function TurnView({
  turn,
  latest,
  onResolved,
}: {
  turn: Turn;
  latest: boolean;
  onResolved: (turnId: string, intentId: string, o: ApprovalOutcome) => void;
}) {
  const running = turn.status === "running";
  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }} className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[0.95rem] leading-relaxed whitespace-pre-wrap text-primary-tint">
          {turn.user}
        </p>
      </motion.div>

      {turn.notes.length > 0 && (
        <div className="space-y-1 text-[0.95rem] leading-relaxed text-muted">
          {turn.notes.map((n, i) => (
            <RichText key={i} text={n} />
          ))}
        </div>
      )}

      <Timeline steps={turn.steps} running={running} defaultOpen={latest} />

      {running && turn.steps.length === 0 && (
        <div className="flex items-center gap-2.5 text-sm text-muted" aria-live="polite">
          <span className="flex gap-1" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-primary"
                animate={{ opacity: [0.25, 1, 0.25] }}
                transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
              />
            ))}
          </span>
          Thinking
        </div>
      )}

      {turn.approvals.map((a) => (
        <ApprovalCard key={a.intentId} intentId={a.intentId} resolved={a.resolved} onResolved={(o) => onResolved(turn.id, a.intentId, o)} />
      ))}

      <AnimatePresence>
        {turn.reply && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="text-[0.975rem] leading-relaxed text-foreground"
          >
            <RichText text={turn.reply} />
          </motion.div>
        )}
      </AnimatePresence>

      {turn.status === "stopped" && <p className="text-sm text-muted">Stopped. Nothing past the last completed step was done.</p>}
      {turn.error && (
        <p role="alert" className="rounded-xl bg-danger-tint px-4 py-3 text-sm text-danger">
          {turn.error}
        </p>
      )}
    </div>
  );
}

function EmptyState({
  name,
  threshold,
  anyProvider,
  loadingProviders,
  onPick,
}: {
  name: string;
  threshold: number | undefined;
  anyProvider: boolean;
  loadingProviders: boolean;
  onPick: (s: string) => void;
}) {
  return (
    <div className="pt-6 sm:pt-14">
      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="font-display text-[1.9rem] leading-[1.12] font-semibold tracking-tight text-balance text-foreground sm:text-[2.3rem]"
      >
        {name ? `What should I get you, ${name}?` : "What should I get you?"}
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.05, ease: EASE }}
        className="mt-3 flex items-center gap-2 text-[0.95rem] text-muted"
      >
        <IconShield size={16} className="shrink-0 text-primary" />
        {threshold === undefined
          ? "Every purchase runs through your guardrails first."
          : threshold <= 1
            ? "Every purchase waits for your approval."
            : `I'll buy on my own under ₹${(threshold / 100).toLocaleString("en-IN")} and ask you above that.`}
      </motion.p>

      {!loadingProviders && !anyProvider ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border-strong p-6">
          <p className="font-medium text-foreground">Connect an AI model to start</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            The agent needs one LLM provider key on the server. Add <code className="font-mono text-xs">ANTHROPIC_API_KEY</code>,{" "}
            <code className="font-mono text-xs">OPENAI_API_KEY</code> or <code className="font-mono text-xs">GEMINI_API_KEY</code> to{" "}
            <code className="font-mono text-xs">web/.env.local</code> and restart the web server. Until then you can still order by hand from
            Activity → Order by hand.
          </p>
        </div>
      ) : (
        <div className="mt-10 grid gap-2.5 sm:grid-cols-2">
          {SUGGESTIONS.map((s, i) => (
            <motion.button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1 + i * 0.05, ease: EASE }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="rounded-2xl border border-border-strong bg-surface px-4 py-3.5 text-left text-[0.925rem] leading-snug text-foreground transition-[border-color,box-shadow] hover:border-primary/50 hover:shadow-[0_10px_24px_-18px_rgba(32,36,29,0.5)]"
            >
              {s}
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
