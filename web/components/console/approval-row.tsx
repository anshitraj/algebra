"use client";

import Link from "next/link";
import { useState } from "react";
import * as api from "@/lib/api-client";
import type { ApprovalActivity } from "@/lib/types";
import { merchantLabel } from "@/lib/agent/steps";
import { Spinner } from "@/components/icons";
import { useNow } from "@/lib/use-now";
import { formatMoney, itemsSummary, timeAgo } from "./ui";

/** One pending approval with inline Approve / Reject — the human click. */
export function ApprovalRow({ a, onDone }: { a: ApprovalActivity; onDone: () => void }) {
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(kind: "approve" | "reject") {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "approve") {
        if (a.status === "REAPPROVAL_REQUIRED") await api.reapproveApproval(a.approval_id);
        else await api.approveApproval(a.approval_id);
      } else {
        await api.rejectApproval(a.approval_id);
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't go through");
      setBusy(null);
    }
  }

  const now = useNow(30000);
  const mins = Math.max(0, Math.round((new Date(a.expires_at).getTime() - now) / 60000));

  return (
    <li className="px-5 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Link href={`/console/intents/${a.intent_id}`} className="block truncate text-[0.95rem] font-medium text-foreground hover:text-primary">
            {itemsSummary(a.items)}
          </Link>
          <p className="mt-0.5 text-sm text-muted">
            <span className="font-mono text-foreground tabular-nums">{formatMoney(a.amount)}</span> · {merchantLabel(a.merchant)} ·{" "}
            {a.status === "REAPPROVAL_REQUIRED" ? "price changed — approve again" : `requested ${timeAgo(a.created_at)}`} · expires in {mins}m
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            disabled={!!busy}
            onClick={() => decide("approve")}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-tint transition-[opacity,transform] hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
          >
            {busy === "approve" && <Spinner size={14} />} Approve
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => decide("reject")}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border-strong px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-primary-tint disabled:opacity-50"
          >
            {busy === "reject" && <Spinner size={14} />} Reject
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </li>
  );
}
