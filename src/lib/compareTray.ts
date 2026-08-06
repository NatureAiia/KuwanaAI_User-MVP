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

export function readCompareTray(): CompareTrayState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CompareTrayState;
    if (!parsed?.items?.length) return null;
    return parsed;
  } catch {
    return null;
  }
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
