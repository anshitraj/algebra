import { IdentityProvider } from "@/lib/identity-context";
import { ConsoleShell } from "@/components/console/shell";

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <IdentityProvider>
      <ConsoleShell>{children}</ConsoleShell>
    </IdentityProvider>
  );
}
