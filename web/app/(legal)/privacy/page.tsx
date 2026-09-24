import type { Metadata } from "next";
import { ContactLines, LegalDoc, Section } from "@/components/legal-doc";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy — Algebra",
  description: "What Algebra collects, why, who it's shared with, how long it's kept, and how to see, correct or delete it.",
};

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      intro={`This policy explains what personal data ${LEGAL.who} collects when you use Algebra, why, who it goes to, and the rights you have over it under India's Digital Personal Data Protection Act, 2023. We collect only what the service needs, and we never sell your data.`}
    >
      <Section title="What we collect">
        <ul>
          <li>
            <strong>Account</strong> — your name, email address, and either a password (stored only as an argon2id hash) or the ID of the Google or
            GitHub account you sign in with.
          </li>
          <li>
            <strong>Your rules and preferences</strong> — your guardrails (spending caps, approval line, blocked categories), your onboarding answers,
            and preferences the agent learns, such as a clothing size or which banks&apos; cards you hold.
          </li>
          <li>
            <strong>Delivery addresses</strong> — encrypted with AES-256-GCM before they are stored, and decrypted only to place an order you approved.
          </li>
          <li>
            <strong>Purchases</strong> — what you asked the agent to buy, the quotes it found, policy decisions, your approvals, orders and their
            status, kept as an audit trail.
          </li>
          <li>
            <strong>Agent chats</strong> — your messages and the agent&apos;s replies are sent to our server and to the AI provider to produce each
            reply. The conversation itself is kept in your browser, not in our database; clearing it or starting a new chat removes it.
          </li>
          <li>
            <strong>Devices</strong> — for each signed-in session, its IP address, browser and last activity, so you can see and sign out devices.
          </li>
          <li>
            <strong>Plan payments</strong> — your Razorpay subscription and payment IDs. Card and UPI details go straight to Razorpay; we never see
            them.
          </li>
        </ul>
        <p>We never collect card numbers, CVVs, UPI PINs, wallet keys or one-time passwords.</p>
      </Section>

      <Section title="Why we use it">
        <ul>
          <li>to run your account and keep it secure;</li>
          <li>to find products, apply your guardrails, ask for your approval and place orders you approve;</li>
          <li>to bill your plan and send account emails such as password resets;</li>
          <li>to prevent abuse and fraud, and to meet legal and accounting obligations.</li>
        </ul>
        <p>We process your data on the basis of your consent, given when you create an account, and for the legitimate uses the law allows.</p>
      </Section>

      <Section title="Who we share it with">
        <ul>
          <li>
            <strong>Stores</strong> — only for an order you approved: the items and the delivery address for that order.
          </li>
          <li>
            <strong>AI model providers</strong> (Google Gemini, Anthropic or OpenAI, depending on the model in use) — your chat messages and the
            results of the agent&apos;s searches, to generate replies.
          </li>
          <li>
            <strong>Google Search</strong> — the product searches the agent runs. These carry the search text, not your identity.
          </li>
          <li>
            <strong>Razorpay</strong> — to take payment for your plan.
          </li>
          <li>
            <strong>Our email provider and hosting providers</strong> — to send account emails and run the service.
          </li>
          <li>Authorities, when the law requires it.</li>
        </ul>
        <p>Some of these providers process data outside India, under their own security and privacy commitments.</p>
      </Section>

      <Section title="How long we keep it">
        <p>
          Account data stays while your account exists. When you delete your account we erase your name, email, sign-ins, sessions, saved addresses
          and preferences straight away, and revoke every agent. Orders and their audit trail are financial records the law requires us to keep; after
          deletion they remain tied only to an anonymous ID, not to you. Demo accounts expire after three days. Sessions that have ended are cleared
          after a week.
        </p>
      </Section>

      <Section title="How we protect it">
        <p>
          Addresses and stored agent credentials are encrypted at rest. Sessions use secure, HTTP-only cookies. Passwords are hashed, never stored.
          Every purchase is checked against your guardrails on our servers, and access to data is limited to what each part of the service needs.
        </p>
      </Section>

      <Section title="Your rights">
        <ul>
          <li>
            <strong>See your data</strong> — download it anytime under Account → Your data.
          </li>
          <li>
            <strong>Correct it</strong> — edit your name, guardrails, preferences and addresses in the console, or ask us.
          </li>
          <li>
            <strong>Erase it</strong> — delete your account under Account → Your data.
          </li>
          <li>
            <strong>Withdraw consent</strong> — by deleting your account; this doesn&apos;t affect processing that already happened.
          </li>
          <li>
            <strong>Nominate</strong> someone to exercise these rights for you, and <strong>raise a grievance</strong> with our Grievance Officer. If
            we don&apos;t resolve it, you can complain to the Data Protection Board of India.
          </li>
        </ul>
      </Section>

      <Section title="Cookies and browser storage">
        <p>
          We use one essential cookie to keep you signed in, and during Google or GitHub sign-in a short-lived one to protect that step. Your browser
          stores your current agent chat and chosen AI model. We use no advertising or tracking cookies and no third-party analytics.
        </p>
      </Section>

      <Section title="Children">
        <p>Algebra is not for anyone under 18, and we do not knowingly collect their data.</p>
      </Section>

      <Section title="Changes">
        <p>If we change this policy in a way that matters, we will tell you in the app or by email before the change applies.</p>
      </Section>

      <Section title="Contact and grievances">
        <ContactLines />
      </Section>
    </LegalDoc>
  );
}
