// Wire format of /api/agent/chat's streamed response: one JSON object per
// line (NDJSON). The route emits these as the provider loop runs, so the UI
// can show each tool call as a live step instead of a spinner.

export type StepStatus = "running" | "done" | "error" | "blocked" | "waiting";

export type AgentEvent =
  | { type: "step"; id: string; tool: string; status: "running"; title: string; hint?: StepHint }
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
  /** The agent asked 1-4 multiple-choice questions; the turn ends and the picks come back as the next message. */
  | { type: "question"; questions: AskedQuestion[] }
  | { type: "spend"; amount: { minor_units: number; currency: string }; orderId: string; merchant: string }
  | { type: "done"; reply: string; history: unknown[]; provider: string; model: string }
  | { type: "error"; error: string };

/** What a running step is working on, for its live activity panel. */
export type StepHint = { query?: string; budget?: string };

/** Structured bits of a tool result worth rendering (never raw JSON dumps). */
export type StepDetail = {
  rows?: { label: string; value: string }[];
  quotes?: { merchant: string; total: string; eta?: string; items: string }[];
  products?: {
    merchant: string;
    name: string;
    /** The listing's own title, for "I'll take this one". */
    title?: string;
    price?: string;
    url?: string;
    image?: string;
    /** Delivery time — the listing's own, or the store's typical one when `etaTypical`. */
    eta?: string;
    etaTypical?: boolean;
    /** A store's search or category page rather than one product. */
    storePage?: boolean;
    /** A coupon code a community post showed — unverified. */
    code?: string;
    /** How old a community post is, e.g. "2 days ago". */
    posted?: string; warning?: string }[];
  links?: { title: string; url: string }[];
  reasons?: string[];
  /** One line of context shown under the detail, e.g. "prices may have changed". */
  note?: string;
};

export type AskedQuestion = { question: string; options: string[] };

export type EmitFn = (e: AgentEvent) => void;
