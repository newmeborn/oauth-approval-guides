import type { Metadata } from "next";
import { Suspense } from "react";
import { GenerateRun } from "@/components/GenerateRun";

export const metadata: Metadata = { title: "Generating a guide" };

export default function GeneratePage() {
  return (
    <Suspense>
      <GenerateRun />
    </Suspense>
  );
}
