/**
 * analytics.ts — thin wrapper over PostHog.
 *
 * The PostHog snippet in Base.astro loads asynchronously and only when
 * the PUBLIC_POSTHOG_KEY env var is set at build time. That means on
 * local dev (no key in .env) and on deploys without the var, the
 * global `posthog` will never exist — so every call-site has to guard.
 *
 * Rather than sprinkle `if ((window as any).posthog) …` everywhere,
 * import `track(eventName, props?)` from this module. It no-ops
 * cleanly when PostHog isn't loaded, and swallows any call errors so
 * analytics never breaks user flows.
 */

type Props = Record<string, unknown>;

/** Fire a PostHog event. No-op if PostHog isn't loaded (e.g. local dev). */
export function track(event: string, props?: Props): void {
  try {
    const ph = (window as any).posthog;
    if (ph && typeof ph.capture === "function") {
      ph.capture(event, props);
    }
  } catch {
    // Analytics must never throw into the caller.
  }
}
