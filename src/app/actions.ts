"use server";

import { updateTag } from "next/cache";

import { GUIDES_TAG } from "@/lib/db";

/** Called after a generation finishes so the shared library shows the new guide right away (read-your-own-writes). */
export async function refreshLibrary() {
  updateTag(GUIDES_TAG);
}
