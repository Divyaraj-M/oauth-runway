import Anthropic from "@anthropic-ai/sdk";
import { ApiError as GeminiApiError, GoogleGenAI } from "@google/genai";

import { getSealedKey } from "./db";
import { docsHosts, findDocPages, readPage } from "./docs-index";
import { open } from "./secret-box";

/** Events streamed to the browser as NDJSON, one JSON object per line. */
export type ResearchEvent =
  | { type: "search"; query: string }
  | { type: "fetch"; url: string }
  | { type: "note"; text: string }
  | { type: "text"; delta: string }
  | { type: "error"; message: string };

export type ResearchLog = {
  /** Queries the model ran. */
  searches: string[];
  /** Pages whose content the model actually opened. Only these may back a "Sourced" claim. */
  opened: string[];
  /** Search hits the model saw as titles/snippets but did not open. */
  seen: { title: string; url: string }[];
  /** Requested URL → final URL after redirects, so a citation of the requested URL matches the page that opened. */
  aliases: Record<string, string>;
};

export type ChatTurn = { role: "user" | "assistant"; content: string };

/** The caller's own key, decrypted from the database for one request; never logged. */
export type Credentials =
  | { provider: "anthropic"; apiKey: string }
  | { provider: "gemini"; apiKey: string; model: string; search: boolean };

const ANTHROPIC_MODEL = "claude-opus-5-5";
const GEMINI_MODELS = new Set(["gemini-3.8-flash", "gemini-3.5-flash-lite"]);
const MAX_CONTINUATIONS = 5;

const toCredentials = (provider: string, apiKey: string, model?: string | null, search?: boolean): Credentials | null => {
  if (!apiKey || apiKey.length > 500) return null;
  if (provider === "anthropic") return { provider, apiKey };
  if (provider === "gemini") return { provider, apiKey, model: model && GEMINI_MODELS.has(model) ? model : "gemini-3.5-flash-lite", search: !!search };
  return null;
};

/** The signed-in user's saved key, decrypted for this request only. Null when they haven't saved one. */
export async function credentialsFor(userId: string): Promise<Credentials | null> {
  const row = await getSealedKey(userId);
  if (!row) return null;
  try {
    return toCredentials(row.provider, open(row.key_sealed), row.model, row.search);
  } catch {
    return null;
  }
}

/** A key typed into Settings but not saved yet (only for "Test key"). */
export const credentialsFromInput = (b: { provider?: unknown; apiKey?: unknown; model?: unknown; search?: unknown }) =>
  typeof b.provider === "string" && typeof b.apiKey === "string"
    ? toCredentials(b.provider, b.apiKey.trim(), typeof b.model === "string" ? b.model : null, b.search === true)
    : null;

export const modelOf = (c: Credentials) => (c.provider === "anthropic" ? ANTHROPIC_MODEL : c.model);

export const noKey = () =>
  Response.json({ code: "no_key", message: "Add your AI provider key in Settings (top right). It's stored encrypted on your account." }, { status: 401 });

type ResearchArgs = {
  creds: Credentials;
  system: string;
  messages: ChatTurn[];
  emit: (e: ResearchEvent) => void;
  effort?: "low" | "medium" | "high";
  maxSearches?: number;
};

/** One research turn: the model searches and opens pages, streams its answer, and reports what it opened. */
export async function research(args: ResearchArgs): Promise<{ text: string; log: ResearchLog }> {
  const creds = args.creds;
  if (creds.provider === "anthropic") return anthropicResearch(args, creds.apiKey);
  try {
    return await geminiResearch(args, creds);
  } catch (err) {
    // Bigger Gemini models are often overloaded on the free tier. Retry the run once on Flash-Lite;
    // creds.model is updated so the saved guide records the model that actually wrote it.
    if (creds.model === FALLBACK_GEMINI || !isBusyOrSlow(err)) throw err;
    args.emit({ type: "note", text: `${creds.model} is busy; switching to ${FALLBACK_GEMINI}` });
    creds.model = FALLBACK_GEMINI;
    return geminiResearch(args, creds);
  }
}

const FALLBACK_GEMINI = "gemini-3.5-flash-lite";

