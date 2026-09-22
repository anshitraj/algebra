import Link from "next/link";
import { Container } from "./container";

type Tier = {
  name: string;
  price: string;
  priceNote?: string;
  tagline: string;
  features: string[];
  cta: { label: string; href: string };
  highlighted?: boolean;
};

const tiers: Tier[] = [
  {
    name: "Developer",
    price: "$0",
    priceNote: "forever",
    tagline: "Build and test against the full control plane locally.",
    features: [
      "Up to 100 order executions / month",
      "Mock merchant + sandbox card vault",
      "Every policy dimension, approvals, audit trail",
      "Self-host on your own Postgres + Redis",
      "Community support (GitHub issues)",
    ],
    cta: { label: "Read the docs", href: "https://github.com/anshitraj/algebra" },
  },
  {
    name: "Growth",
    price: "$99",
    priceNote: "/ month",
    tagline: "For an agent product with real, running checkouts.",
    features: [
      "5,000 order executions / month included, then $0.02 each",
      "Real merchant connectors — Swiggy Instamart, Amazon, Flipkart, Zepto",
      "Linked-account + card-vault credential storage",
      "Email support, 2-business-day response",
      "Standard uptime SLA",
    ],
    cta: { label: "Open console", href: "/console" },
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    tagline: "Dedicated infrastructure and compliance for scale.",
    features: [
      "Unlimited order executions",
      "VPC / self-hosted deployment",
      "Per-user merchant sessions, SSO, audit exports",
      "Custom connectors (e.g. ONDC/Beckn)",
      "Dedicated support with a negotiated SLA",
    ],
    cta: { label: "Talk to us", href: "https://github.com/anshitraj/algebra" },
  },
];

export function PricingTiers() {
  return (
    <section id="pricing-tiers" className="pt-4 pb-20 md:pb-28">
      <Container>
        <div className="grid gap-6 md:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`flex flex-col rounded-2xl border p-7 ${
                tier.highlighted
                  ? "border-primary bg-primary-tint/60"
                  : "border-border bg-surface"
              }`}
            >
              <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">
                {tier.name}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                {tier.tagline}
              </p>

              <div className="mt-6 flex items-baseline gap-1.5">
                <span className="font-display text-3xl font-semibold tracking-tight text-foreground">
                  {tier.price}
                </span>
                {tier.priceNote && (
                  <span className="text-sm text-muted">{tier.priceNote}</span>
                )}
              </div>

              <ul className="mt-6 flex-1 space-y-3">
                {tier.features.map((f) => (
                  <li
                    key={f}
                    className="flex gap-2.5 text-sm leading-relaxed text-foreground"
                  >
                    <span aria-hidden="true" className="mt-[3px] shrink-0 text-primary">
                      &#10003;
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href={tier.cta.href}
                className={`mt-8 rounded-full px-5 py-2.5 text-center text-sm font-medium transition-transform hover:scale-[1.02] active:scale-[0.98] ${
                  tier.highlighted
                    ? "bg-primary text-primary-tint"
                    : "border border-border-strong text-foreground"
                }`}
              >
                {tier.cta.label}
              </Link>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-sm leading-relaxed text-muted">
          Priced on <span className="text-foreground">order executions</span> —
          the moment Algebra actually turns an approved intent into a real
          merchant order — not on gross order value. Algebra is
          non-custodial and never holds or moves funds, so it never takes a
          cut of what you spend.
        </p>
      </Container>
    </section>
  );
}
