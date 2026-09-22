"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useIdentity } from "@/lib/identity-context";
import { getTrackedIntents, type TrackedIntent } from "@/lib/intent-history";
import { LinkButton, Panel, EmptyState } from "@/components/console/ui";

export default function DashboardPage() {
  const { identity } = useIdentity();
  const [intents, setIntents] = useState<TrackedIntent[]>([]);

  useEffect(() => {
    // Reading localStorage post-mount only, same hydration-safety reason
    // as lib/identity-context.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIntents(getTrackedIntents());
  }, []);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
        Dashboard
      </h1>
      <p className="mt-1.5 text-sm text-muted">
        Connected as{" "}
        <span className="font-mono text-foreground">{identity?.email}</span>
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <LinkButton href="/console/new">New intent</LinkButton>
        <LinkButton href="/console/approvals" variant="secondary">
          Approvals
        </LinkButton>
        <LinkButton href="/console/merchants" variant="secondary">
          Merchant status
        </LinkButton>
      </div>

      <h2 className="mt-12 text-sm font-medium text-muted">
        Recent intents in this browser
      </h2>
      <p className="mt-1 text-xs text-muted">
        Algebra&rsquo;s API has no list-intents endpoint by design — this is a
        local index of intents created from this browser, not a server-side
        list.
      </p>

      <div className="mt-4">
        {intents.length === 0 ? (
          <EmptyState
            title="No intents yet"
            body="Create a purchase intent to see its policy decision, approval, and order status here."
            action={<LinkButton href="/console/new">New intent</LinkButton>}
          />
        ) : (
          <Panel className="divide-y divide-border p-0">
            {intents.map((t) => (
              <Link
                key={t.id}
                href={`/console/intents/${t.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-primary-tint/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">{t.summary}</p>
                  <p className="mt-0.5 font-mono text-xs text-muted">
                    {new Date(t.createdAt).toLocaleString()}
                  </p>
                </div>
                <span className="text-muted" aria-hidden="true">
                  →
                </span>
              </Link>
            ))}
          </Panel>
        )}
      </div>
    </div>
  );
}
