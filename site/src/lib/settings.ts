/**
 * settings.ts — localStorage-backed user settings for the customizer.
 *
 * Every key under the `skillkit.` namespace to avoid collisions with
 * other apps the user might run on the same origin during dev
 * (localhost:4321). Nothing is ever sent to a server.
 *
 * Design notes:
 *
 *   - API key is stored in localStorage unencrypted. This is the same
 *     posture as every other browser tool that takes an API key
 *     (OpenAI Playground, Anthropic console alt-views, etc.). Users
 *     who want tighter control use a session-scoped key or revoke
 *     after use — behaviour we recommend in the settings UI copy.
 *
 *   - Environment prefill (techStack, scale, constraints) is optional
 *     and meant to speed up repeat customizations. A user who sets it
 *     once can re-customize any skill without retyping the same
 *     context each time.
 *
 *   - getSettings() returns a fully-populated object with defaults so
 *     components never have to guard against undefined. Use
 *     hasApiKey() to check whether a real key has been configured.
 */

import { DEFAULT_MODEL_ID } from "./models";

const KEYS = {
  apiKey: "skillkit.openrouter.apiKey",
  modelId: "skillkit.model.id",
  envTechStack: "skillkit.environment.techStack",
  envScale: "skillkit.environment.scale",
  envConstraints: "skillkit.environment.constraints",
  customizations: "skillkit.customizations",
} as const;

export type Scale = "startup" | "scaleup" | "enterprise" | "personal" | "unspecified";

export interface EnvironmentContext {
  techStack: string;
  scale: Scale;
  constraints: string;
}

export interface Settings {
  apiKey: string;
  modelId: string;
  environment: EnvironmentContext;
}

export const EMPTY_SETTINGS: Settings = {
  apiKey: "",
  modelId: DEFAULT_MODEL_ID,
  environment: {
    techStack: "",
    scale: "unspecified",
    constraints: "",
  },
};

/** Read a raw string from localStorage, or empty string if unavailable. */
function readString(key: string): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeString(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    if (value) {
      window.localStorage.setItem(key, value);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Storage quota or disabled — surface via UI toast in Phase B2.
  }
}

function isScale(v: string): v is Scale {
  return (
    v === "startup" ||
    v === "scaleup" ||
    v === "enterprise" ||
    v === "personal" ||
    v === "unspecified"
  );
}

/** Read all settings with defaults filled in. */
export function getSettings(): Settings {
  const apiKey = readString(KEYS.apiKey);
  const modelId = readString(KEYS.modelId) || DEFAULT_MODEL_ID;
  const scale = readString(KEYS.envScale);
  return {
    apiKey,
    modelId,
    environment: {
      techStack: readString(KEYS.envTechStack),
      scale: isScale(scale) ? scale : "unspecified",
      constraints: readString(KEYS.envConstraints),
    },
  };
}

/** True when the user has configured a non-empty API key. */
export function hasApiKey(): boolean {
  return readString(KEYS.apiKey).trim().length > 0;
}

export function setApiKey(key: string): void {
  writeString(KEYS.apiKey, key.trim());
}

export function clearApiKey(): void {
  writeString(KEYS.apiKey, "");
}

export function setModelId(id: string): void {
  writeString(KEYS.modelId, id);
}

export function setEnvironment(env: Partial<EnvironmentContext>): void {
  if (typeof env.techStack === "string") writeString(KEYS.envTechStack, env.techStack);
  if (typeof env.scale === "string") writeString(KEYS.envScale, env.scale);
  if (typeof env.constraints === "string") writeString(KEYS.envConstraints, env.constraints);
}

/** Mask an API key for display: `sk-or-…abcd` (last 4 visible). */
export function maskApiKey(key: string): string {
  const k = key.trim();
  if (!k) return "";
  if (k.length <= 8) return "•".repeat(k.length);
  return `${k.slice(0, 6)}${"•".repeat(6)}${k.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Saved customizations (localStorage history)
// ---------------------------------------------------------------------------

export interface SavedCustomization {
  id: string;
  skillSlug: string;
  createdAt: string; // ISO
  modelId: string;
  environment: EnvironmentContext;
  extraPrompt: string;
  /** The resulting customized SKILL.md content (frontmatter + body). */
  customSkillMd: string;
}

const MAX_CUSTOMIZATIONS = 20;

export function getCustomizations(): SavedCustomization[] {
  const raw = readString(KEYS.customizations);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as SavedCustomization[];
  } catch {
    return [];
  }
}

export function saveCustomization(c: SavedCustomization): void {
  const existing = getCustomizations();
  const merged = [c, ...existing.filter((x) => x.id !== c.id)].slice(0, MAX_CUSTOMIZATIONS);
  writeString(KEYS.customizations, JSON.stringify(merged));
}

export function deleteCustomization(id: string): void {
  const existing = getCustomizations();
  const filtered = existing.filter((x) => x.id !== id);
  writeString(KEYS.customizations, JSON.stringify(filtered));
}

/** Generate a short, unique id for a new customization. */
export function newCustomizationId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const ts = Date.now().toString(36);
  return `cust_${ts}_${rand}`;
}
