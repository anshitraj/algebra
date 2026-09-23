"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import * as api from "@/lib/api-client";
import type { ApprovalActivity } from "@/lib/types";
import { IconShield } from "@/components/icons";
import { useConsoleData } from "@/components/console/console-data";
import { ApprovalRow } from "@/components/console/approval-row";
import { ErrorNote, PageHeader, Skeleton } from "@/components/console/ui";

export default function ApprovalsPage() {
  const { refreshOverview } = useConsoleData();
  const [rows, setRows] = useState<ApprovalActivity[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await api.listMyApprovals());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load approvals");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching from the REST API on mount
    load();
    const id = window.setInterval(load, 15000);
    return () => window.clearInterval(id);
  }, [load]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Approvals"
        description="Purchases your guardrails sent back to you. Each approval is bound to one merchant, one set of items and one amount — if the price moves, you'll be asked again."
      />
      <div className="mt-8">
        {error && <ErrorNote>{error}</ErrorNote>}
        {rows === null && !error && (
          <div className="space-y-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        )}
        {rows?.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border-strong px-6 py-14 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary-tint text-primary">
              <IconShield size={20} />
            </span>
            <p className="font-display mt-4 text-lg font-semibold text-foreground">All clear</p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
              When a purchase goes over your auto-approve line, it waits here until you decide.{" "}
              <Link href="/console/guardrails" className="text-primary hover:underline">
                Adjust the line
              </Link>
            </p>
          </div>
        )}
        {rows && rows.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {rows.map((a) => (
              <ApprovalRow
                key={a.approval_id}
                a={a}
                onDone={() => {
                  load();
                  refreshOverview();
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
