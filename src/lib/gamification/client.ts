export type GamificationUpdate = {
  totalXp: number;
  level: number;
  newBadges: { name: string; description: string }[];
};

const EVENT_NAME = "kuwana:gamification-update";

/** Dispatches a browser event so <GamificationToastHost/> can show a toast
 * from anywhere client-side, without prop-drilling gamification state. */
export function notifyGamification(update: GamificationUpdate | null | undefined) {
  if (!update || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<GamificationUpdate>(EVENT_NAME, { detail: update }));
}

export function onGamificationUpdate(handler: (update: GamificationUpdate) => void) {
  const listener = (e: Event) => handler((e as CustomEvent<GamificationUpdate>).detail);
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
