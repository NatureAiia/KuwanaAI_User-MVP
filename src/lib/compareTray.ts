// A persistent, single-category compare selection — the "tray" a user builds
// while browsing, that survives navigating to a listing's detail page and
// back (or a page reload) instead of resetting whenever the component that
// held the selection unmounts. sessionStorage (not localStorage) is
// deliberate: a comparison set is a browsing-session thing, not something
// that should still be there — possibly stale — weeks later.

export const MIN_COMPARE = 2;
export const MAX_COMPARE = 4;

const STORAGE_KEY = "kuwana:compare-tray";
const CHANGE_EVENT = "kuwana:compare-tray-changed";

export type CompareTrayItem = {
  id: string;
  name: string;
  providerName: string;
  providerLogoUrl: string | null;
};

export type CompareTrayState = {
  sectorSlug: string;
  categoryId: string;
  categoryName: string;
  items: CompareTrayItem[];
};

// Cached alongside the raw string so repeated reads between actual changes
// return the same object reference — required by useSyncExternalStore's
// getSnapshot contract (a snapshot that's `!==` on every call, even when
// nothing changed, causes an infinite re-render loop).
let cachedRaw: string | null = null;
let cachedState: CompareTrayState | null = null;

export function readCompareTray(): CompareTrayState | null {
  if (typeof window === "undefined") return null;
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw === cachedRaw) return cachedState;
  cachedRaw = raw;
  try {
    const parsed = raw ? (JSON.parse(raw) as CompareTrayState) : null;
    cachedState = parsed?.items?.length ? parsed : null;
  } catch {
    cachedState = null;
  }
  return cachedState;
}

export function getCompareTrayServerSnapshot(): CompareTrayState | null {
  return null;
}

export function writeCompareTray(state: CompareTrayState | null) {
  if (typeof window === "undefined") return;
  try {
    if (state && state.items.length > 0) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // sessionStorage unavailable (private mode, quota) — the tray just won't
    // persist across navigation this time; not worth surfacing to the user.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Every `useCompareTray()` instance on the page re-reads storage on this event, so a toggle in one mounted component (e.g. a listing grid) is reflected immediately in another (e.g. the floating tray bar) without prop drilling or a context provider. */
export function subscribeToCompareTray(handler: () => void) {
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}
