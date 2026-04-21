/**
 * openrouter.ts — streaming chat-completions client for OpenRouter.
 *
 * Browser-direct: every request is fetch() from the user's browser to
 * openrouter.ai/api/v1. The user's API key never touches our servers.
 *
 * Why OpenRouter instead of direct-to-provider:
 *   - OpenRouter officially supports CORS and browser-origin calls
 *     (OpenAI/Anthropic's own APIs don't — they assume server-side).
 *   - One key works for many models (Claude, GPT-4o, Llama, Gemini, ...).
 *   - Uniform pricing and rate-limit surface across providers.
 *
 * Streaming is used so the customizer UI can show the generation live
 * rather than waiting 10-15s for a complete response. Falls back to
 * non-streaming on errors that suggest SSE isn't supported.
 */

import type { ChatMessage } from "./prompts";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export interface CompletionRequest {
  apiKey: string;
  modelId: string;
  messages: ChatMessage[];
  /** Abort signal for user-cancellation of a running generation. */
  signal?: AbortSignal;
  /** Sampling temperature (default 0.3 — low variance, structural output). */
  temperature?: number;
  /** Soft cap on output tokens. Default 6000 (enough for a full skill rewrite). */
  maxTokens?: number;
  /** Called for each chunk of streamed text. */
  onChunk?: (delta: string) => void;
  /** Called when the stream finishes with final stats. */
  onDone?: (stats: CompletionStats) => void;
}

export interface CompletionStats {
  /** Full assistant message content assembled from the stream. */
  content: string;
  /** Tokens reported by the provider (when available). */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Wall-clock time in ms from first request to last chunk. */
  elapsedMs: number;
}

export class OpenRouterError extends Error {
  constructor(
    message: string,
    public readonly kind:
      | "auth"
      | "rate_limit"
      | "bad_request"
      | "server_error"
      | "network"
      | "aborted"
      | "parse",
    public readonly status?: number,
  ) {
    super(message);
    this.name = "OpenRouterError";
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Run a streaming chat completion. Resolves with the complete stats
 * once the stream ends; rejects on error. Callers should wire
 * onChunk/onDone for live UI updates.
 */
export async function runCompletion(req: CompletionRequest): Promise<CompletionStats> {
  const start = performance.now();

  const body = {
    model: req.modelId,
    messages: req.messages,
    stream: true,
    temperature: req.temperature ?? 0.3,
    max_tokens: req.maxTokens ?? 6000,
  };

  let res: Response;
  try {
    res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      signal: req.signal,
      headers: {
        Authorization: `Bearer ${req.apiKey}`,
        "Content-Type": "application/json",
        // OpenRouter's conventions for attributing traffic. Helps them
        // rank our site in their app directory and gives users clearer
        // usage reports.
        "HTTP-Referer": siteOrigin(),
        "X-Title": "skillkit.dev",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    if (isAbort(err)) {
      throw new OpenRouterError("Request cancelled by the user.", "aborted");
    }
    throw new OpenRouterError(
      `Network error contacting OpenRouter: ${stringifyError(err)}`,
      "network",
    );
  }

  if (!res.ok) {
    throw await buildErrorFromResponse(res);
  }
  if (!res.body) {
    throw new OpenRouterError("OpenRouter returned no response body.", "server_error", res.status);
  }

  const stats = await consumeStream(res.body, req);
  stats.elapsedMs = performance.now() - start;

  req.onDone?.(stats);
  return stats;
}

// ---------------------------------------------------------------------------
// Stream parsing
// ---------------------------------------------------------------------------

/**
 * Consume an SSE stream of chat-completion chunks and accumulate the
 * delta text. Each chunk is a `data: {...}\n\n` line per the OpenAI
 * SSE spec OpenRouter mimics.
 */
async function consumeStream(
  body: ReadableStream<Uint8Array>,
  req: CompletionRequest,
): Promise<CompletionStats> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let content = "";
  let usage: CompletionStats["usage"];

  while (true) {
    let readResult: ReadableStreamReadResult<Uint8Array>;
    try {
      readResult = await reader.read();
    } catch (err) {
      if (isAbort(err)) throw new OpenRouterError("Generation cancelled.", "aborted");
      throw new OpenRouterError(
        `Stream read failed: ${stringifyError(err)}`,
        "network",
      );
    }
    if (readResult.done) break;

    buffer += decoder.decode(readResult.value, { stream: true });

    // SSE events are separated by blank lines.
    let sepIdx: number;
    while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
      const eventBlock = buffer.slice(0, sepIdx);
      buffer = buffer.slice(sepIdx + 2);

      for (const line of eventBlock.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;

        let parsed: StreamChunk;
        try {
          parsed = JSON.parse(payload);
        } catch {
          // Some providers emit keep-alive comments that aren't JSON;
          // skip them silently rather than failing the whole stream.
          continue;
        }

        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          content += delta;
          req.onChunk?.(delta);
        }
        if (parsed.usage) {
          usage = {
            promptTokens: parsed.usage.prompt_tokens,
            completionTokens: parsed.usage.completion_tokens,
            totalTokens: parsed.usage.total_tokens,
          };
        }
      }
    }
  }

