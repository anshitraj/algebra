import { Container } from "./container";

const boundaries = [
  {
    pair: "User ↔ Agent",
    body: "User authentication is separate from agent authorization. Logging in as a person and being trusted as an agent are two different facts.",
  },
  {
    pair: "Agent ↔ Algebra",
    body: "Every mutating call carries a user, agent, and client ID. Agents get scoped capabilities — shopping.create_intent, payments.request — never raw credentials.",
  },
  {
    pair: "Algebra ↔ Policy",
    body: "ALLOW / DENY / REQUIRE_APPROVAL is computed server-side from persisted state and logged. A DENY is terminal — no agent or LLM can talk its way past it.",
  },
  {
    pair: "Algebra ↔ Privacy",
    body: "An alias like shipping:home resolves to a real address only at merchant-execution time. The agent never sees the resolved value; every resolution is audited.",
  },
  {
    pair: "Algebra ↔ Payment rails",
    body: "No PAN, CVV, or private key ever reaches Algebra's process. Cards go through a tokenization vault; crypto is non-custodial — the wallet signs, Algebra never touches the key.",
  },
];

export function TrustBoundaries() {
  return (
    <section id="security" className="pt-20 pb-6 md:pt-28 md:pb-10">
      <Container>
        <h2 className="font-display max-w-lg text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Five boundaries, never collapsed into one.
        </h2>
        <p className="mt-4 max-w-xl text-[1.0625rem] leading-relaxed text-muted">
          A control plane is only as trustworthy as the walls between its
          parts. Here is every wall.
        </p>

        <div className="relative mt-16 max-w-2xl">
          <div
            aria-hidden="true"
            className="absolute top-1 bottom-1 left-[7px] w-px bg-border-strong"
          />
          <ol className="space-y-10">
            {boundaries.map((b) => (
              <li key={b.pair} className="relative pl-9">
                <span
                  aria-hidden="true"
                  className="absolute top-1 left-0 flex h-[15px] w-[15px] items-center justify-center rounded-full bg-primary-tint ring-4 ring-background"
                >
                  <span className="h-[6px] w-[6px] rounded-full bg-primary" />
                </span>
                <h3 className="font-display text-base font-semibold tracking-tight text-foreground">
                  {b.pair}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  {b.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}
