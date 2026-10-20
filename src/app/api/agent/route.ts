import { currentUser, signInRequired } from "@/lib/auth/server";
import { appendChat, logEvent } from "@/lib/db";
import { agentSystem } from "@/lib/prompts";
import { type ChatTurn, credentialsFor, describeError, modelOf, ndjson, noKey, research } from "@/lib/research";
import { looksLikeSecret } from "@/lib/secrets";
import type { Guide } from "@/lib/types";

export const maxDuration = 300;

type Body = { guide?: Guide; chatKey?: unknown; messages?: { role?: unknown; content?: unknown }[] };

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return signInRequired();
  const creds = await credentialsFor(user.id);
  if (!creds) return noKey();
  const body = (await req.json().catch(() => null)) as Body | null;
  const g = body?.guide;
  const chatKey = typeof body?.chatKey === "string" ? body.chatKey.slice(0, 80) : "";
  const messages: ChatTurn[] = (body?.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-20)
    .map((m) => ({ role: m.role as "user" | "assistant", content: String(m.content).slice(0, 8000) }));

  if (!g?.app || !Array.isArray(g.steps)) return Response.json({ message: "Missing guide." }, { status: 400 });
  const question = messages.at(-1);
  if (question?.role !== "user") return Response.json({ message: "Ask a question first." }, { status: 400 });
  if (messages.some((m) => m.role === "user" && looksLikeSecret(String(m.content))))
    return Response.json({ message: "Not sent: this looks like a credential." }, { status: 400 });

  const t0 = Date.now();
  return ndjson(creds, async (send) => {
    try {
      const { text, log } = await research({ creds, system: agentSystem(g), messages, emit: send, effort: "low", maxSearches: 4 });
      const at = new Date().toISOString();
      // Saved per user per guide, so the conversation is there next time (any device).
      if (chatKey)
        await appendChat(user.id, chatKey, [
          { role: "user", content: question.content, at },
          { role: "assistant", content: text, at, trace: [...log.searches.map((q) => `Searched “${q}”`), ...log.opened.map((u) => `Opened ${u.replace(/^https?:\/\//, "")}`)] },
        ]);
      await logEvent({ userId: user.id, kind: "ask", app: g.app, ok: true, ms: Date.now() - t0, detail: { model: modelOf(creds), opened: log.opened.length } });
      send({ type: "done", research: { searches: log.searches, opened: log.opened } });
    } catch (err) {
      await logEvent({ userId: user.id, kind: "ask", app: g.app, ok: false, ms: Date.now() - t0, detail: { error: describeError(err).message } });
      throw err;
    }
  });
}
