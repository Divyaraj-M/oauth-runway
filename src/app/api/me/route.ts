import { currentUser, isAdmin } from "@/lib/auth/server";
import { getAiSummary, userGuides } from "@/lib/db";

/** Who's signed in, whether they're an admin, their recent guides, and AI settings (no key). */
export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ user: null, admin: false, guides: [], ai: null });
  const [guides, ai] = await Promise.all([userGuides(user.id), getAiSummary(user.id)]);
  return Response.json({ user, admin: isAdmin(user), guides, ai });
}
