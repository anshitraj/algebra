// The stores Algebra searches and buys from, with their real app icons —
// the icon each store publishes itself (via Google's favicon service, or the
// store's own touch icon), or its official vector mark where the published
// icon is too small to stay sharp. Never a drawn imitation of a logo.

export type Store = {
  id: string;
  name: string;
  domain: string;
  /** Brand color: the monogram fallback's ground, and the tile behind a vector mark. */
  color: string;
  /** A full-color square icon, or a single-color vector mark shown white on `color`. */
  icon: { kind: "raster"; src: string } | { kind: "mark"; src: string };
  /** The store's usual delivery time, shown when a listing states none. Depends on the pincode. */
  typicalDelivery: string;
};

const favicon = (domain: string) => ({ kind: "raster" as const, src: `https://www.google.com/s2/favicons?sz=128&domain=${domain}` });
const mark = (slug: string) => ({ kind: "mark" as const, src: `https://cdn.jsdelivr.net/npm/simple-icons@13/icons/${slug}.svg` });

export const STORES: Store[] = [
  { id: "blinkit", name: "Blinkit", domain: "blinkit.com", color: "#f8cb46", icon: favicon("blinkit.com"), typicalDelivery: "10–30 min" },
  { id: "zepto", name: "Zepto", domain: "zepto.com", color: "#3d0c5a", icon: favicon("zepto.com"), typicalDelivery: "10–30 min" },
  { id: "swiggy_instamart", name: "Swiggy Instamart", domain: "swiggy.com", color: "#fc8019", icon: favicon("swiggy.com"), typicalDelivery: "10–30 min" },
  { id: "bigbasket", name: "BigBasket", domain: "bigbasket.com", color: "#84c225", icon: mark("bigbasket"), typicalDelivery: "Same day" },
  { id: "amazon", name: "Amazon", domain: "amazon.in", color: "#ff9900", icon: favicon("amazon.in"), typicalDelivery: "1–4 days" },
  { id: "flipkart", name: "Flipkart", domain: "flipkart.com", color: "#2874f0", icon: favicon("flipkart.com"), typicalDelivery: "2–5 days" },
  { id: "jiomart", name: "JioMart", domain: "jiomart.com", color: "#0078ad", icon: { kind: "raster", src: "https://www.jiomart.com/apple-touch-icon.png" }, typicalDelivery: "1–3 days" },
];

const ALIASES: Record<string, string> = {
  blinkit: "blinkit",
  zepto: "zepto",
  zeptonow: "zepto",
  swiggy: "swiggy_instamart",
  instamart: "swiggy_instamart",
  swiggyinstamart: "swiggy_instamart",
  bigbasket: "bigbasket",
  bbnow: "bigbasket",
  amazon: "amazon",
  amazonin: "amazon",
  amazonfresh: "amazon",
  flipkart: "flipkart",
  flipkartminutes: "flipkart",
  jiomart: "jiomart",
};

/** Finds a store by merchant ID ("swiggy_instamart"), display name ("Swiggy Instamart") or host ("www.amazon.in"). */
export function storeFor(key: string | undefined | null): Store | undefined {
  if (!key) return undefined;
  const k = key.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\.(com|in|co\.in)(\/.*)?$/, "").replace(/[^a-z0-9]/g, "");
  const id = ALIASES[k] ?? Object.entries(ALIASES).find(([alias]) => k.startsWith(alias))?.[1];
  return id ? STORES.find((s) => s.id === id) : undefined;
}
