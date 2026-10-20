import Anthropic from "@anthropic-ai/sdk";

/** Events streamed to the browser as NDJSON, one JSON object per line. */
export type ResearchEvent =
  | { type: "search"; query: string }
  | { type: "fetch"; url: string }
  | { type: "text"; delta: string }
  | { type: "error"; message: string };

export type ResearchLog = {
  /** Queries the model ran. */
  searches: string[];
  /** Pages whose content the model actually opened (web_fetch). Only these may back a "Sourced" claim. */
  opened: string[];
  /** Search hits the model saw as titles/snippets but did not open. */
  seen: { title: string; url: string }[];
};

const MODEL = "claude-opus-5-5";
const MAX_CONTINUATIONS = 5;

// Reads ANTHROPIC_API_KEY (or another SDK credential source) from the server environment. Never sent to the browser.
const client = new Anthropic();

/**
 * One research turn with server-side web search + fetch. Streams text and tool activity through `emit`,
 * resumes `pause_turn` (the server-tool loop's iteration cap), and returns the final text plus what was searched and opened.
 */
export async function research({
  system,
  messages,
  emit,
  effort = "medium",
  maxSearches = 8,
}: {
  system: string;
  messages: Anthropic.Beta.BetaMessageParam[];
  emit: (e: ResearchEvent) => void;
  effort?: "low" | "medium" | "high";
  maxSearches?: number;
}): Promise<{ text: string; log: ResearchLog }> {
  const log: ResearchLog = { searches: [], opened: [], seen: [] };
  const convo = [...messages];
  let text = "";

  for (let turn = 0; turn <= MAX_CONTINUATIONS; turn++) {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      betas: ["server-side-fallback-2026-07-01"],
      // On a safety-classifier decline, the API re-runs the request on Anthropic's recommended fallback model.
      fallbacks: "default",
      output_config: { effort },
      system,
      tools: [
        { type: "web_search_20260209", name: "web_search", max_uses: maxSearches },
        { type: "web_fetch_20260209", name: "web_fetch", max_uses: maxSearches },
      ],
      messages: convo,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        text += event.delta.text;
        emit({ type: "text", delta: event.delta.text });
      }
      if (event.type === "content_block_stop") {
        const block = stream.currentMessage?.content[event.index];
        if (block?.type === "server_tool_use" && block.name === "web_search" && typeof block.input.query === "string") {
          log.searches.push(block.input.query);
          emit({ type: "search", query: block.input.query });
        }
        if (block?.type === "web_fetch_tool_result" && block.content.type === "web_fetch_result") {
          log.opened.push(block.content.url);
          emit({ type: "fetch", url: block.content.url });
        }
        if (block?.type === "web_search_tool_result" && Array.isArray(block.content)) {
          for (const r of block.content) log.seen.push({ title: r.title, url: r.url });
        }
      }
    }

    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") throw new ResearchError("The model declined this request. Rephrase it and try again.");
    if (message.stop_reason !== "pause_turn") return { text, log };
    // Resume: send the paused assistant turn back; the server continues where it stopped.
    convo.push({ role: "assistant", content: message.content });
  }
  return { text, log };
}

export class ResearchError extends Error {}

/** Maps SDK errors to messages safe to show in the UI. */
export function describeError(err: unknown): { status: number; message: string } {
  if (err instanceof ResearchError) return { status: 422, message: err.message };
  if (err instanceof Anthropic.AuthenticationError)
    return { status: 503, message: "The agent isn't connected: ANTHROPIC_API_KEY in .env is missing or invalid." };
  if (err instanceof Anthropic.RateLimitError) return { status: 429, message: "Too many requests right now. Wait a minute and try again." };
  // 400s carry a readable reason (e.g. low credit balance) and never echo the key, so pass it through.
  if (err instanceof Anthropic.BadRequestError) {
    const reason = (err.error as { error?: { message?: string } } | undefined)?.error?.message;
    return { status: 400, message: reason ? `The AI service rejected the request: ${reason}` : "The AI service rejected the request." };
  }
  if (err instanceof Anthropic.APIError) return { status: 502, message: `The AI service returned an error (${err.status ?? "network"}). Try again.` };
  if (err instanceof Error && /api key|apiKey|authentication/i.test(err.message))
    return { status: 503, message: "The agent isn't connected: add ANTHROPIC_API_KEY to .env and restart the server." };
  return { status: 500, message: "Something went wrong. Try again." };
}

/** NDJSON streaming response; `run` writes events and the final payload. */
export function ndjson(run: (send: (obj: unknown) => void) => Promise<void>): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));
      try {
        await run(send);
      } catch (err) {
        console.error(err);
        send({ type: "error", message: describeError(err).message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
