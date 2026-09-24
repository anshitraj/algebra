import { Container } from "./container";
import { StoreLogo } from "./store-logo";
import { STORES } from "@/lib/stores";

/** The stores the agent actually searches, right under the hero. */
export function StoreStrip() {
  return (
    <section aria-labelledby="store-strip-heading" className="pt-4 pb-10 md:pt-6 md:pb-14">
      <Container>
        <p id="store-strip-heading" className="text-center text-sm text-muted">
          Live prices from the stores you already shop at
        </p>
        <ul className="mx-auto mt-6 flex max-w-4xl flex-wrap items-center justify-center gap-x-7 gap-y-4 md:gap-x-9">
          {STORES.map((s) => (
            <li key={s.id} className="flex items-center gap-2.5">
              <StoreLogo store={s.id} size={30} />
              <span className="text-[0.95rem] font-medium tracking-tight text-foreground/85">{s.name}</span>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
