// Wire format of /api/agent/chat's streamed response: one JSON object per
// line (NDJSON). The route emits these as the provider loop runs, so the UI
// can show each tool call as a live step instead of a spinner.

export type StepStatus = "running" | "done" | "error" | "blocked" | "waiting";

export type AgentEvent =
  | { type: "step"; id: string; tool: string; status: "running"; title: string }
  | {
      type: "step";
      id: string;
      tool: string;
      status: Exclude<StepStatus, "running">;
      title: string;
      summary?: string;
      detail?: StepDetail;
    }
  | { type: "text"; text: string }
  | { type: "approval"; intentId: string }
  | { type: "spend"; amount: { minor_units: number; currency: string }; orderId: string; merchant: string }
  | { type: "done"; reply: string; history: unknown[]; provider: string; model: string }
  | { type: "error"; error: string };

/** Structured bits of a tool result worth rendering (never raw JSON dumps). */
export type StepDetail = {
  rows?: { label: string; value: string }[];
  quotes?: { merchant: string; total: string; eta?: string; items: string }[];
  products?: { merchant: string; name: string; price?: string; url?: string }[];
  links?: { title: string; url: string }[];
  reasons?: string[];
  /** One line of context shown under the detail, e.g. "prices may have changed". */
  note?: string;
};

export type EmitFn = (e: AgentEvent) => void;
