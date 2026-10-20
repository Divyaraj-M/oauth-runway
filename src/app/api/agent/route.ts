import { agentSystem } from "@/lib/prompts";
import { type ChatTurn, credentialsFrom, ndjson, noKey, research } from "@/lib/research";
import { looksLikeSecret } from "@/lib/secrets";
import type { Guide } from "@/lib/types";

export const maxDuration = 300;

type Body = { guide?: Guide; messages?: { role?: unknown; content?: unknown }[] };

export async function POST(req: Request) {
  const creds = credentialsFrom(req);
  if (!creds) return noKey();
  const body = (await req.json().catch(() => null)) as Body | null;
  const g = body?.guide;
  const messages: ChatTurn[] = (body?.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-20)
    .map((m) => ({ role: m.role as "user" | "assistant", content: String(m.content).slice(0, 8000) }));

  if (!g?.app || !Array.isArray(g.steps)) return Response.json({ message: "Missing guide." }, { status: 400 });
  if (messages.at(-1)?.role !== "user") return Response.json({ message: "Ask a question first." }, { status: 400 });
  if (messages.some((m) => m.role === "user" && looksLikeSecret(String(m.content))))
    return Response.json({ message: "Not sent: this looks like a credential." }, { status: 400 });

  return ndjson(creds, async (send) => {
    const { log } = await research({ creds, system: agentSystem(g), messages, emit: send, effort: "low", maxSearches: 4 });
    send({ type: "done", research: { searches: log.searches, opened: log.opened } });
  });
}
