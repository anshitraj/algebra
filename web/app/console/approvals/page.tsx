"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import * as api from "@/lib/api-client";
import { getTrackedIntents } from "@/lib/intent-history";
import type { Approval } from "@/lib/types";
import { Button, EmptyState, Panel, StatusBadge, formatMoney } from "@/components/console/ui";

type Row = { intentId: string; summary: string; approval: Approval };

export default function ApprovalsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const tracked = getTrackedIntents();
    const results = await Promise.all(
      tracked.map(async (t) => {
        try {
          const approval = await api.getApprovalForIntent(t.id);
          if (approval.Status !== "PENDING" && approval.Status !== "REAPPROVAL_REQUIRED") return null;
          return { intentId: t.id, summary: t.summary, approval };
        } catch {
          return null;
        }
      })
    );
    setRows(results.filter((r): r is Row => r !== null));
  }

  useEffect(() => {
    // Fetching from the REST API on mount — the standard client-fetch
    // pattern; setState happens inside load()'s own resolved promise.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function decide(row: Row, action: "approve" | "reject") {
    setBusy(row.approval.ID);
    try {
      if (action === "approve") {
        if (row.approval.Status === "REAPPROVAL_REQUIRED") {
          await api.reapproveApproval(row.approval.ID);
        } else {
          await api.approveApproval(row.approval.ID);
        }
      } else {
        await api.rejectApproval(row.approval.ID);
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
        Approvals
      </h1>
      <p className="mt-1.5 text-sm text-muted">
        Pending approvals for intents tracked in this browser — there is no
        server-side approvals inbox endpoint, so this checks each tracked
        intent&rsquo;s own approval.
      </p>

      <div className="mt-8">
        {rows === null && <p className="text-sm text-muted">Loading…</p>}
        {rows?.length === 0 && (
          <EmptyState
            title="Nothing pending"
            body="Approvals show up here once a purchase intent's policy decision is REQUIRE_APPROVAL."
          />
        )}
        {rows && rows.length > 0 && (
          <div className="space-y-3">
            {rows.map((row) => (
              <Panel key={row.approval.ID}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Link
                      href={`/console/intents/${row.intentId}`}
                      className="font-display text-sm font-semibold text-foreground hover:text-primary"
                    >
                      {row.summary}
                    </Link>
                    <p className="mt-1 text-xs text-muted">
                      {row.approval.Merchant} · {row.approval.PaymentSourceAlias}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={row.approval.Status} />
                    <span className="font-mono text-sm text-foreground">
                      {formatMoney(row.approval.Amount)}
                    </span>
                  </div>
                </div>
                <div className="mt-4 flex gap-3">
                  <Button
                    disabled={busy !== null}
                    onClick={() => decide(row, "approve")}
                  >
                    {busy === row.approval.ID ? "Working…" : "Approve"}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy !== null}
                    onClick={() => decide(row, "reject")}
                  >
                    Reject
                  </Button>
                </div>
              </Panel>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
