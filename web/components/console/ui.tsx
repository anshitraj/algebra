import Link from "next/link";
import type { ReactNode } from "react";

export function Button({
  children,
  variant = "primary",
  ...props
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles = {
    primary: "bg-primary text-primary-tint hover:opacity-90",
    secondary: "border border-border-strong text-foreground hover:bg-primary-tint",
    danger: "bg-danger text-danger-tint hover:opacity-90",
  }[variant];
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
}) {
  const styles =
    variant === "primary"
      ? "bg-primary text-primary-tint hover:opacity-90"
      : "border border-border-strong text-foreground hover:bg-primary-tint";
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-opacity ${styles}`}
    >
      {children}
    </Link>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </label>
  );
}

const inputStyles =
  "w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:border-primary";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputStyles} ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputStyles} ${props.className ?? ""}`} />;
}

const statusTone: Record<string, string> = {
  ALLOW: "bg-primary-tint text-primary",
  ALLOWED: "bg-primary-tint text-primary",
  APPROVED: "bg-primary-tint text-primary",
  SUCCEEDED: "bg-primary-tint text-primary",
  DELIVERED: "bg-primary-tint text-primary",
  CONFIRMED: "bg-primary-tint text-primary",
  PLACED: "bg-primary-tint text-primary",
  READY: "bg-primary-tint text-primary",

  REQUIRE_APPROVAL: "bg-accent-tint text-accent",
  PENDING: "bg-accent-tint text-accent",
  REAPPROVAL_REQUIRED: "bg-accent-tint text-accent",
  APPROVAL_REQUIRED: "bg-accent-tint text-accent",
  AUTHENTICATION_REQUIRED: "bg-accent-tint text-accent",
  EXECUTING: "bg-accent-tint text-accent",
  DISCOVERING: "bg-accent-tint text-accent",
  SHIPPED: "bg-accent-tint text-accent",

  DENY: "bg-danger-tint text-danger",
  DENIED: "bg-danger-tint text-danger",
  REJECTED: "bg-danger-tint text-danger",
  FAILED: "bg-danger-tint text-danger",
  CANCELLED: "bg-danger-tint text-danger",
  EXPIRED: "bg-danger-tint text-danger",
  POLICY_REJECTED: "bg-danger-tint text-danger",
  MERCHANT_INTERVENTION_REQUIRED: "bg-danger-tint text-danger",
  USER_INTERVENTION_REQUIRED: "bg-danger-tint text-danger",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = statusTone[status] ?? "bg-border text-muted";
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 font-mono text-xs font-medium ${tone}`}>
      {status}
    </span>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-surface p-6 ${className}`}>
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border-strong px-6 py-16 text-center">
      <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function formatMoney(m: { minor_units: number; currency: string } | undefined): string {
  if (!m) return "—";
  const symbol = m.currency === "INR" ? "₹" : m.currency === "USD" ? "$" : `${m.currency} `;
  return `${symbol}${(m.minor_units / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}
