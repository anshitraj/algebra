"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import * as api from "@/lib/api-client";
import type { IntentActivity } from "@/lib/types";
import { IconPlus } from "@/components/icons";
import { IntentList } from "@/components/console/intent-list";
import { ErrorNote, PageHeader, Skeleton } from "@/components/console/ui";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "attention", label: "Needs you", match: ["APPROVAL_REQUIRED", "REAPPROVAL_REQUIRED", "AUTHENTICATION_REQUIRED", "USER_INTERVENTION_REQUIRED"] },
  { id: "active", label: "In progress", match: ["DRAFT", "DISCOVERING", "QUOTED", "POLICY_CHECK", "APPROVED", "EXECUTING"] },
  { id: "done", label: "Ordered", match: ["SUCCEEDED", "PARTIALLY_COMPLETED"] },
  { id: "closed", label: "Stopped", match: ["POLICY_REJECTED", "FAILED", "CANCELLED", "EXPIRED", "MERCHANT_INTERVENTION_REQUIRED"] },
] as const;

export default function ActivityPage() {
  const [intents, setIntents] = useState<IntentActivity[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");

  useEffect(() => {
    api
      .listMyIntents(100)
      .then(setIntents)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load activity"));
  }, []);

  const shown = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter);
    if (!intents || !f || !("match" in f)) return intents;
    return intents.filter((i) => (f.match as readonly string[]).includes(i.status));
  }, [intents, filter]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Activity"
        description="Every purchase request — from the agent, an MCP client, or you by hand — and where it ended up."
        actions={
          <Link
            href="/console/new"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border-strong px-4 text-sm font-medium text-foreground transition-colors hover:bg-primary-tint"
          >
            <IconPlus size={16} /> Order by hand
          </Link>
        }
      />
      <div className="mt-8 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`h-8 rounded-full px-3.5 text-sm transition-colors ${
              filter === f.id ? "bg-foreground text-background" : "text-muted hover:bg-primary-tint hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface">
        {error && (
          <div className="p-5">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}
        {shown === null && !error && (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        )}
        {shown?.length === 0 && <p className="px-5 py-12 text-center text-sm text-muted">Nothing here.</p>}
        {shown && shown.length > 0 && <IntentList intents={shown} />}
      </div>
    </div>
  );
}
