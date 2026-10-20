export { cn } from "cn"

/** Name key for matching apps across sources ("Google Drive" ≈ "googledrive"). */
export const normName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
