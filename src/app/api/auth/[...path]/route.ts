import { auth } from "@/lib/auth/server";

// Proxies every auth request (sign-in, sign-up, OAuth callbacks, session) to Neon Auth.
export const { GET, POST } = auth.handler();
