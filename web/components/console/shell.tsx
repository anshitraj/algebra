"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { useIdentity } from "@/lib/identity-context";
import { Connect } from "./connect";

const navItems = [
  { href: "/console", label: "Dashboard" },
  { href: "/console/agent", label: "Agent" },
  { href: "/console/new", label: "New intent" },
  { href: "/console/approvals", label: "Approvals" },
  { href: "/console/orders", label: "Orders" },
  { href: "/console/payment-sources", label: "Payment sources" },
  { href: "/console/merchants", label: "Merchants" },
];

export function ConsoleShell({ children }: { children: React.ReactNode }) {
  const { identity, ready, clearIdentity } = useIdentity();
  const pathname = usePathname();

  if (!ready) return null;
  if (!identity) return <Connect />;

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-r border-border md:flex md:flex-col">
        <Link href="/" className="flex items-center gap-2.5 px-6 py-5 text-foreground">
          <Logo size={22} />
          <span className="font-display text-[0.95rem] font-semibold tracking-tight">
            Algebra
          </span>
        </Link>
        <nav className="flex flex-1 flex-col gap-0.5 px-3">
          {navItems.map((item) => {
            const active =
              item.href === "/console" ? pathname === "/console" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-primary-tint font-medium text-primary"
                    : "text-muted hover:bg-primary-tint/60 hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border px-4 py-4">
          <p className="truncate text-xs text-muted" title={identity.email}>
            {identity.email}
          </p>
          <p className="mt-0.5 truncate font-mono text-[0.6875rem] text-muted/70" title={identity.agentId}>
            {identity.agentId}
          </p>
          <button
            type="button"
            onClick={clearIdentity}
            className="mt-2 text-xs font-medium text-danger hover:underline"
          >
            Disconnect
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-6 py-4 md:hidden">
          <Link href="/" className="flex items-center gap-2 text-foreground">
            <Logo size={20} />
            <span className="font-display text-sm font-semibold">Algebra</span>
          </Link>
          <button type="button" onClick={clearIdentity} className="text-xs text-danger">
            Disconnect
          </button>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-border px-4 py-2 md:hidden">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-lg px-3 py-1.5 text-xs text-muted hover:bg-primary-tint hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="flex-1 px-6 py-8 md:px-10 md:py-10">{children}</main>
      </div>
    </div>
  );
}
