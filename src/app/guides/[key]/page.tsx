import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GuideView } from "@/components/guide/guide-view";
import { GUIDES, getGuide } from "@/lib/guides";

export function generateStaticParams() {
  return Object.keys(GUIDES).map((key) => ({ key }));
}

export async function generateMetadata({ params }: PageProps<"/guides/[key]">): Promise<Metadata> {
  const g = getGuide((await params).key);
  return g ? { title: `${g.app} OAuth app · OAuth Runway`, description: g.verdict } : {};
}

export default async function Page({ params }: PageProps<"/guides/[key]">) {
  const g = getGuide((await params).key);
  if (!g) notFound();
  return <GuideView guide={g} />;
}
