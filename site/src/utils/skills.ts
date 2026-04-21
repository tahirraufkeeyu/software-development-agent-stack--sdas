/**
 * Typed loader for the generated skills manifest.
 *
 * The manifest is produced by scripts/generate-manifest.ts and written to
 * src/data/skills.json at every dev-start and build. Import this module
 * instead of reading the JSON directly so consumers get typed data and a
 * single place to evolve the shape in Phase B.
 */

import manifestData from "@/data/skills.json";

export type SafetyLevel =
  | "safe"
  | "writes-local"
  | "writes-shared"
  | "destructive";

export interface SkillEntry {
  slug: string;
  name: string;
  department: string;
  description: string;
  safety: SafetyLevel;
  supportedStacks: string[];
  produces: string | null;
  consumes: string[];
  chains: string[];
  isOrchestrator: boolean;
  sourcePath: string;
  firstParagraph: string;
  bodyWordCount: number;
}

export interface DepartmentEntry {
  slug: string;
  skillCount: number;
  orchestratorCount: number;
  orchestrators: string[];
}

export interface Manifest {
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

// Cast through unknown because JSON imports are typed as `any` under
// resolveJsonModule; the generator guarantees the shape.
const manifest = manifestData as unknown as Manifest;

/** Human-friendly labels for department slugs. */
export const departmentLabels: Record<string, string> = {
  developers: "Developers",
  security: "Security",
  devops: "DevOps",
  infrastructure: "Infrastructure",
  qa: "QA",
  sales: "Sales",
  marketing: "Marketing",
  "internal-comms": "Internal comms",
};

/** One-line pitch per department, used on the landing page and department index. */
export const departmentPitches: Record<string, string> = {
  developers:
    "Code review, tests, refactoring, debug, commits, API design, docs, scaffolding.",
  security:
    "Scan, report, remediate. Secrets, dependencies, SAST/DAST, containers, SOC2.",
  devops:
    "Deploy, CI/CD YAML, Terraform, Helm, incidents, cloud cost optimisation.",
  infrastructure:
    "Monitoring, log aggregation, SSL certs, network diagnostics, backups, cluster health.",
  qa: "E2E tests, API tests, performance, accessibility, test data, bug reports.",
  sales:
    "Lead research, competitive analysis, proposals, outreach, RFPs, meeting prep.",
  marketing:
    "Content, social, SEO, email campaigns, competitor monitoring, weekly analytics.",
  "internal-comms":
    "Status updates, postmortems, meeting notes, changelogs, onboarding, announcements.",
};

export function getManifest(): Manifest {
  return manifest;
}

export function getAllSkills(): SkillEntry[] {
  return manifest.skills;
}

export function getDepartments(): DepartmentEntry[] {
  return manifest.departments;
}

export function getSkillBySlug(slug: string): SkillEntry | undefined {
  return manifest.skills.find((s) => s.slug === slug);
}

export function getSkillsByDepartment(departmentSlug: string): SkillEntry[] {
  return manifest.skills.filter((s) => s.department === departmentSlug);
}

export function departmentLabel(slug: string): string {
  return departmentLabels[slug] ?? slug;
}

export function departmentPitch(slug: string): string {
  return departmentPitches[slug] ?? "";
}

export function safetyLabel(safety: SafetyLevel): string {
  switch (safety) {
    case "safe":
      return "Safe · read-only";
    case "writes-local":
      return "Writes locally";
    case "writes-shared":
      return "Writes shared state";
    case "destructive":
      return "Destructive";
  }
}

export function safetyBadgeClass(safety: SafetyLevel): string {
  return `badge badge-${safety}`;
}

/** GitHub URL for the SKILL.md source file. */
export function githubSourceUrl(skill: SkillEntry): string {
  return `https://github.com/tahirraufkeeyu/software-development-agent-stack--sdas/blob/main/${skill.sourcePath}`;
}
