import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { Container } from "@/components/container";
import { PricingTiers } from "@/components/pricing-tiers";
import { getPlans } from "@/lib/plans";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: "Pricing — Algebra",
  description:
    "Algebra is priced on order executions, not gross order value — it's non-custodial and never holds or moves funds. Free for development, a monthly Growth plan for a running agent product, custom for scale.",
};

const faqs = [
  {
    q: "What's an “order execution”?",
    a: "One PurchaseIntent that Algebra carries all the way through — discovery, policy, approval — to a real, confirmed merchant order. Search, quotes, and rejected or cancelled intents don't count.",
  },
  {
    q: "Why isn't this priced on a % of order value?",
    a: "Algebra is non-custodial: it never holds, sees, or moves the money for a purchase (mandate throughout this codebase). A take-rate on spend would need Algebra to sit in the money's path, or to trust a merchant's self-reported total — neither is true here, so pricing is on the one thing Algebra itself does and can verify: successfully executing an order.",
  },
  {
    q: "Do I need a paid plan to link Swiggy, Zepto, Amazon, or Flipkart?",
    a: "Linking an account and holding credentials is free at every tier. The Growth plan is about volume — once you're running real executions past the Developer tier's monthly allowance.",
  },
  {
    q: "Can I self-host instead of using a hosted plan?",
    a: "Yes — Algebra is Apache-2.0 licensed and self-hosting is the Developer tier by default. Growth and Enterprise are for when you want Algebra operated for you, with support and an SLA attached.",
  },
];

export default async function PricingPage() {
  const plans = await getPlans();
  return (
    <>
      <Nav />
      <main>
        <section className="pt-16 pb-10 text-center md:pt-24 md:pb-14">
          <Container>
            <h1 className="font-display text-4xl font-semibold tracking-tight text-balance text-foreground md:text-5xl">
              Pricing that follows a real order,
              <span className="text-primary"> not your customers&rsquo; money.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-[1.0625rem] leading-relaxed text-muted">
              Free to build against. Pay when Algebra actually executes a
              real, approved order for you — never a cut of what was spent.
            </p>
          </Container>
        </section>

        <PricingTiers plans={plans} />

        <section id="pricing-faq" className="border-t border-border py-16 md:py-24">
          <Container>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Questions
            </h2>
            <dl className="mt-8 grid gap-8 md:grid-cols-2 md:gap-x-12 md:gap-y-10">
              {faqs.map((item) => (
                <div key={item.q}>
                  <dt className="font-display text-base font-semibold tracking-tight text-foreground">
                    {item.q}
                  </dt>
                  <dd className="mt-2 text-sm leading-relaxed text-muted">
                    {item.a}
                  </dd>
                </div>
              ))}
            </dl>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}