/** 429/500/503 from Gemini, our own timeouts, or the network dropping. */
const isBusyOrSlow = (err: unknown) =>
  (err instanceof GeminiApiError && [429, 500, 503].includes(err.status)) || isTimeout(err) || isNetwork(err);

/** Node's fetch throws TypeError("fetch failed") when the connection drops or DNS fails. */
const isNetwork = (err: unknown) => err instanceof TypeError && /fetch failed|network|ECONNRESET|ETIMEDOUT|ENOTFOUND/i.test(`${err.message} ${String(err.cause ?? "")}`);

const isTimeout = (err: unknown) => err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError" || /timed? ?out/i.test(err.message));

/** Retries a Gemini call on 503 (overloaded) or a dropped connection, after 1s, then 3s. */
async function withRetry<T>(call: () => Promise<T>): Promise<T> {
  for (const wait of [1000, 3000]) {
    try {
      return await call();
    } catch (err) {
      if (!((err instanceof GeminiApiError && err.status === 503) || isNetwork(err))) throw err;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  return call();
}

/* ---------------- Anthropic: server-side web search + web fetch ---------------- */

async function anthropicResearch({ system, messages, emit, effort = "medium", maxSearches = 8 }: ResearchArgs, apiKey: string) {
  const client = new Anthropic({ apiKey });
  const log: ResearchLog = { searches: [], opened: [], seen: [], aliases: {} };
  const convo: Anthropic.Beta.BetaMessageParam[] = [...messages];
  let text = "";

  for (let turn = 0; turn <= MAX_CONTINUATIONS; turn++) {
    const stream = client.beta.messages.stream({
      model: ANTHROPIC_MODEL,
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

/* ---------------- Gemini: URL context (free tier) + optional Google Search (paid tier) ---------------- */

async function geminiResearch({ system, messages, emit }: ResearchArgs, creds: Extract<Credentials, { provider: "gemini" }>) {
  const ai = new GoogleGenAI({ apiKey: creds.apiKey });
  const log: ResearchLog = { searches: [], opened: [], seen: [], aliases: {} };
  const contents = messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));

  // URL context only reads URLs named in the prompt. Without Google Search (not on the free tier),
  // first ask the model which public pages to read, then let it open them.
  if (!creds.search) {
    emit({ type: "note", text: "Finding the provider's docs" });
    const plan = await withRetry(() => ai.models.generateContent({
      model: creds.model,
      contents: [
        ...contents,
        {
          role: "user",
          parts: [
            {
              text: 'Before answering: name the provider\'s main website domain and up to 6 public URLs (official developer docs first) you would read. Reply with ONLY JSON: {"domain":"example.com","urls":["https://…"]}',
            },
          ],
        },
      ],
      config: { systemInstruction: system, abortSignal: AbortSignal.timeout(45_000) },
    }));
    const { domain, urls: guesses } = parsePlan(plan.text ?? "");

    // Real pages from the provider's llms.txt beat guessed URLs; keep guesses only if they load.
    const hosts = docsHosts(domain, guesses);
    const [{ pages, indexes }, live] = await Promise.all([findDocPages(hosts), liveUrls(guesses)]);
    for (const i of indexes) emit({ type: "note", text: `Found the docs index ${i}` });
    log.aliases = live.aliases;
    const urls = [...new Set([...pages.map((p) => p.url), ...live.ok])].slice(0, 18);

    // Read the top pages ourselves (URL context often skips listed pages) and hand the model their text.
    // These count as opened: their content really was in front of the model.
    const read = (await Promise.all(urls.slice(0, 8).map(async (u) => [u, await readPage(u)] as const))).filter((r): r is readonly [string, string] => !!r[1]);
    for (const [u] of read) {
      log.opened.push(u);
      emit({ type: "fetch", url: u });
    }
    const rest = urls.filter((u) => !read.some(([r]) => r === u));
    if (read.length || rest.length) {
      const pagesText = read.map(([u, t]) => `=== Page: ${u} ===\n${t}`).join("\n\n");
      contents.push({
        role: "user",
        parts: [
          {
            text:
              (read.length ? `Here is the text of the provider's own docs pages (opened for you). Cite these exact URLs in "src" for claims they support:\n\n${pagesText}\n\n` : "") +
              (rest.length ? `More pages you may read with URL context:\n${rest.join("\n")}` : ""),
          },
        ],
      });
    }
  }

  // Watchdog: Gemini sometimes sends the whole answer and then never closes the stream. Abort after a quiet
  // spell (short once text has arrived, longer while it is still opening pages) and use what arrived.
  const ctrl = new AbortController();
  const hardCap = setTimeout(() => ctrl.abort(), 150_000);
  let idle: ReturnType<typeof setTimeout> | undefined;
  let text = "";
  const arm = () => {
    clearTimeout(idle);
    idle = setTimeout(() => ctrl.abort(), text ? 15_000 : 90_000);
  };

  const opened = new Set<string>();
  const searches = new Set<string>();
  try {
    arm();
    const stream = await withRetry(() => ai.models.generateContentStream({
      model: creds.model,
      contents,
      config: { systemInstruction: system, tools: [{ urlContext: {} }, ...(creds.search ? [{ googleSearch: {} }] : [])], abortSignal: ctrl.signal },
    }));
    // Race every read against the watchdog ourselves: the SDK doesn't abort a read that is already waiting.
    const it = stream[Symbol.asyncIterator]();
    const stalled = new Promise<never>((_, reject) => ctrl.signal.addEventListener("abort", () => reject(new Error("stalled")), { once: true }));
    stalled.catch(() => {});
    for (;;) {
      const next = await Promise.race([it.next(), stalled]);
      if (next.done) break;
      const chunk = next.value;
      const delta = chunk.text ?? "";
      if (delta) {
        text += delta;
        emit({ type: "text", delta });
      }
      arm();
      const cand = chunk.candidates?.[0];
      for (const m of cand?.urlContextMetadata?.urlMetadata ?? []) {
        if (m.retrievedUrl && m.urlRetrievalStatus === "URL_RETRIEVAL_STATUS_SUCCESS" && !opened.has(m.retrievedUrl)) {
          opened.add(m.retrievedUrl);
          emit({ type: "fetch", url: m.retrievedUrl });
        }
      }
      for (const q of cand?.groundingMetadata?.webSearchQueries ?? []) {
        if (!searches.has(q)) {
          searches.add(q);
          emit({ type: "search", query: q });
        }
      }
      for (const c of cand?.groundingMetadata?.groundingChunks ?? []) if (c.web?.uri) log.seen.push({ title: c.web.title ?? c.web.uri, url: c.web.uri });
    }
  } catch (err) {
    if (!ctrl.signal.aborted) throw err;
    if (!text) throw new ResearchError("Gemini stopped responding. Try again in a minute.");
    // Stalled after sending its answer: keep what arrived.
    emit({ type: "note", text: "Gemini went quiet; using the answer it sent" });
  } finally {
    clearTimeout(idle);
    clearTimeout(hardCap);
  }
  log.opened = [...new Set([...log.opened, ...opened])];
  log.searches = [...searches];
  return { text, log };
}

/** Checks guessed URLs (5s each): which load, and requested → final URL when they redirect. */
async function liveUrls(urls: string[]): Promise<{ ok: string[]; aliases: Record<string, string> }> {
  const checks = await Promise.all(
    urls.map(async (u) => {
      try {
        const res = await fetch(u, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(5000) });
        return { u, ok: res.ok, final: res.url };
      } catch {
        return { u, ok: false, final: u };
      }
    }),
  );
  return {
    ok: checks.filter((c) => c.ok).map((c) => c.u),
    aliases: Object.fromEntries(checks.filter((c) => c.ok && c.final && c.final !== c.u).map((c) => [c.u, c.final])),
  };
}

function parsePlan(s: string): { domain?: string; urls: string[] } {
  try {
    const o = JSON.parse(s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1)) as { domain?: unknown; urls?: unknown };
    return { domain: typeof o.domain === "string" ? o.domain : undefined, urls: parseUrls(JSON.stringify(o.urls ?? [])).slice(0, 6) };
  } catch {
    return { urls: parseUrls(s).slice(0, 6) };
  }
}

function parseUrls(s: string): string[] {
  try {
    const arr = JSON.parse(s.slice(s.indexOf("["), s.lastIndexOf("]") + 1));
    return Array.isArray(arr) ? arr.filter((u): u is string => typeof u === "string" && /^https:\/\/[^\s/]+\.[^\s]+$/.test(u)) : [];
  } catch {
    return [];
  }
}

/* ---------------- errors + streaming ---------------- */

export class ResearchError extends Error {}

/** Maps provider errors to messages safe to show in the UI. */
export function describeError(err: unknown): { status: number; message: string } {
  if (err instanceof ResearchError) return { status: 422, message: err.message };

  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError)
    return { status: 401, message: "Anthropic rejected the API key. Check it in Settings." };
  if (err instanceof Anthropic.RateLimitError) return { status: 429, message: "Anthropic rate limit hit. Wait a minute and try again." };
  // 400s carry a readable reason (e.g. low credit balance) and never echo the key, so pass it through.
  if (err instanceof Anthropic.BadRequestError) {
    const reason = (err.error as { error?: { message?: string } } | undefined)?.error?.message;
    return { status: 400, message: reason ? `Anthropic rejected the request: ${reason}` : "Anthropic rejected the request." };
  }
  if (err instanceof Anthropic.APIError) return { status: 502, message: `Anthropic returned an error (${err.status ?? "network"}). Try again.` };

  if (isTimeout(err)) return { status: 504, message: "The AI took too long to respond. Try again, or pick Flash-Lite in Settings." };
  if (isNetwork(err)) return { status: 502, message: "Couldn't reach the AI provider (network error). Try again in a moment." };
  if (err instanceof GeminiApiError && err.status === 503)
    return { status: 503, message: "Gemini is overloaded right now. Try again in a minute, or pick Flash-Lite in Settings." };
  if (err instanceof GeminiApiError) {
    if (err.status === 400 && /api key/i.test(err.message)) return { status: 401, message: "Google rejected the API key. Check it in Settings." };
    if (err.status === 401 || err.status === 403) return { status: 401, message: "Google rejected the API key. Check it in Settings." };
    if (err.status === 429) return { status: 429, message: "Gemini rate limit hit (free tier limits are low). Wait a minute and try again." };
    if (err.status === 400 && /search|grounding/i.test(err.message))
      return { status: 400, message: "Google Search isn't available for this key (free tier). Turn it off in Settings." };
    // 4xx bodies carry a readable reason (billing, quota, model access) and never echo the key, so pass it through.
    const reason = geminiReason(err.message);
    if (err.status >= 400 && err.status < 500 && reason) return { status: err.status, message: `Google rejected the request: ${reason}` };
    return { status: 502, message: `Gemini returned an error (${err.status}). Try again.` };
  }
  return { status: 500, message: "Something went wrong. Try again." };
}

/** Gemini's ApiError.message is the JSON error body; pull out its human-readable `message`. */
function geminiReason(raw: string): string | null {
  try {
    const msg = (JSON.parse(raw) as { error?: { message?: string } }).error?.message?.trim();
    return msg ? msg.replace(/\s*Learn more at \S+/, "") : null;
  } catch {
    return null;
  }
}

const redact = (s: string, secret: string) => (secret ? s.split(secret).join("[redacted]") : s);

/** NDJSON streaming response; `run` writes events. Errors become an `error` event; the key is scrubbed from server logs. */
export function ndjson(creds: Credentials, run: (send: (obj: unknown) => void) => Promise<void>): Response {
  const enc = new TextEncoder();
  // Set when the browser goes away mid-stream (navigated off, closed the tab); writes after that are dropped.
  let closed = false;
  const body = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        if (!closed) controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));
      };
      try {
        await run(send);
      } catch (err) {
        const cause = err instanceof Error && err.cause ? ` | cause: ${err.cause instanceof Error ? `${err.cause.name}: ${err.cause.message}` : String(err.cause)}` : "";
        console.error(redact(err instanceof Error ? `${err.name}: ${err.message}${cause}` : String(err), creds.apiKey));
        send({ type: "error", message: describeError(err).message });
      } finally {
        if (!closed) controller.close();
        closed = true;
      }
    },
    cancel() {
      closed = true;
    },
  });
  return new Response(body, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
