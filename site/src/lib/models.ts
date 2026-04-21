/**
 * Model catalog — the OpenRouter models surfaced in the customizer picker.
 *
 * Pricing is per million tokens, sourced from openrouter.ai/models. Keep
 * this list short (≤6 models) — the goal is a clear price/quality
 * spectrum, not a comprehensive directory.
 *
 * OpenRouter model ids are of the form "<vendor>/<slug>" and should match
 * exactly what openrouter.ai/api/v1/chat/completions accepts as `model`.
 *
 * When a new model should land here:
 *   - It must be available on OpenRouter (not private / preview-only).
 *   - It must support a ≥32k context window (a SKILL.md plus headroom
 *     for system prompt and output easily takes 8k-12k tokens).
 *   - Its pricing must be current within the last 30 days.
 */

export interface Model {
  /** OpenRouter model id — used as `model` field on the chat completions call. */
  id: string;
  /** Human-readable name shown in the picker. */
  label: string;
  /** Vendor / family for sorting and grouping. */
  vendor: "anthropic" | "openai" | "google" | "meta" | "mistral";
  /** One-line positioning used next to the label. */
  blurb: string;
  /** Price per 1 million input tokens (USD). */
  inputUsdPerM: number;
  /** Price per 1 million output tokens (USD). */
  outputUsdPerM: number;
  /** Maximum context window in tokens. */
  contextWindow: number;
  /** Whether this is the recommended default. */
  recommended?: boolean;
}

/**
 * Models available in the customizer. Claude 3.5 Sonnet is marked as the
 * recommended default — in practice it produces the most consistent
 * structured-rewrite output for this kind of task (preserving all H2
 * sections, respecting frontmatter constraints, not inventing new
 * headings). GPT-4o Mini and Llama 3.1 70B are cheaper alternatives.
 */
export const MODELS: readonly Model[] = [
  {
    id: "anthropic/claude-3.5-sonnet",
    label: "Claude 3.5 Sonnet",
    vendor: "anthropic",
    blurb: "Best structural fidelity on SKILL.md rewrites",
    inputUsdPerM: 3.0,
    outputUsdPerM: 15.0,
    contextWindow: 200_000,
    recommended: true,
  },
  {
    id: "anthropic/claude-3.5-haiku",
    label: "Claude 3.5 Haiku",
    vendor: "anthropic",
    blurb: "Fast, cheap; quality still solid on short skills",
    inputUsdPerM: 0.8,
    outputUsdPerM: 4.0,
    contextWindow: 200_000,
  },
  {
    id: "openai/gpt-4o",
    label: "GPT-4o",
    vendor: "openai",
    blurb: "Good generalist fallback",
    inputUsdPerM: 2.5,
    outputUsdPerM: 10.0,
    contextWindow: 128_000,
  },
  {
    id: "openai/gpt-4o-mini",
    label: "GPT-4o Mini",
    vendor: "openai",
    blurb: "Budget pick from OpenAI",
    inputUsdPerM: 0.15,
    outputUsdPerM: 0.6,
    contextWindow: 128_000,
  },
  {
    id: "google/gemini-2.0-flash-001",
    label: "Gemini 2.0 Flash",
    vendor: "google",
    blurb: "Very fast and very cheap",
    inputUsdPerM: 0.1,
    outputUsdPerM: 0.4,
    contextWindow: 1_000_000,
  },
  {
    id: "meta-llama/llama-3.1-70b-instruct",
    label: "Llama 3.1 70B",
    vendor: "meta",
    blurb: "Open-weight, cheapest option, lower structural fidelity",
    inputUsdPerM: 0.3,
    outputUsdPerM: 0.4,
    contextWindow: 131_072,
  },
] as const;

/** The default model when a user hasn't picked one. */
export const DEFAULT_MODEL_ID = "anthropic/claude-3.5-sonnet";

export function getModelById(id: string): Model | undefined {
  return MODELS.find((m) => m.id === id);
}

export function recommendedModel(): Model {
  return MODELS.find((m) => m.recommended) ?? MODELS[0];
}

/**
 * Rough cost estimate for a single customization run.
 *
 * Rationale for the numbers: a SKILL.md is typically 200-500 lines,
 * which is ~2000-4000 input tokens. System prompt adds ~600 tokens.
 * Customization form adds ~200 tokens. Output is similar in length to
 * the input (rewrite, not summary) so ~2000-4000 output tokens. Add
 * 25% headroom.
 *
 * Callers should pass the actual SKILL.md length (in characters) for a
 * less fuzzy estimate.
 */
export function estimateCostUsd(
  model: Model,
  opts: { skillMdChars?: number; formChars?: number } = {},
): { low: number; high: number; midpoint: number } {
  const skillChars = opts.skillMdChars ?? 10_000; // ~2500 tokens
  const formChars = opts.formChars ?? 500;

  // Rough char → token ratio. Conservative (3 chars/token on English+code).
  const approxTokens = (chars: number) => Math.ceil(chars / 3);

  const systemPromptTokens = 800;
  const inputTokensLow = systemPromptTokens + approxTokens(skillChars) + approxTokens(formChars);
  const inputTokensHigh = Math.ceil(inputTokensLow * 1.25);

  // Output typically 0.8x-1.2x of the original skill length.
  const outputTokensLow = Math.ceil(approxTokens(skillChars) * 0.8);
  const outputTokensHigh = Math.ceil(approxTokens(skillChars) * 1.2);

  const low =
    (inputTokensLow * model.inputUsdPerM) / 1_000_000 +
    (outputTokensLow * model.outputUsdPerM) / 1_000_000;

  const high =
    (inputTokensHigh * model.inputUsdPerM) / 1_000_000 +
    (outputTokensHigh * model.outputUsdPerM) / 1_000_000;

  return {
    low,
    high,
    midpoint: (low + high) / 2,
  };
}

/** Format a USD amount for display with sensible precision. */
export function formatUsd(n: number): string {
  if (n < 0.01) return `<$0.01`;
  if (n < 0.1) return `$${n.toFixed(3)}`;
  if (n < 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(2)}`;
}

/** Format a cost range as "~$0.04" or "$0.02 – $0.05". */
export function formatCostRange(range: { low: number; high: number }): string {
  if (Math.abs(range.high - range.low) < 0.005) {
    return `~${formatUsd((range.low + range.high) / 2)}`;
  }
  return `${formatUsd(range.low)} – ${formatUsd(range.high)}`;
}
