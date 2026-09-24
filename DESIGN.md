# Algebra design system

Formal fintech, in the Stripe / Mercury family: cool white and navy grounds, near-black ink, one confident indigo, and a soft indigo → violet → sky light used sparingly. Tokens live in `web/app/globals.css`; components use them through Tailwind (`bg-primary`, `text-muted`, …), never raw hex.

## Color

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` | `#f7f8fc` | `#0b0f1a` | Page ground |
| `surface` | `#ffffff` | `#111628` | Cards, panels, composer |
| `foreground` | `#0b1020` | `#e8eaf3` | Text |
| `muted` | `#5b6478` | `#98a1b8` | Secondary text |
| `primary` | `#4f46e5` | `#818cf8` | Actions, links, done states, brand |
| `primary-tint` | `#eef0ff` | `#1d2142` | Chips, selected rows — and the text color on `primary` buttons |
| `accent` / `accent-tint` | `#b45309` / `#fef3c7` | `#f59e0b` / `#2a1e0b` | Attention only: "needs your approval", in-progress stage |
| `danger` / `danger-tint` | `#dc2626` / `#fee2e2` | `#f87171` / `#2b1418` | Blocked, errors, scam warnings |
| `success` | `#059669` | `#34d399` | Ready / visited indicators |
| `border`, `border-strong` | ink at 9% / 16% | ink at 11% / 20% | Hairlines |

Strategy: Restrained. Neutrals carry the page; indigo marks what you can act on. Amber means "waiting on you", never decoration.

**Brand light** — `--glow-indigo`, `--glow-violet`, `--glow-sky`. Only two uses:
- `.brand-glow`: a blurred radial mesh behind the landing hero, never behind body text.
- `.brand-frame`: a gradient 1px edge and indigo shadow on a product frame (the landing dashboard preview).

No gradient text. Shadows use the ink (`rgb(var(--shadow-ink) / a)`), offset and soft.

## Type

Geist for display and UI, Geist Mono for data (IDs, prices in tables, URLs). Headlines semibold with tight tracking; the landing headline's second clause is `text-primary`.

## Store logos

`components/store-logo.tsx` + `lib/stores.ts`. Each store's own published icon (Google's favicon service at 128px, the store's touch icon, or its official Simple Icons mark on its brand color when the published icon is too small). Unknown stores get a letter monogram; the simulated demo store shows Algebra's mark. Never draw or approximate a store's logo. The footer carries the trademark note.

Used on: the landing store strip and merchants table, the dashboard preview, the console stores panel and merchants page, quote rows, listing rows (as the fallback when a product publishes no photo), and the live search animation's store rail.

## Motion

Waiting shows the work (`components/console/agent/live-activity.tsx`): a small browser walking Google → store sites with the stores' icons on a rail, placeholder rows that pick up each store's icon, guardrail and order checklists, shimmer "Thinking". Status swaps are enter-only CSS that start visible (0.35 opacity), so text never disappears if frames stall. Everything has a `prefers-reduced-motion` path in `globals.css`.
