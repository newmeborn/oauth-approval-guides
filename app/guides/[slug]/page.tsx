import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuideView } from "@/components/GuideView";
import { findInLibrary, loadLibrary } from "@/lib/guide/library";

export function generateStaticParams() {
  return loadLibrary().map((g) => ({ slug: g.app.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const guide = findInLibrary((await params).slug);
  return guide
    ? { title: `${guide.app.name}: OAuth app setup and approval`, description: guide.provenance.summary }
    : { title: "Guide not found" };
}

export default async function LibraryGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const guide = findInLibrary((await params).slug);
  if (!guide) notFound();
  return <GuideView guide={guide} />;
}
