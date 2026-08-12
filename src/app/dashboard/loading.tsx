"use client";

import { useState } from "react";
import { LoadingFacts } from "@/components/loading/LoadingFacts";
import { isSoftNav } from "@/components/SoftNavTracker";

export default function Loading() {
  const [soft] = useState(isSoftNav);

  if (soft) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-sky border-t-transparent" />
      </div>
    );
  }

  return <LoadingFacts title="Welcome back" subtitle="Loading your dashboard" />;
}
