import { Home } from "@/components/library/home";
import { latestDrafts } from "@/lib/db";
import { CATALOG, GUIDES } from "@/lib/guides";
import { resolveLogos } from "@/lib/logos";
import { TOOLKITS, findToolkit } from "@/lib/toolkits";

// Whether Composio provides the OAuth app, per catalog app (true / false / null = no OAuth); small enough for the client.
const managed = Object.fromEntries(CATALOG.flatMap((c) => {
  const t = findToolkit(c.app);
  return t ? [[c.key, t.managed]] : [];
}));

export default async function Page() {
  const [logos, community] = await Promise.all([resolveLogos(CATALOG), latestDrafts()]);
  return <Home guides={GUIDES} catalog={CATALOG} logos={logos} community={community} managed={managed} toolkitCount={TOOLKITS.length} />;
}
