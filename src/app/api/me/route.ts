import { currentUser, isAdmin } from "@/lib/auth/server";
import { userGuides } from "@/lib/db";

/** Who's signed in, whether they're an admin, and their recent guides. */
export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ user: null, admin: false, guides: [] });
  return Response.json({ user, admin: isAdmin(user), guides: await userGuides(user.id) });
}
