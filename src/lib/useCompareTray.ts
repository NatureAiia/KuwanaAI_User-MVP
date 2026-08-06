"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  MAX_COMPARE,
  getCompareTrayServerSnapshot,
  readCompareTray,
  subscribeToCompareTray,
  writeCompareTray,
  type CompareTrayItem,
  type CompareTrayState,
} from "@/lib/compareTray";

export function useCompareTray() {
  const tray = useSyncExternalStore(subscribeToCompareTray, readCompareTray, getCompareTrayServerSnapshot);

  const toggle = useCallback(
    (sectorSlug: string, categoryId: string, categoryName: string, item: CompareTrayItem) => {
      const current = readCompareTray();
      // Selecting from a different category than the one already in the
      // tray starts a fresh set — the compare table only makes sense within
      // a single category's attribute schema.
      const base: CompareTrayState =
        current && current.categoryId === categoryId
          ? current
          : { sectorSlug, categoryId, categoryName, items: [] };

      const alreadyIn = base.items.some((i) => i.id === item.id);
      let items: CompareTrayItem[];
      if (alreadyIn) {
        items = base.items.filter((i) => i.id !== item.id);
      } else {
        if (base.items.length >= MAX_COMPARE) return;
        items = [...base.items, item];
      }

      writeCompareTray(items.length > 0 ? { ...base, items } : null);
    },
    [],
  );

  const remove = useCallback((id: string) => {
    const current = readCompareTray();
    if (!current) return;
    const items = current.items.filter((i) => i.id !== id);
    writeCompareTray(items.length > 0 ? { ...current, items } : null);
  }, []);

  const clear = useCallback(() => writeCompareTray(null), []);

  const isSelected = useCallback(
    (categoryId: string, id: string) =>
      !!tray && tray.categoryId === categoryId && tray.items.some((i) => i.id === id),
    [tray],
  );

  return { tray, toggle, remove, clear, isSelected };
}
