import { Home } from "@/components/library/home";
import { CATALOG, GUIDES } from "@/lib/guides";

export default function Page() {
  return <Home guides={GUIDES} catalog={CATALOG} />;
}
