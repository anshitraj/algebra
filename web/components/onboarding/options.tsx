import {
  IconBolt,
  IconCart,
  IconDevice,
  IconDrop,
  IconHome,
  IconPill,
  IconRepeat,
  IconScale,
  IconShirt,
  IconStar,
  IconTag,
  IconUser,
  IconUsers,
  IconUtensils,
} from "@/components/icons";

export type Choice = {
  value: string;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
};

// Category values match account.KnownCategories on the server.
export const USE_CASES: Choice[] = [
  { value: "groceries", label: "Groceries & essentials", hint: "Staples, snacks, drinks", icon: <IconCart /> },
  { value: "food_delivery", label: "Food delivery", hint: "Meals from restaurants", icon: <IconUtensils /> },
  { value: "pharmacy", label: "Pharmacy", hint: "OTC medicine, supplements", icon: <IconPill /> },
  { value: "electronics", label: "Electronics", hint: "Chargers, gadgets, parts", icon: <IconDevice /> },
  { value: "fashion", label: "Fashion", hint: "Clothes, shoes, accessories", icon: <IconShirt /> },
  { value: "home", label: "Home & kitchen", hint: "Cleaning, cookware, decor", icon: <IconHome /> },
  { value: "beauty", label: "Beauty & care", hint: "Skincare, grooming", icon: <IconDrop /> },
  { value: "subscriptions", label: "Subscriptions", hint: "Recurring refills and plans", icon: <IconRepeat /> },
];

export const PRIORITIES: Choice[] = [
  { value: "lowest_price", label: "Lowest price", hint: "Cheapest total after fees and offers", icon: <IconTag /> },
  { value: "fastest_delivery", label: "Fastest delivery", hint: "Earliest arrival, even if it costs a bit more", icon: <IconBolt /> },
  { value: "trusted_brands", label: "Brands I trust", hint: "Well-known brands, fewer surprises", icon: <IconStar /> },
  { value: "best_value", label: "Best overall value", hint: "Balances price, speed and quality", icon: <IconScale /> },
];

export const HOUSEHOLDS: Choice[] = [
  { value: "solo", label: "Just me", icon: <IconUser /> },
  { value: "couple", label: "Two of us", icon: <IconUsers /> },
  { value: "family", label: "Family of 3–5", icon: <IconUsers /> },
  { value: "large", label: "6 or more", icon: <IconUsers /> },
];

export const DIETARY: Choice[] = [
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "eggetarian", label: "Eggetarian" },
  { value: "jain", label: "Jain" },
  { value: "halal", label: "Halal" },
  { value: "gluten_free", label: "Gluten-free" },
  { value: "no_restrictions", label: "No restrictions" },
];

// Minor units (paise). 0 = ask before every purchase.
export const THRESHOLDS: Choice[] = [
  { value: "0", label: "Every purchase", hint: "Nothing goes through without your tap" },
  { value: "50000", label: "Above ₹500", hint: "Small top-ups happen on their own" },
  { value: "100000", label: "Above ₹1,000", hint: "Everyday essentials happen on their own" },
  { value: "250000", label: "Above ₹2,500", hint: "Only big purchases need you" },
];

export const DAILY_CAPS: Choice[] = [
  { value: "200000", label: "₹2,000" },
  { value: "500000", label: "₹5,000" },
  { value: "1000000", label: "₹10,000" },
  { value: "2500000", label: "₹25,000" },
];

export const NEVER_BUY: Choice[] = [
  { value: "gift_cards", label: "Gift cards" },
  { value: "alcohol", label: "Alcohol" },
  { value: "tobacco", label: "Tobacco" },
  { value: "electronics", label: "Electronics" },
  { value: "travel", label: "Travel" },
  { value: "subscriptions", label: "Subscriptions" },
];

// Values match connector names (connectors/*).
export const STORES: Choice[] = [
  { value: "swiggy_instamart", label: "Swiggy Instamart" },
  { value: "zepto", label: "Zepto" },
  { value: "blinkit", label: "Blinkit" },
  { value: "amazon", label: "Amazon" },
  { value: "flipkart", label: "Flipkart" },
];

export const FOOD_CATEGORIES = ["groceries", "food_delivery"];

export function labelOf(list: Choice[], value: string) {
  return list.find((c) => c.value === value)?.label ?? value;
}

export function rupees(minor: number) {
  return `₹${(minor / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function joinList(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
