"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "./logo";
import { Container } from "./container";

const links = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#policy", label: "Policy" },
  { href: "#security", label: "Security" },
  { href: "#merchants", label: "Merchants" },
  { href: "#integrate", label: "Integrate" },
  { href: "/pricing", label: "Pricing" },
];

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-foreground"
          onClick={() => setOpen(false)}
        >
          <Logo size={26} />
          <span className="font-display text-[1.05rem] font-semibold tracking-tight">
            Algebra
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-muted transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-5 md:flex">
          <a
            href="https://github.com/anshitraj/algebra"
            className="text-sm text-muted transition-colors hover:text-foreground"
          >
            GitHub
          </a>
          <Link
            href="/console"
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-tint transition-transform hover:scale-[1.03] active:scale-[0.98]"
          >
            Open console
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Toggle menu"
          className="flex h-9 w-9 flex-col items-center justify-center gap-[5px] md:hidden"
        >
          <span
            className={`h-[1.5px] w-5 bg-foreground transition-transform ${open ? "translate-y-[6.5px] rotate-45" : ""}`}
          />
          <span
            className={`h-[1.5px] w-5 bg-foreground transition-opacity ${open ? "opacity-0" : ""}`}
          />
          <span
            className={`h-[1.5px] w-5 bg-foreground transition-transform ${open ? "-translate-y-[6.5px] -rotate-45" : ""}`}
          />
        </button>
      </Container>

      {open && (
        <div className="border-t border-border md:hidden">
          <Container className="flex flex-col gap-1 py-4">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-2.5 text-sm text-foreground hover:bg-primary-tint"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-2 flex items-center gap-3 px-2">
              <a
                href="https://github.com/anshitraj/algebra"
                className="text-sm text-muted"
              >
                GitHub
              </a>
              <Link
                href="/console"
                className="ml-auto rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-tint"
              >
                Open console
              </Link>
            </div>
          </Container>
        </div>
      )}
    </header>
  );
}