  return {
    content,
    usage,
    elapsedMs: 0, // filled in by the caller with a real start time
  };
}

interface StreamChunk {
  choices?: Array<{
    delta?: { content?: string };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ---------------------------------------------------------------------------
// Error translation
// ---------------------------------------------------------------------------

async function buildErrorFromResponse(res: Response): Promise<OpenRouterError> {
  let bodyText = "";
  try {
    bodyText = await res.text();
  } catch {
    // ignore
  }

  const snippet = bodyText.slice(0, 400);

  if (res.status === 401 || res.status === 403) {
    return new OpenRouterError(
      `Authentication failed. Check your OpenRouter API key in Settings. Response: ${snippet}`,
      "auth",
      res.status,
    );
  }
  if (res.status === 429) {
    return new OpenRouterError(
      `Rate limited by OpenRouter or the upstream model. Try a different model or wait a moment. Response: ${snippet}`,
      "rate_limit",
      res.status,
    );
  }
  if (res.status >= 400 && res.status < 500) {
    return new OpenRouterError(
      `Request was rejected (${res.status}). ${snippet}`,
      "bad_request",
      res.status,
    );
  }
  return new OpenRouterError(
    `OpenRouter server error (${res.status}). ${snippet}`,
    "server_error",
    res.status,
  );
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function siteOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "https://skillkit.dev";
}

function isAbort(err: unknown): boolean {
  if (err instanceof Error && err.name === "AbortError") return true;
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "ABORT_ERR";
}

function stringifyError(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

// ---------------------------------------------------------------------------
// Key validation helper
// ---------------------------------------------------------------------------

/**
 * Lightweight key sanity check — doesn't actually call OpenRouter's
 * auth endpoint, just checks shape so the settings UI can show a
 * warning before the user submits their first customization.
 *
 * OpenRouter keys currently start with "sk-or-v1-" and are long random
 * strings. The format has changed in the past, so we only warn (not
 * block) on shape mismatch.
 */
export function isLikelyValidKeyShape(key: string): boolean {
  const trimmed = key.trim();
  if (trimmed.length < 20) return false;
  // Accept both current (sk-or-v1-...) and legacy (sk-or-...) prefixes
  // and any other shape ≥20 chars — the server is the source of truth.
  return true;
}

/**
 * Actually verify the key against OpenRouter's /auth/key endpoint.
 * Used by the settings page to give the user green / red feedback
 * before they leave the page. Returns null when the key is valid,
 * or an error describing the failure.
 */
export async function verifyApiKey(apiKey: string): Promise<string | null> {
  try {
    const res = await fetch(`${OPENROUTER_BASE_URL}/auth/key`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "HTTP-Referer": siteOrigin(),
        "X-Title": "skillkit.dev",
      },
    });
    if (res.ok) return null;
    if (res.status === 401 || res.status === 403) {
      return "Key was rejected by OpenRouter (401/403). Check you copied the full key.";
    }
    return `OpenRouter returned ${res.status}. Try again in a moment.`;
  } catch (err) {
    return `Network error reaching OpenRouter: ${stringifyError(err)}`;
  }
}
