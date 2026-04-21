#!/usr/bin/env tsx
/**
 * generate-manifest.ts
 *
 * Walks ../departments/*\/skills/*\/SKILL.md, parses YAML frontmatter and
 * body, and writes two artifacts the Astro build consumes:
 *
 *   site/src/data/skills.json
 *       Structured manifest consumed by index pages, search, and (Phase B)
 *       the customizer. One entry per skill with name, department,
 *       description, safety, supported-stacks, produces/consumes/chains,
 *       department-level metadata, and a stable slug.
 *
 *   site/src/content/skills/<slug>.md
 *       Body copy of each SKILL.md (frontmatter stripped). Astro renders
 *       these as pages via the content collection in src/content/config.ts.
 *
 * This script runs automatically via npm predev / prebuild hooks. You
 * should never need to invoke it by hand unless you're debugging the
 * parser. All outputs are gitignored — SKILL.md in departments/ is the
 * single source of truth.
 */

import { readFile, writeFile, readdir, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

// Paths resolved relative to site/ so the script is invariant to cwd.
const SITE_ROOT = resolve(fileURLToPath(import.meta.url), "../../");
const REPO_ROOT = resolve(SITE_ROOT, "..");
const DEPT_ROOT = join(REPO_ROOT, "departments");
const DATA_OUT = join(SITE_ROOT, "src/data/skills.json");
const CONTENT_OUT = join(SITE_ROOT, "src/content/skills");

// ----------------------------------------------------------------------
// Types (mirrored in site/src/utils/skills.ts for consumers)
// ----------------------------------------------------------------------

type SafetyLevel = "safe" | "writes-local" | "writes-shared" | "destructive";

interface SkillFrontmatter {
  name?: string;
  description?: string;
  safety?: SafetyLevel;
  "supported-stacks"?: string[];
  produces?: string;
  consumes?: string[];
  chains?: string[];
  // forward-compatible bucket for future fields
  [key: string]: unknown;
}

interface SkillEntry {
  slug: string;            // kebab-case unique id; matches frontmatter.name
  name: string;            // display name (same as slug for now)
  department: string;      // kebab-case department slug
  description: string;
  safety: SafetyLevel;
  supportedStacks: string[];
  produces: string | null;
  consumes: string[];
  chains: string[];
  isOrchestrator: boolean; // true when `chains` is non-empty
  sourcePath: string;      // repo-relative path to SKILL.md for GitHub links
  firstParagraph: string;  // first body paragraph after frontmatter, plain text
  bodyWordCount: number;
}

interface DepartmentEntry {
  slug: string;
  skillCount: number;
  orchestratorCount: number;
  orchestrators: string[];  // slugs of chains-bearing skills
}

interface Manifest {
  version: 1;
  generatedAt: string;
  skills: SkillEntry[];
  departments: DepartmentEntry[];
  totals: {
    skills: number;
    orchestrators: number;
    departments: number;
    bySafety: Record<SafetyLevel, number>;
  };
}

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

async function listDepartments(): Promise<string[]> {
  const entries = await readdir(DEPT_ROOT, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort();
}

async function listSkillFolders(department: string): Promise<string[]> {
  const skillsDir = join(DEPT_ROOT, department, "skills");
  if (!existsSync(skillsDir)) return [];
  const entries = await readdir(skillsDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort();
}

function firstParagraphOf(body: string): string {
  // First non-empty, non-heading paragraph. Strips markdown artefacts just
  // enough to be usable as a meta description.
  const lines = body.split("\n");
  let started = false;
  const buf: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) continue; // skip headings
    if (trimmed === "") {
      if (started) break;
      continue;
    }
    started = true;
    buf.push(trimmed);
  }
  // Strip minimal markdown (bold, inline code) for a clean summary.
  return buf
    .join(" ")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .slice(0, 280);
}

function normaliseStacks(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((s) => String(s).trim()).filter(Boolean);
  return [String(raw).trim()].filter(Boolean);
}

function normaliseSafety(raw: unknown): SafetyLevel {
  const v = String(raw ?? "safe").toLowerCase();
  if (
    v === "safe" ||
    v === "writes-local" ||
    v === "writes-shared" ||
    v === "destructive"
  ) {
    return v;
  }
  // Unknown safety level is treated as destructive so it prompts loudly.
  return "destructive";
}

async function readSkill(
  department: string,
  skillFolder: string,
): Promise<SkillEntry | null> {
  const skillPath = join(DEPT_ROOT, department, "skills", skillFolder, "SKILL.md");
  if (!existsSync(skillPath)) return null;
  const raw = await readFile(skillPath, "utf8");
  const parsed = matter(raw);
  const fm = parsed.data as SkillFrontmatter;

  if (!fm.name) {
    console.warn(`  ! ${relative(REPO_ROOT, skillPath)} — missing "name" frontmatter, skipping`);
    return null;
  }
  if (!fm.description) {
    console.warn(`  ! ${relative(REPO_ROOT, skillPath)} — missing "description", skipping`);
    return null;
  }

  const chains = Array.isArray(fm.chains) ? fm.chains.map(String) : [];
  const consumes = Array.isArray(fm.consumes) ? fm.consumes.map(String) : [];
  const supportedStacks = normaliseStacks(fm["supported-stacks"]);

  const entry: SkillEntry = {
    slug: fm.name,
    name: fm.name,
    department,
    description: fm.description,
    safety: normaliseSafety(fm.safety),
    supportedStacks,
    produces: fm.produces ? String(fm.produces) : null,
    consumes,
    chains,
    isOrchestrator: chains.length > 0,
    sourcePath: relative(REPO_ROOT, skillPath).split(sep).join("/"),
    firstParagraph: firstParagraphOf(parsed.content),
    bodyWordCount: parsed.content.split(/\s+/).filter(Boolean).length,
  };

  // Write the body-only mirror for Astro's content collection.
  const mirrorPath = join(CONTENT_OUT, `${entry.slug}.md`);
  const mirrorBody = buildContentMirror(entry, parsed.content);
  await writeFile(mirrorPath, mirrorBody, "utf8");

  return entry;
}

/**
 * Wrap the body with a tiny frontmatter so Astro's content collection can
 * read it. The content collection config (src/content/config.ts) declares
 * the schema.
 */
function buildContentMirror(entry: SkillEntry, body: string): string {
  const frontmatter = [
    "---",
    `slug: ${JSON.stringify(entry.slug)}`,
    `department: ${JSON.stringify(entry.department)}`,
    `description: ${JSON.stringify(entry.description)}`,
    `safety: ${JSON.stringify(entry.safety)}`,
    `sourcePath: ${JSON.stringify(entry.sourcePath)}`,
    "---",
    "",
  ].join("\n");
  return `${frontmatter}${body.trimStart()}`;
}

// ----------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`[manifest] regenerating from ${relative(process.cwd(), DEPT_ROOT) || "."}`);

  // Fresh output dirs — we fully regenerate so stale skills are removed.
  await rm(CONTENT_OUT, { recursive: true, force: true });
  await mkdir(CONTENT_OUT, { recursive: true });
  await mkdir(join(SITE_ROOT, "src/data"), { recursive: true });

  const departments = await listDepartments();
  const skills: SkillEntry[] = [];

  for (const dept of departments) {
    const folders = await listSkillFolders(dept);
    for (const folder of folders) {
      const entry = await readSkill(dept, folder);
      if (entry) skills.push(entry);
    }
  }

  // Sort for stable diffs.
  skills.sort((a, b) => {
    if (a.department !== b.department) return a.department.localeCompare(b.department);
    // Orchestrators sink to the bottom of each department (they reference the
    // task skills above).
    if (a.isOrchestrator !== b.isOrchestrator) return a.isOrchestrator ? 1 : -1;
    return a.slug.localeCompare(b.slug);
  });

  // Build department summary.
  const departmentMap = new Map<string, DepartmentEntry>();
  for (const s of skills) {
    const entry = departmentMap.get(s.department) ?? {
      slug: s.department,
      skillCount: 0,
      orchestratorCount: 0,
      orchestrators: [],
    };
    entry.skillCount += 1;
    if (s.isOrchestrator) {
      entry.orchestratorCount += 1;
      entry.orchestrators.push(s.slug);
    }
    departmentMap.set(s.department, entry);
  }
  const departmentList = Array.from(departmentMap.values()).sort((a, b) =>
    a.slug.localeCompare(b.slug),
  );

  // Totals
  const bySafety: Record<SafetyLevel, number> = {
    safe: 0,
    "writes-local": 0,
    "writes-shared": 0,
    destructive: 0,
  };
  for (const s of skills) bySafety[s.safety] += 1;

  const manifest: Manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    skills,
    departments: departmentList,
    totals: {
      skills: skills.length,
      orchestrators: skills.filter((s) => s.isOrchestrator).length,
      departments: departmentList.length,
      bySafety,
    },
  };

  await writeFile(DATA_OUT, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  console.log(
    `[manifest] wrote ${skills.length} skills across ${departmentList.length} departments`,
  );
  console.log(
    `[manifest] safety: ${bySafety.safe} safe · ${bySafety["writes-local"]} writes-local · ${bySafety["writes-shared"]} writes-shared · ${bySafety.destructive} destructive`,
  );
  console.log(`[manifest] manifest: ${relative(process.cwd(), DATA_OUT)}`);
  console.log(`[manifest] content mirror: ${relative(process.cwd(), CONTENT_OUT)}/`);
}

main().catch((err) => {
  console.error("[manifest] FAILED:", err);
  process.exit(1);
});
