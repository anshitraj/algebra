import Link from "next/link";
import { Logo } from "./logo";
import { Container } from "./container";

const columns = [
  {
    heading: "Product",
    links: [
      { label: "Console", href: "/console" },
      { label: "Pricing", href: "/pricing" },
      { label: "How it works", href: "/#how-it-works" },
      { label: "Policy", href: "/#policy" },
      { label: "Security", href: "/#security" },
      { label: "Integrate", href: "/#integrate" },
    ],
  },
  {
    heading: "Docs",
    links: [
      { label: "Integrating Algebra Policy", href: "https://github.com/anshitraj/algebra/blob/main/docs/INTEGRATING.md" },
      { label: "Architecture", href: "https://github.com/anshitraj/algebra/blob/main/docs/ARCHITECTURE.md" },
      { label: "Threat model", href: "https://github.com/anshitraj/algebra/blob/main/docs/THREAT_MODEL.md" },
      { label: "MCP tools", href: "https://github.com/anshitraj/algebra/blob/main/docs/MCP.md" },
      { label: "Local development", href: "https://github.com/anshitraj/algebra/blob/main/docs/LOCAL_DEVELOPMENT.md" },
    ],
  },
  {
    heading: "Project",
    links: [
      { label: "GitHub", href: "https://github.com/anshitraj/algebra" },
      { label: "Build plan", href: "https://github.com/anshitraj/algebra/blob/main/BUILD_PLAN.md" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border py-16">
      <Container>
        <div className="grid gap-12 md:grid-cols-[1fr_2fr]">
          <div>
            <Link href="/" className="flex items-center gap-2.5 text-foreground">
              <Logo size={22} />
              <span className="font-display text-base font-semibold tracking-tight">
                Algebra
              </span>
            </Link>
            <p className="mt-4 max-w-[26ch] text-sm leading-relaxed text-muted">
              A non-custodial agentic-commerce control plane.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {columns.map((col) => (
              <div key={col.heading}>
                <h3 className="text-xs font-medium text-muted">{col.heading}</h3>
                <ul className="mt-3.5 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <a
                        href={l.href}
                        className="text-sm text-foreground transition-colors hover:text-primary"
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-3 border-t border-border pt-8 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>Dev-mode identity throughout this console — not a real account system. See docs/LOCAL_DEVELOPMENT.md.</p>
          <p>Apache-2.0 licensed.</p>
        </div>
      </Container>
    </footer>
  );
}
