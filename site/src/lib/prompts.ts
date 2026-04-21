/**
 * prompts.ts — builds the messages we send to OpenRouter for a
 * customization run.
 *
 * The LLM's job: take a SKILL.md plus the user's environment context,
 * return a modified SKILL.md that's adapted to the user's stack while
 * preserving the skill's structural invariants (frontmatter, section
 * headings, safety posture).
 *
 * The system prompt does the heavy lifting here — it encodes the rules
 * that prevent the LLM from drifting the output into something that
 * isn't a valid SKILL.md anymore. User prompt just supplies the
 * content: original skill + environment + extra instructions.
 */

import type { EnvironmentContext } from "./settings";

export interface PromptInput {
  /** The full original SKILL.md content (frontmatter + body). */
  originalSkillMd: string;
  /** Slug of the skill (for log lines and the system-prompt preamble). */
  skillSlug: string;
  /** Department slug (e.g. "infrastructure"). */
  department: string;
  /** Original safety level declared in frontmatter — the LLM must not lower this. */
  originalSafety: "safe" | "writes-local" | "writes-shared" | "destructive";
  /** User-supplied environment context from the form. */
  environment: EnvironmentContext;
  /** Free-text extra instructions the user typed for this customization. */
  extraPrompt: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Build the two-message conversation we send to OpenRouter.
 *
 * We deliberately use only system + user roles — no few-shot assistant
 * turns — to keep token usage minimal. The instructions in the system
 * prompt carry the same constraints that few-shot examples would
 * enforce, with less ambiguity.
 */
export function buildMessages(input: PromptInput): ChatMessage[] {
  return [
    { role: "system", content: buildSystemPrompt(input) },
    { role: "user", content: buildUserPrompt(input) },
  ];
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

export function buildSystemPrompt(input: PromptInput): string {
  return `You are the customization engine for skillkit.dev, a library of Claude Code skills distributed as SKILL.md files. Your job is to take an existing SKILL.md and produce a modified version that is adapted to the user's stated environment and constraints, while preserving the skill's structural integrity.

SKILL.md structure (invariants you MUST preserve):

1. YAML frontmatter at the top delimited by --- on its own lines.
   Required fields that must remain present and unchanged in name and type:
     - name        (string — do NOT change the slug)
     - description (string — may be refined for tone / clarity, must stay one sentence starting with "Use when")
     - safety      (enum: safe | writes-local | writes-shared | destructive)
   Optional fields that may be present; keep them unless the user's
   request explicitly requires otherwise:
     - supported-stacks  (list of strings)
     - produces          (string path)
     - consumes          (list of strings)
     - chains            (list of skill slugs)

2. H2 section headings (##) in this order. All MUST be present in the output:
     ## When to use
     ## Inputs
     ## Outputs
     ## Tool dependencies
     ## Procedure
     ## Examples
     ## Constraints
     ## Quality checks
   Orchestrator skills (those with non-empty \`chains:\`) also have:
     ## Chained skills
   Preserve it if present.

3. If the original Procedure section begins with a "Detect the stack"
   step (or similar detection-first step), KEEP the detection step and
   UPDATE its commands to reflect the user's stack. Do not remove the
   detection step; it's a kit-wide convention that fails loudly on
   mismatched stacks.

Safety rules:

  - NEVER lower the safety level. If original is \`${input.originalSafety}\`, your output's safety MUST be \`${input.originalSafety}\` or higher in the ordering: safe < writes-local < writes-shared < destructive.
  - NEVER remove warnings or Constraints items from the original. You may ADD constraints relevant to the user's stack, and you may rewrite existing constraints for clarity, but the warning content must survive.
  - NEVER remove Quality-check items. You may add new ones; you may refine wording; the verification obligations stay.

Customization rules:

  - The skill is \`${input.skillSlug}\` from the \`${input.department}\` department.
  - Adapt examples, commands, and config snippets to the user's tech stack when doing so is safe and clearly applicable.
  - Update \`supported-stacks:\` to include the user's stack IF it's new and IF the skill's procedure genuinely supports it after your edits. Do not simply append — only add stacks the rewritten procedure actually handles.
  - If the user's stack is fundamentally outside the skill's scope, you must refuse by emitting a SKILL.md whose body still works for the original stacks AND whose Constraints section explains why this skill does not apply to the user's stack. Do not hallucinate support you did not actually add.
  - Preserve numbered list ordering in Procedure unless renumbering is needed because you added a step.

Output format (STRICT):

  - Return ONLY the complete modified SKILL.md. No preamble, no explanation, no code fences around the entire file.
  - The first three characters of your response MUST be "---" (the opening frontmatter delimiter).
  - Close the frontmatter with a second "---" line, then a blank line, then the body.
  - Use triple-backtick code fences for shell/config/code blocks in the body as the original does.
  - Keep line length reasonable (soft wrap at ~100 chars) but do not add hard line breaks inside paragraphs.
  - Do NOT include commentary like "Here is the modified skill:" — the response must BE the skill, nothing else.

Quality bar:

  - The output must be a valid SKILL.md that would pass the repo's CI skill-validator: frontmatter parses, required fields present, required H2 sections present in order, safety in the enum, no broken YAML.
  - Examples in the Examples section should be adapted to the user's stack (e.g. if user said "Python/FastAPI", examples should use FastAPI idioms, not Express).
  - Do not fabricate URLs, package versions, or command-line flags that aren't from the original or don't exist. When unsure, keep the original.

Tone: technical, direct, no marketing language. Match the voice of the original SKILL.md. No emojis unless the original had them.`;
}

// ---------------------------------------------------------------------------
// User prompt
// ---------------------------------------------------------------------------

export function buildUserPrompt(input: PromptInput): string {
  const envLines = buildEnvironmentSection(input.environment);
  const extraSection = input.extraPrompt.trim()
    ? `\n\nAdditional instructions for this customization:\n\n${input.extraPrompt.trim()}`
    : "";

  return `Customize the SKILL.md below for the user's environment.

User environment:

${envLines}${extraSection}

Original SKILL.md follows (between the markers). Return the modified SKILL.md only — nothing before, nothing after, just the skill content starting with its own --- frontmatter line.

<<<ORIGINAL-SKILL-START>>>
${input.originalSkillMd.trim()}
<<<ORIGINAL-SKILL-END>>>`;
}

function buildEnvironmentSection(env: EnvironmentContext): string {
  const lines: string[] = [];
  if (env.techStack.trim()) {
    lines.push(`- Tech stack: ${env.techStack.trim()}`);
  } else {
    lines.push("- Tech stack: not provided (use the original stack)");
  }
  lines.push(`- Scale: ${env.scale}`);
  if (env.constraints.trim()) {
    lines.push(`- Constraints / quirks: ${env.constraints.trim()}`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Post-processing
// ---------------------------------------------------------------------------

/**
 * Strip common LLM "helpful" artefacts from the response — a leading
 * "Here's the modified skill:" line, code fences wrapping the whole
 * document, trailing commentary. The system prompt tells the model not
 * to do these things, but defence-in-depth is cheap.
 *
 * Returns the cleaned SKILL.md content, ready to be saved / downloaded.
 * Does not validate structure — that's a separate pass in B2.
 */
export function cleanLlmOutput(raw: string): string {
  let out = raw.trim();

  // Drop leading fences that wrap the entire document:
  //   ```markdown\n...\n```
  //   ```\n...\n```
  const fenceOpen = /^```(?:markdown|md)?\s*\n/;
  const fenceClose = /\n```\s*$/;
  if (fenceOpen.test(out) && fenceClose.test(out)) {
    out = out.replace(fenceOpen, "").replace(fenceClose, "");
  }

  // Drop a common preamble line when the model ignores the "no preamble"
  // instruction. We only strip if it's before the --- frontmatter marker.
  const firstFm = out.indexOf("---");
  if (firstFm > 0) {
    const before = out.slice(0, firstFm);
    if (/^(here'?s|below is|the following|modified|customized|customised)/i.test(before.trim())) {
      out = out.slice(firstFm);
    }
  }

  return out.trim() + "\n";
}

/**
 * Basic structural checks on the LLM output. Not a full schema
 * validation — that's Phase B2 when we integrate the skill-validator
 * script. This exists so the diff view can show a warning badge when
 * the output looks suspicious.
 */
export function quickValidate(skillMd: string): {
  ok: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (!skillMd.startsWith("---")) {
    issues.push("Output does not start with --- frontmatter delimiter.");
  }

  // Find the closing frontmatter.
  const body = skillMd.replace(/^---[\s\S]*?\n---\n?/, "");

  const requiredHeadings = [
    "## When to use",
    "## Inputs",
    "## Outputs",
    "## Tool dependencies",
    "## Procedure",
    "## Examples",
    "## Constraints",
    "## Quality checks",
  ];
  for (const h of requiredHeadings) {
    if (!body.includes(h)) {
      issues.push(`Missing section: "${h}"`);
    }
  }

  if (!/^name:\s*\S/m.test(skillMd)) {
    issues.push("Missing `name:` in frontmatter.");
  }
  if (!/^description:\s*\S/m.test(skillMd)) {
    issues.push("Missing `description:` in frontmatter.");
  }
  if (!/^safety:\s*(safe|writes-local|writes-shared|destructive)\b/m.test(skillMd)) {
    issues.push("Missing or invalid `safety:` in frontmatter.");
  }

  return { ok: issues.length === 0, issues };
}
