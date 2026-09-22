import { Container } from "./container";

const REQUEST = `POST /api/v1/policy/evaluate-transaction
Authorization: Bearer <integrator_token>

{
  "who": { "user_ref": "kite-user-8891" },
  "where": { "merchant": "Target" },
  "how_much": { "amount_minor_units": 5000, "currency": "USD" },
  "conditions": {
    "max_per_transaction_minor_units": 20000,
    "approval_threshold_minor_units": 5000,
    "blocked_categories": ["gambling"]
  }
}`;

const RESPONSE = `{
  "decision": "REQUIRE_APPROVAL",
  "reason_codes": ["AMOUNT_AT_OR_ABOVE_APPROVAL_THRESHOLD"],
  "policy_version": "external-inline-v1"
}`;

export function IntegrateSection() {
  return (
    <section id="integrate" className="pt-20 pb-20 md:pt-28 md:pb-28">
      <Container>
        <div className="grid gap-12 md:grid-cols-2 md:items-center md:gap-16">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              Bring your own budget rules.
            </h2>
            <p className="mt-4 text-[1.0625rem] leading-relaxed text-muted">
              Algebra&rsquo;s policy engine works standalone, outside our own
              checkout flow entirely. A wallet that stores and provides
              cards — call it Kite — asks Algebra before every charge to
              any store, gated by Kite&rsquo;s own limits, not ours. Same
              deterministic ALLOW / DENY / REQUIRE_APPROVAL engine, called
              from your own backend or agent, over REST, MCP, or a public
              Go package.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Algebra never sees your users&rsquo; payment credentials or
              transaction history — only the inputs you choose to send to
              a decision.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="https://github.com/anshitraj/algebra/blob/main/docs/INTEGRATING.md"
                className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-tint transition-transform hover:scale-[1.03] active:scale-[0.98]"
              >
                Read the integration guide
              </a>
              <a
                href="https://github.com/anshitraj/algebra/tree/main/examples/kite-wallet"
                className="text-sm font-medium text-foreground underline decoration-border-strong underline-offset-4 transition-colors hover:decoration-foreground"
              >
                View the worked example
              </a>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgba(32,36,29,0.06),0_24px_48px_-24px_rgba(32,36,29,0.28)]">
            <div className="border-b border-border px-4 py-3">
              <span className="font-mono text-xs text-muted">
                curl -X POST /api/v1/policy/evaluate-transaction
              </span>
            </div>
            <pre className="overflow-x-auto px-4 py-4 font-mono text-[0.75rem] leading-relaxed text-foreground">
              {REQUEST}
            </pre>
            <div className="border-t border-border bg-primary-tint/40 px-4 py-3">
              <span className="font-mono text-xs text-muted">response</span>
            </div>
            <pre className="overflow-x-auto px-4 py-4 font-mono text-[0.75rem] leading-relaxed text-primary">
              {RESPONSE}
            </pre>
          </div>
        </div>
      </Container>
    </section>
  );
}
