import type { Metadata } from "next";
import { ContactLines, LegalDoc, Section } from "@/components/legal-doc";

export const metadata: Metadata = {
  title: "Refunds & Cancellation — Algebra",
  description: "How cancelling your Algebra plan works, when you get a refund, and who handles refunds for things you buy.",
};

export default function RefundsPage() {
  return (
    <LegalDoc
      title="Refunds & cancellation"
      intro="Algebra charges for one thing: the Growth plan, a monthly subscription. Here's how cancelling it works, when we refund, and who to ask about refunds for things you buy through the agent."
    >
      <Section title="Cancelling your plan">
        <ul>
          <li>Cancel anytime under Plan &amp; billing in the console. It takes effect immediately — you won&apos;t be charged again.</li>
          <li>You keep Growth until the end of the month you already paid for, then move to the free Developer plan.</li>
          <li>We don&apos;t charge cancellation fees.</li>
        </ul>
      </Section>

      <Section title="Refunds for your plan">
        <ul>
          <li>
            Plan payments are for a month of service and aren&apos;t refunded for the unused part of a month after you cancel.
          </li>
          <li>
            If you were charged twice, charged after cancelling, or charged in error, we refund the full amount. Write to us within 30 days of the
            charge.
          </li>
          <li>Approved refunds go back to the original payment method through Razorpay, usually within 5–7 business days.</li>
        </ul>
      </Section>

      <Section title="Things you buy through the agent">
        <p>
          Algebra is not the seller and never takes payment for the products you buy. Returns, replacements and refunds for an order are handled by
          the store that sold it, under its own policy — contact the store through its app or website. We&apos;re happy to help you find the order
          details you need.
        </p>
        <p>Demo orders are simulated: no money is charged, so there is nothing to refund.</p>
      </Section>

      <Section title="Delivery">
        <p>
          The Growth plan is a digital service, available in your account as soon as payment succeeds. Algebra itself ships no physical goods;
          delivery of anything you order is by the store, on its own timelines.
        </p>
      </Section>

      <Section title="Contact">
        <ContactLines />
      </Section>
    </LegalDoc>
  );
}
