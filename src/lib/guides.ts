import catalogJson from "../../data/catalog.json";
import aircall from "../../data/guides/aircall.json";
import gmail from "../../data/guides/gmail.json";
import notion from "../../data/guides/notion.json";
import slack from "../../data/guides/slack.json";
import type { CatalogEntry, Guide } from "./types";

/** Reviewed guides, keyed by catalog key. Add a guide by dropping a JSON file in data/guides/ and importing it here. */
export const GUIDES: Record<string, Guide> = Object.fromEntries(
  ([gmail, aircall, slack, notion] as Guide[]).map((g) => [g.key, g]),
);

export const CATALOG: CatalogEntry[] = catalogJson;

export const getGuide = (key: string): Guide | undefined => GUIDES[key];
