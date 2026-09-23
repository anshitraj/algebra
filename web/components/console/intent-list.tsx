import Link from "next/link";
import type { IntentActivity } from "@/lib/types";
import { merchantLabel } from "@/lib/agent/steps";
import { IconChat, IconChevronRight } from "@/components/icons";
import { StatusBadge, formatMoney, itemsSummary, timeAgo } from "./ui";

const FRIENDLY: Record<string, string> = {
  DRAFT: "Draft",
  DISCOVERING: "Searching",
  QUOTED: "Quoted",
  POLICY_CHECK: "Checking",
  POLICY_REJECTED: "Blocked",
  APPROVAL_REQUIRED: "Needs approval",
  APPROVED: "Approved",
  REAPPROVAL_REQUIRED: "Re-approve",
  EXECUTING: "Placing",
  AUTHENTICATION_REQUIRED: "Verify payment",
  SUCCEEDED: "Ordered",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
  PARTIALLY_COMPLETED: "Partial",
  MERCHANT_INTERVENTION_REQUIRED: "Needs merchant",
  USER_INTERVENTION_REQUIRED: "Needs you",
};

export function friendlyStatus(s: string) {
  return FRIENDLY[s] ?? s;
}

export function IntentList({ intents }: { intents: IntentActivity[] }) {
  return (
    <ul className="divide-y divide-border">
      {intents.map((it) => (
        <li key={it.intent_id}>
          <Link
            href={`/console/intents/${it.intent_id}`}
            className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-primary-tint/40"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.95rem] text-foreground">{itemsSummary(it.items)}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                {it.created_by_agent && (
                  <span className="inline-flex items-center gap-1" title="Created by an external agent">
                    <IconChat size={12} /> MCP agent ·
                  </span>
                )}
                {it.merchant ? merchantLabel(it.merchant) : "No store yet"} · {timeAgo(it.created_at)}
              </p>
            </div>
            {it.amount && <span className="hidden font-mono text-sm text-foreground tabular-nums sm:inline">{formatMoney(it.amount)}</span>}
            <StatusBadge status={it.status} label={friendlyStatus(it.status)} />
            <IconChevronRight size={16} className="shrink-0 text-muted/60 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
