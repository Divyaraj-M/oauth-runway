"use server";

import { updateTag } from "next/cache";

import { currentUser, isAdmin } from "@/lib/auth/server";
import { GUIDES_TAG, logEvent, setGuideStatus } from "@/lib/db";

type Result = { ok: boolean; message?: string };

/** Refresh the guide page and the shared library after a status change. */
const refresh = (id: string) => {
  updateTag(`guide-${id}`);
  updateTag(GUIDES_TAG);
};

/** Author: draft → published (public, pending approval). */
export async function publishGuide(id: string): Promise<Result> {
  const user = await currentUser();
  if (!user) return { ok: false, message: "Sign in to publish." };
  const ok = await setGuideStatus(id, { to: "published", ownerId: user.id });
  if (!ok) return { ok: false, message: "Only the author can publish a draft." };
  refresh(id);
  await logEvent({ userId: user.id, kind: "publish", app: id, ok: true });
  return { ok: true };
}

/** Admin: published → approved. */
export async function approveGuide(id: string): Promise<Result> {
  const user = await currentUser();
  if (!isAdmin(user)) return { ok: false, message: "Only a reviewer can approve." };
  const ok = await setGuideStatus(id, { to: "approved", adminId: user!.id });
  if (!ok) return { ok: false, message: "This guide isn't waiting for approval." };
  refresh(id);
  await logEvent({ userId: user!.id, kind: "approve", app: id, ok: true });
  return { ok: true };
}

/** Admin: back to draft (hidden from the library) so the author can rework it. */
export async function sendBackGuide(id: string): Promise<Result> {
  const user = await currentUser();
  if (!isAdmin(user)) return { ok: false, message: "Only a reviewer can send a guide back." };
  const ok = await setGuideStatus(id, { to: "draft", adminId: user!.id });
  if (!ok) return { ok: false, message: "This guide isn't published." };
  refresh(id);
  await logEvent({ userId: user!.id, kind: "send_back", app: id, ok: true });
  return { ok: true };
}

/** Form-action wrappers for the admin review queue (server component forms). */
export async function approveFromQueue(id: string) {
  await approveGuide(id);
}
export async function sendBackFromQueue(id: string) {
  await sendBackGuide(id);
}
