import type { Metadata } from "next";
import { ContactLines, LegalDoc, Section } from "@/components/legal-doc";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service — Algebra",
  description: "The agreement between you and Algebra: your account, your agent and approvals, stores, plans and billing.",
};

export default function TermsPage() {
  return (
    <LegalDoc
      title="Terms of Service"
      intro={`These terms are the agreement between you and ${LEGAL.who} for using Algebra's website, console, shopping agent and API. By creating an account, starting a demo or using the service, you accept them.`}
    >
      <Section title="What Algebra is">
        <p>
          Algebra is a shopping agent with spending controls. You tell it what you want; it searches stores, compares options and — within the
          guardrails you set — places orders for you, asking for your approval above the limits you choose.
        </p>
        <p>
          Algebra is non-custodial. We never hold your money, and we never see or store your card number, CVV, UPI PIN, wallet key or OTP.
          Payment for anything you buy is between you and the store.
        </p>
      </Section>

      <Section title="Your account">
        <ul>
          <li>You must be at least 18 and able to enter a binding contract.</li>
          <li>Give accurate details and keep your sign-in secure. You are responsible for what happens under your account.</li>
          <li>Tell us promptly if you think someone else has accessed it. You can sign any device out under Account.</li>
        </ul>
      </Section>

      <Section title="Your agent, your guardrails, your approvals">
        <ul>
          <li>
            You decide the rules: per-purchase and daily caps, the amount above which a purchase needs your approval, and categories it may never buy.
            Algebra checks every purchase against them on our servers before it happens.
          </li>
          <li>
            A purchase within your auto-approve limit can be placed without asking you again. A purchase you approve, or one inside a limit you set,
            is your purchase.
          </li>
          <li>
            The agent uses AI models and can make mistakes. Review what it proposes before you approve. Prices it shows from web search are what a
            store listed at the time and may have changed; the store&apos;s own checkout price is the one that counts.
          </li>
          <li>Approvals are always yours to give. The agent cannot approve a purchase for you.</li>
        </ul>
      </Section>

      <Section title="Stores and what you buy">
        <p>
          When you buy something, your contract of sale is with the store, not with Algebra. The store is responsible for the product, its price,
          delivery, returns, refunds and warranty, under its own terms. If you follow a link to buy on a store&apos;s own site, their terms apply there.
        </p>
        <p>
          To place an order for you, Algebra shares with that store only what the order needs — the items and the delivery address you approved.
        </p>
      </Section>

      <Section title="Demo accounts">
        <p>
          A demo account searches real stores but checks out through a simulated store: no money moves, nothing ships, and demo order numbers are
          not real orders. Demo accounts expire after three days and have lower daily limits.
        </p>
      </Section>

      <Section title="Plans and billing">
        <ul>
          <li>The Developer plan is free, with the monthly allowance shown on the pricing page.</li>
          <li>
            The Growth plan is a monthly subscription, billed in advance through Razorpay and renewed automatically each month until you cancel.
            Prices are in Indian rupees; applicable taxes are shown at checkout.
          </li>
          <li>
            Cancel anytime under Plan &amp; billing. You keep Growth until the end of the month you paid for, and you are not charged again. See the{" "}
            <a href="/refunds">refund and cancellation policy</a>.
          </li>
          <li>We may change prices with at least 30 days&apos; notice; a change applies from your next renewal after that.</li>
        </ul>
      </Section>

      <Section title="Fair use">
        <p>Don&apos;t use Algebra to:</p>
        <ul>
          <li>buy anything illegal, or anything a store&apos;s terms forbid;</li>
          <li>get around your own guardrails, our limits or a store&apos;s limits, for example by splitting one purchase into several;</li>
          <li>disrupt, overload, scrape or reverse-engineer the service, or access accounts or data that aren&apos;t yours;</li>
          <li>create accounts or demos in bulk, or resell access without our written agreement.</li>
        </ul>
        <p>Daily limits on agent messages and demo accounts keep the service fair for everyone.</p>
      </Section>

      <Section title="Services we rely on">
        <p>
          Algebra uses third-party services to work: AI model providers (such as Google Gemini, Anthropic and OpenAI) to run the agent, Google Search
          for live listings, the stores you shop at, Razorpay for plan payments and an email provider for account emails. Their availability and
          terms are outside our control.
        </p>
      </Section>

      <Section title="Disclaimers and liability">
        <p>
          We work hard to keep Algebra accurate and available, but the service is provided &quot;as is&quot;. To the extent the law allows, we are not
          liable for indirect or consequential loss, for a store&apos;s acts or products, or for prices and availability shown from third-party
          listings. Our total liability to you for any claim is limited to the fees you paid us in the three months before it arose. Nothing here
          limits rights you have under the Consumer Protection Act, 2019 or any other law that can&apos;t be limited by contract.
        </p>
      </Section>

      <Section title="Suspension and ending">
        <p>
          You can stop using Algebra and delete your account at any time under Account. We may suspend or close an account that breaks these terms or
          puts others at risk, and will tell you why unless the law or safety prevents it.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          We may update these terms. For material changes we will give notice in the app or by email before they apply. Continuing to use Algebra
          after that means you accept the new terms.
        </p>
      </Section>

      <Section title="Law and disputes">
        <p>
          These terms are governed by the laws of India.{" "}
          {LEGAL.jurisdiction
            ? `Courts in ${LEGAL.jurisdiction} have jurisdiction over any dispute.`
            : "Courts in India with competent jurisdiction hear any dispute."}{" "}
          Please contact us first — most problems are solved faster that way.
        </p>
      </Section>

      <Section title="Contact">
        <ContactLines />
      </Section>
    </LegalDoc>
  );
}
