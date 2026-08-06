import { Star } from "lucide-react";
import { clsx } from "clsx";

// Reviews aren't collected anywhere in the app yet, so `rating` is null for
// most listings — render "No reviews yet" rather than a fake 0-star rating.
export function RatingStars({
  rating,
  reviewCount,
  size = 14,
}: {
  rating: number | null;
  reviewCount: number;
  size?: number;
}) {
  if (rating === null) {
    return <p className="text-[12px] text-text-muted">No reviews yet</p>;
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            size={size}
            className={clsx(n <= Math.round(rating) ? "fill-accent-teal text-accent-teal" : "text-border")}
          />
        ))}
      </div>
      <p className="text-[12.5px] font-medium text-text-secondary">
        {rating.toFixed(1)} <span className="text-text-muted">({reviewCount})</span>
      </p>
    </div>
  );
}
