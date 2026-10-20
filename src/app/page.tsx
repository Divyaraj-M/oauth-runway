import { Home } from "@/components/library/home";
import { CATALOG, GUIDES } from "@/lib/guides";
import { resolveLogos } from "@/lib/logos";

export default async function Page() {
  return <Home guides={GUIDES} catalog={CATALOG} logos={await resolveLogos(CATALOG)} />;
}
