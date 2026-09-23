"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import * as api from "@/lib/api-client";
import type { Approval } from "@/lib/types";
import { merchantLabel } from "@/lib/agent/steps";
import { IconShield, Spinner } from "@/components/icons";
import { useNow } from "@/lib/use-now";
import { formatMoney } from "../ui";

export type ApprovalOutcome = "approved" | "rejected";

/**
 * The human half of REQUIRE_APPROVAL. Loads the real Approval (bound to
 * merchant, items, amount and payment source) with the user's session and
 * resolves it with the same endpoints the Approvals page uses — the agent
 * has no tool that can do this.
 */
export function ApprovalCard({
  intentId,
  resolved,
  onResolved,
}: {
  intentId: string;
  resolved?: ApprovalOutcome;
  onResolved: (o: ApprovalOutcome) => void;
}) {
  const [approval, setApproval] = useState<Approval | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<ApprovalOutcome | null>(null);

  useEffect(() => {
    api
      .getApprovalForIntent(intentId)
      .then(setApproval)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load the approval"));
  }, [intentId]);

  async function decide(o: ApprovalOutcome) {
    if (!approval) return;
    setBusy(o);
    setError(null);
    try {
      if (o === "approved") {
        if (approval.Status === "REAPPROVAL_REQUIRED") await api.reapproveApproval(approval.ID);
        else await api.approveApproval(approval.ID);
      } else {
        await api.rejectApproval(approval.ID);
      }
      onResolved(o);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't go through");
    } finally {
      setBusy(null);
    }
  }

  const now = useNow(15000);
  const expired = approval && new Date(approval.ExpiresAt).getTime() < now;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={`rounded-2xl border p-4 sm:p-5 ${resolved ? "border-border bg-surface" : "border-accent/60 bg-accent-tint/40"}`}
    >
      <div className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${resolved ? "bg-primary-tint text-primary" : "bg-accent text-accent-tint"}`}>
          <IconShield size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.95rem] font-medium text-foreground">
            {resolved === "approved" ? "You approved this purchase" : resolved === "rejected" ? "You rejected this purchase" : "Approve this purchase?"}
          </p>
          {approval ? (
            <p className="mt-0.5 text-sm text-muted">
              <span className="font-mono text-foreground tabular-nums">{formatMoney(approval.Amount)}</span> at{" "}
              {merchantLabel(approval.Merchant)} · paid with <span className="font-mono text-xs">{approval.PaymentSourceAlias}</span>
            </p>
          ) : !error ? (
            <p className="mt-0.5 text-sm text-muted">Loading the exact terms…</p>
          ) : null}
          {approval && !resolved && (
            <p className="mt-2 text-xs text-muted">
              Bound to this merchant, these items and this amount. If the price moves, you&apos;ll be asked again.
            </p>
          )}
        </div>
      </div>
      {error && <p className="mt-3 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>}
      {!resolved && approval && (
        <div className="mt-4 flex flex-wrap gap-2.5 sm:pl-12">
          <button
            type="button"
            disabled={!!busy || !!expired}
            onClick={() => decide("approved")}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-tint transition-[opacity,transform] hover:opacity-95 active:scale-[0.98] disabled:opacity-45"
          >
            {busy === "approved" && <Spinner size={14} />} Approve {formatMoney(approval.Amount)}
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => decide("rejected")}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border-strong px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface disabled:opacity-45"
          >
            {busy === "rejected" && <Spinner size={14} />} Reject
          </button>
          {expired && <span className="self-center text-xs text-danger">This approval expired — ask the agent to try again.</span>}
        </div>
      )}
    </motion.div>
  );
}
