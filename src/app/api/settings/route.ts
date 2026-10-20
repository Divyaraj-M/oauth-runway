import { currentUser, signInRequired } from "@/lib/auth/server";
import { deleteAiSettings, getAiSummary, saveAiSettings } from "@/lib/db";
import { credentialsFromInput } from "@/lib/research";
import { seal } from "@/lib/secret-box";

/** The user's AI settings, without the key (only its last 4 characters). */
export async function GET() {
  const user = await currentUser();
  if (!user) return signInRequired();
  return Response.json({ ai: await getAiSummary(user.id) });
}

/**
 * Saves provider, model and search. A new apiKey is encrypted before it touches the database; without one,
 * only model/search change and the stored key is kept.
 */
export async function PUT(req: Request) {
  const user = await currentUser();
  if (!user) return signInRequired();
  const b = (await req.json().catch(() => ({}))) as { provider?: unknown; apiKey?: unknown; model?: unknown; search?: unknown };
  const model = typeof b.model === "string" ? b.model : null;
  const search = b.search === true;

  if (typeof b.apiKey === "string" && b.apiKey.trim()) {
    const creds = credentialsFromInput(b);
    if (!creds) return Response.json({ message: "That doesn't look like a valid key." }, { status: 400 });
    await saveAiSettings(user.id, {
      provider: creds.provider,
      model: creds.provider === "gemini" ? creds.model : null,
      search,
      keySealed: seal(creds.apiKey),
      last4: creds.apiKey.slice(-4),
    });
  } else {
    const current = await getAiSummary(user.id);
    if (!current) return Response.json({ message: "Paste a key first." }, { status: 400 });
    if (b.provider && b.provider !== current.provider) return Response.json({ message: "Paste a key for the new provider." }, { status: 400 });
    await saveAiSettings(user.id, { provider: current.provider, model, search });
  }
  return Response.json({ ai: await getAiSummary(user.id) });
}

export async function DELETE() {
  const user = await currentUser();
  if (!user) return signInRequired();
  await deleteAiSettings(user.id);
  return Response.json({ ai: null });
}
