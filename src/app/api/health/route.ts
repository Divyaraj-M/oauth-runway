import { neon } from "@neondatabase/serverless";
import { connection } from "next/server";

/**
 * Liveness check, also called hourly by .github/workflows/keepalive.yml so the Neon project and the Vercel
 * function see regular activity. Runs one trivial query; returns no data.
 */
export async function GET() {
  await connection(); // per request, never prerendered
  const t0 = Date.now();
  try {
    await neon(process.env.DATABASE_URL!)`select 1`;
    return Response.json({ ok: true, db_ms: Date.now() - t0 }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
