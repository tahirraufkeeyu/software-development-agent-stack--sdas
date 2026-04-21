import { defineCollection, z } from "astro:content";

/**
 * Skills content collection.
 *
 * The actual .md files under src/content/skills/ are generated at build
 * time by scripts/generate-manifest.ts — they are body copies of the
 * SKILL.md files under ../../departments/. Do NOT edit those copies; edit
 * the source SKILL.md in the repo root.
 *
 * The schema here matches the frontmatter the generator writes into each
 * mirror file, NOT the frontmatter of the original SKILL.md. Fields like
 * supported-stacks and chains live in skills.json; this collection only
 * carries what per-skill pages need to render the body.
 */

const skills = defineCollection({
  type: "content",
  // NB: `slug` is a RESERVED field in Astro content collections — it's
  // auto-derived from the filename and must NOT appear in the schema or
  // the frontmatter. Use `entry.slug` (auto) or `entry.id` at read time.
  schema: z.object({
    department: z.string(),
    description: z.string(),
    safety: z.enum(["safe", "writes-local", "writes-shared", "destructive"]),
    sourcePath: z.string(),
  }),
});

export const collections = { skills };
