import type { Metadata } from "next";
import { LegalDoc, Section } from "@/components/legal-doc";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Contact — Algebra",
  description: "Reach Algebra for help with your account, billing, privacy requests or a grievance.",
};

const GITHUB_ISSUES = "https://github.com/anshitraj/algebra/issues";

export default function ContactPage() {
  return (
    <LegalDoc
      title="Contact us"
      intro="For help with your account or plan, a privacy request or a complaint, here's how to reach us. For an order from a store, contact that store first — it handles delivery, returns and refunds for what it sold."
    >
      <Section title="Support and billing">
        {LEGAL.supportEmail ? (
          <p>
            Email <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a>. We reply within two business days.
          </p>
        ) : (
          <p>
            Open an issue on <a href={GITHUB_ISSUES}>GitHub</a>. Don&apos;t include personal details there.
          </p>
        )}
      </Section>

      {(LEGAL.grievanceName || LEGAL.grievanceEmail) && (
        <Section title="Grievance Officer">
          <p>
            For privacy requests and complaints under the Digital Personal Data Protection Act, 2023 and the IT Rules, 2021, write to our Grievance
            Officer{LEGAL.grievanceName ? `, ${LEGAL.grievanceName}` : ""}
            {LEGAL.grievanceEmail && (
              <>
                , at <a href={`mailto:${LEGAL.grievanceEmail}`}>{LEGAL.grievanceEmail}</a>
              </>
            )}
            . We acknowledge grievances within 24 hours and resolve them within 15 days.
          </p>
        </Section>
      )}

      <Section title="Company">
        <p>
          {LEGAL.entity}
          {LEGAL.address && (
            <>
              <br />
              {LEGAL.address}
            </>
          )}
        </p>
      </Section>

      <Section title="Developers">
        <p>
          Questions about the API, MCP server or policy engine: <a href={GITHUB_ISSUES}>GitHub issues</a>.
        </p>
      </Section>
    </LegalDoc>
  );
}
