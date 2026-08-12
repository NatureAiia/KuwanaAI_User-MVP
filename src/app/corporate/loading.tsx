"use client";

import { useState } from "react";
import { LoadingFacts } from "@/components/loading/LoadingFacts";
import { SoftNavSpinner } from "@/components/loading/SoftNavSpinner";
import { isSoftNav } from "@/components/SoftNavTracker";

export default function Loading() {
  const [soft] = useState(isSoftNav);

  if (soft) {
    return <SoftNavSpinner />;
  }

  return <LoadingFacts title="Welcome back" subtitle="Loading your market intelligence" />;
}
