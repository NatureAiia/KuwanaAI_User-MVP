import { PageSkeleton } from "@/components/ui/PageSkeleton";

/** See PageSkeleton for why loading files are scoped per route and not placed at the app root. */
export default function Loading() {
  return <PageSkeleton rows={5} />;
}
