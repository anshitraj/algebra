import { Container } from "./container";

const rows = [
  {
    word: "WHO",
    body: "The agent and the user it acts for.",
    field: "Input.AgentID / UserID",
  },
  {
    word: "WHAT",
    body: "The item the agent is trying to buy.",
    field: "PurchaseIntent.Items[].Query",
  },
  {
    word: "WHERE",
    body: "The merchant the purchase would go through.",
    field: "Input.Merchant",
  },
  {
    word: "HOW MUCH",
    body: "The amount, and what's already been spent today.",
    field: "Input.AmountMinorUnits / SpendTodayMinorUnits",
  },
  {
    word: "WITH WHAT",
    body: "The payment source — card, wallet, or UPI alias.",
    field: "Input.PaymentProfile",
  },
  {
    word: "WHY",
    body: "The category the purchase falls under.",
    field: "Input.Category",
  },
  {
    word: "UNDER WHAT CONDITIONS",
    body: "Per-transaction and daily caps, blocked categories, international rules.",
    field: "Rules{MaxPerTransactionMinorUnits, ...}",
  },
];

export function PolicyDimensions() {
  return (
    <section id="policy" className="pt-20 pb-6 md:pt-28 md:pb-10">
      <Container>
        <div className="grid gap-10 md:grid-cols-[0.9fr_1.1fr] md:gap-16">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              Seven questions, asked every time.
            </h2>
            <p className="mt-4 max-w-sm text-[1.0625rem] leading-relaxed text-muted">
              <code className="font-mono text-sm text-foreground">
                policy.Input
              </code>{" "}
              is the full context a decision is made from — assembled by
              Algebra from persisted state, never supplied by the agent.
            </p>
          </div>

          <dl>
            {rows.map((row) => (
              <div
                key={row.word}
                className="grid gap-1 border-b border-border py-5 first:pt-0 last:border-b-0 sm:grid-cols-[minmax(0,10rem)_1fr] sm:gap-6"
              >
                <dt className="font-display text-sm font-semibold tracking-tight text-primary">
                  {row.word}
                </dt>
                <dd>
                  <p className="text-sm leading-relaxed text-foreground">
                    {row.body}
                  </p>
                  <p className="mt-1.5 font-mono text-xs text-muted">
                    {row.field}
                  </p>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Container>
    </section>
  );
}
