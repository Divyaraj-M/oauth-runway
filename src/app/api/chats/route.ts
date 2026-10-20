import { currentUser } from "@/lib/auth/server";
import { clearChat, getChat } from "@/lib/db";

const keyOf = (req: Request) => (new URL(req.url).searchParams.get("key") ?? "").slice(0, 80);

/** The signed-in user's conversation for one guide (empty when signed out). */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user || !keyOf(req)) return Response.json({ messages: [] });
  return Response.json({ messages: await getChat(user.id, keyOf(req)) });
}

export async function DELETE(req: Request) {
  const user = await currentUser();
  if (!user || !keyOf(req)) return Response.json({ ok: false }, { status: 401 });
  await clearChat(user.id, keyOf(req));
  return Response.json({ ok: true });
}
