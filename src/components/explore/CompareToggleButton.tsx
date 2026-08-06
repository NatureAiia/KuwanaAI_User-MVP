"use client";

import { Scale, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useCompareTray } from "@/lib/useCompareTray";

/**
 * Lets a listing's detail page add/remove itself from the same persistent
 * compare tray the explore grid uses — previously the only way onto a
 * comparison was to select from the grid, so anyone who tapped into "View
 * details" to double-check something had no way back in without starting
 * over from the sector page.
 */
export function CompareToggleButton({
  listingId,
  listingName,
  providerName,
  providerLogoUrl,
  sectorSlug,
  categoryId,
  categoryName,
}: {
  listingId: string;
  listingName: string;
  providerName: string;
  providerLogoUrl: string | null;
  sectorSlug: string;
  categoryId: string;
  categoryName: string;
}) {
  const { tray, toggle, isSelected } = useCompareTray();
  const selected = isSelected(categoryId, listingId);
  const blockedByOtherCategory = !selected && !!tray && tray.categoryId !== categoryId;

  return (
    <Button
      variant={selected ? "primary" : "secondary"}
      className="flex-1"
      onClick={() =>
        toggle(sectorSlug, categoryId, categoryName, {
          id: listingId,
          name: listingName,
          providerName,
          providerLogoUrl,
        })
      }
      title={
        blockedByOtherCategory
          ? `Starts a new comparison — your current ${tray.categoryName} selection will be replaced`
          : undefined
      }
    >
      {selected ? <CheckCircle2 size={16} /> : <Scale size={16} />}
      {selected ? "Added to compare" : "Add to compare"}
    </Button>
  );
}
