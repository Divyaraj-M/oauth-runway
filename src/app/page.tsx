import { Home } from "@/components/library/home";
import { latestDrafts } from "@/lib/db";
import { CATALOG, GUIDES } from "@/lib/guides";
import { resolveLogos } from "@/lib/logos";

export default async function Page() {
  const [logos, community] = await Promise.all([resolveLogos(CATALOG), latestDrafts()]);
  return <Home guides={GUIDES} catalog={CATALOG} logos={logos} community={community} />;
}
