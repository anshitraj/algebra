"use client";

import { useEffect, useState } from "react";
import * as api from "@/lib/api-client";
import { useIdentity } from "@/lib/identity-context";
import type { Approval } from "@/lib/types";
import { Button, Panel, StatusBadge, formatMoney } from "./ui";

type AgentProviderId = "anthropic" | "openai" | "gemini";

const PROVIDER_LABELS: Record<AgentProviderId, string> = {
  anthropic: "Claude",
  openai: "GPT",
  gemini: "Gemini",
};

type ChatMessage = { role: "user" | "assistant"; text: string };

export function AgentChat() {
  const { identity } = useIdentity();
  const [providerStatus, setProviderStatus] = useState<Record<AgentProviderId, boolean> | null>(null);
  const [provider, setProvider] = useState<AgentProviderId | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<unknown[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingApprovalIntentId, setPendingApprovalIntentId] = useState<string | null>(null);
  const [approval, setApproval] = useState<Approval | null>(null);
  const [approvalBusy, setApprovalBusy] = useState(false);

  useEffect(() => {
    fetch("/api/agent/providers")
      .then((r) => r.json())
      .then((status: Record<AgentProviderId, boolean>) => {
        setProviderStatus(status);
        const first = (Object.keys(PROVIDER_LABELS) as AgentProviderId[]).find((p) => status[p]);
        if (first) setProvider(first);
      })
      .catch(() => setProviderStatus({ anthropic: false, openai: false, gemini: false }));
  }, []);

  async function send(text: string) {
    if (!identity || !provider || !text.trim()) return;
    setBusy(true);
    setError(null);
    setMessages((m) => [...m, { role: "user", text }]);
    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          message: text,
          history,
          identity: { userId: identity.userId, agentToken: identity.agentToken },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Agent request failed");
      setHistory(Array.isArray(data.history) ? data.history : []);
      setMessages((m) => [...m, { role: "assistant", text: data.reply ?? "" }]);

      if (data.pendingApproval?.intentId) {
        setPendingApprovalIntentId(data.pendingApproval.intentId);
        try {
          setApproval(await api.getApprovalForIntent(data.pendingApproval.intentId));
        } catch {
          setApproval(null);
        }
      } else {
        setPendingApprovalIntentId(null);
        setApproval(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input;
    setInput("");
    await send(text);
  }

  async function handleApprove() {
    if (!approval) return;
    setApprovalBusy(true);
    setError(null);
    try {
      await api.approveApproval(approval.ID);
      setPendingApprovalIntentId(null);
      setApproval(null);
      await send("I've approved the purchase in the console. Please continue.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setApprovalBusy(false);
    }
  }

  async function handleReject() {
    if (!approval) return;
    setApprovalBusy(true);
    setError(null);
    try {
      await api.rejectApproval(approval.ID);
      setPendingApprovalIntentId(null);
      setApproval(null);
      await send("I've rejected the purchase in the console. Please stop here.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject");
    } finally {
      setApprovalBusy(false);
    }
  }

  function startOver() {
    setMessages([]);
    setHistory([]);
    setPendingApprovalIntentId(null);
    setApproval(null);
    setError(null);
  }

  if (!providerStatus) {
    return <p className="text-sm text-muted">Checking configured providers…</p>;
  }

  const anyAvailable = Object.values(providerStatus).some(Boolean);
  if (!anyAvailable || !provider) {
    return (
      <Panel>
        <p className="text-sm text-foreground">No LLM provider is configured.</p>
        <p className="mt-2 text-sm text-muted">
          Add <code className="font-mono text-xs">ANTHROPIC_API_KEY</code>,{" "}
          <code className="font-mono text-xs">OPENAI_API_KEY</code>, or{" "}
          <code className="font-mono text-xs">GEMINI_API_KEY</code> to{" "}
          <code className="font-mono text-xs">web/.env.local</code> and restart the dev server.
        </p>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <select
          value={provider}
          disabled={messages.length > 0}
          onChange={(e) => setProvider(e.target.value as AgentProviderId)}
          className="rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-foreground disabled:opacity-50"
        >
          {(Object.keys(PROVIDER_LABELS) as AgentProviderId[])
            .filter((p) => providerStatus[p])
            .map((p) => (
              <option key={p} value={p}>
                {PROVIDER_LABELS[p]}
              </option>
            ))}
        </select>
        {messages.length > 0 && (
          <button type="button" onClick={startOver} className="text-sm font-medium text-primary hover:underline">
            New chat
          </button>
        )}
      </div>

      <Panel className="space-y-4">
        {messages.length === 0 && (
          <p className="text-sm text-muted">Try: &ldquo;buy me a Coke Zero and chips, budget ₹400&rdquo;</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : ""}>
            <div
              className={`inline-block max-w-[85%] rounded-2xl px-4 py-2.5 text-left text-sm ${
                m.role === "user" ? "bg-primary text-primary-tint" : "bg-primary-tint/40 text-foreground"
              }`}
            >
              {m.text || <span className="text-muted">…</span>}
            </div>
          </div>
        ))}
        {busy && <p className="text-sm text-muted">Thinking…</p>}
      </Panel>

      {pendingApprovalIntentId && (
        <Panel className="border-accent">
          <div className="flex items-center gap-2">
            <StatusBadge status="REQUIRE_APPROVAL" />
            <p className="text-sm text-foreground">This purchase needs your approval.</p>
          </div>
          {approval && (
            <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-muted">Merchant</dt>
              <dd className="text-foreground">{approval.Merchant}</dd>
              <dt className="text-muted">Amount</dt>
              <dd className="font-mono text-foreground">{formatMoney(approval.Amount)}</dd>
              <dt className="text-muted">Payment source</dt>
              <dd className="text-foreground">{approval.PaymentSourceAlias}</dd>
            </dl>
          )}
          <div className="mt-5 flex gap-3">
            <Button disabled={approvalBusy || !approval} onClick={handleApprove}>
              {approvalBusy ? "Approving…" : "Approve"}
            </Button>
            <Button variant="secondary" disabled={approvalBusy || !approval} onClick={handleReject}>
              Reject
            </Button>
          </div>
        </Panel>
      )}

      {error && <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the agent to buy something…"
          disabled={busy || !!pendingApprovalIntentId}
          className="flex-1 rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:border-primary"
        />
        <Button type="submit" disabled={busy || !input.trim() || !!pendingApprovalIntentId}>
          Send
        </Button>
      </form>
    </div>
  );
}
