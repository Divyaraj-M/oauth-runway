import { createNeonAuth } from "@neondatabase/auth/next/server";
import { connection } from "next/server";

/** Neon Auth (Managed Better Auth). Users and sessions live in the neon_auth schema of our Neon database. */
export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! },
  logLevel: "warn",
});

export type User = { id: string; email: string; name: string; image?: string | null };

/** The signed-in user, or null. Reads cookies, so callers render dynamically (inside Suspense on pages). */
export async function currentUser(): Promise<User | null> {
  // Per-request by definition: stop prerendering here, so a build never bakes in "signed out".
  await connection();
  try {
    const { data } = await auth.getSession();
    const u = data?.user;
    return u ? { id: u.id, email: u.email, name: u.name, image: u.image } : null;
  } catch {
    return null;
  }
}

/** Admins are listed in ADMIN_EMAILS (comma-separated). */
export const isAdmin = (u: User | null) =>
  !!u &&
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(u.email.toLowerCase());

export const signInRequired = () =>
  Response.json({ code: "sign_in", message: "Sign in to generate guides and ask the agent." }, { status: 401 });
