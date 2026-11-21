// Google Analytics 4 (gtag.js) — browser tracking for The Signal Spot.
// The measurement ID is a public identifier (it ships in the page source by
// design), so it lives here rather than in secrets.

export const GA_MEASUREMENT_ID = "G-29Y3R5QWMH";

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

let initialized = false;

function gtag(..._args: unknown[]) {
  window.dataLayer = window.dataLayer || [];
  // gtag.js requires the raw Arguments object — a rest-args array is ignored.
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments);
}

/** Load gtag.js and configure the property. Safe to call more than once. */
export function initAnalytics() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  gtag("js", new Date());
  gtag("config", GA_MEASUREMENT_ID);
}

/** Send a page_view for client-side route changes (gtag only auto-tracks the first load). */
export function trackPageView(path: string) {
  if (!initialized || typeof window === "undefined") return;
  gtag("event", "page_view", { page_path: path });
}

/** Custom event helper, e.g. trackEvent("sign_up", { method: "email" }). */
export function trackEvent(name: string, params?: Record<string, unknown>) {
  if (!initialized || typeof window === "undefined") return;
  gtag("event", name, params);
}
