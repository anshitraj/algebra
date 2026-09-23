"use client";

// Loads Razorpay Checkout on demand (only on the billing page, only when the
// user clicks Upgrade) and opens it for a subscription. The payment result
// is only a claim until the server verifies its signature.

type RazorpaySuccess = {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  prefill?: { name?: string; email?: string };
  theme?: { color?: string };
  handler: (r: RazorpaySuccess) => void;
  modal?: { ondismiss?: () => void };
};

type RazorpayInstance = { open: () => void; on: (event: string, cb: (e: { error?: { description?: string } }) => void) => void };

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

const SRC = "https://checkout.razorpay.com/v1/checkout.js";
let loading: Promise<void> | null = null;

function load(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("Couldn't load Razorpay Checkout. Check your connection or ad blocker and try again."));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** Opens Checkout; resolves with the signed result, or null if the user closed it. */
export async function openSubscriptionCheckout(opts: {
  keyId: string;
  subscriptionId: string;
  prefill: { name?: string; email?: string };
  themeColor: string;
}): Promise<RazorpaySuccess | null> {
  await load();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error("Razorpay Checkout didn't initialise.");
  return new Promise((resolve, reject) => {
    const rz = new Razorpay({
      key: opts.keyId,
      subscription_id: opts.subscriptionId,
      name: "Algebra",
      description: "Growth plan — monthly",
      prefill: opts.prefill,
      theme: { color: opts.themeColor },
      handler: (r) => resolve(r),
      modal: { ondismiss: () => resolve(null) },
    });
    rz.on("payment.failed", (e) => reject(new Error(e.error?.description || "The payment didn't go through.")));
    rz.open();
  });
}
