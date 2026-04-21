/**
 * diff.ts — minimal line-by-line diff for the customizer.
 *
 * We deliberately do not pull in the heavyweight `diff` npm package.
 * A customized SKILL.md and its original tend to be 80% identical
 * (section headings, most frontmatter, quality checks). The noisy
 * 20% is what the user wants to see — this implementation gives
 * that at a cost of ~2 KB.
 *
 * Algorithm: longest-common-subsequence on lines, then emit diff
 * operations. O(n*m) time, O(n*m) space; fine for SKILL.md files
 * of a few hundred lines each.
 */

export type DiffOp =
  | { kind: "equal"; text: string; leftLine: number; rightLine: number }
  | { kind: "add"; text: string; rightLine: number }
  | { kind: "del"; text: string; leftLine: number };

export function diffLines(oldText: string, newText: string): DiffOp[] {
  const a = oldText.replace(/\r\n/g, "\n").split("\n");
  const b = newText.replace(/\r\n/g, "\n").split("\n");

  const n = a.length;
  const m = b.length;

  // LCS table
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ kind: "equal", text: a[i], leftLine: i + 1, rightLine: j + 1 });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ kind: "del", text: a[i], leftLine: i + 1 });
      i++;
    } else {
      ops.push({ kind: "add", text: b[j], rightLine: j + 1 });
      j++;
    }
  }
  while (i < n) {
    ops.push({ kind: "del", text: a[i], leftLine: i + 1 });
    i++;
  }
  while (j < m) {
    ops.push({ kind: "add", text: b[j], rightLine: j + 1 });
    j++;
  }

  return ops;
}

export interface DiffSummary {
  added: number;
  removed: number;
  unchanged: number;
}

export function summarise(ops: DiffOp[]): DiffSummary {
  let added = 0;
  let removed = 0;
  let unchanged = 0;
  for (const o of ops) {
    if (o.kind === "add") added++;
    else if (o.kind === "del") removed++;
    else unchanged++;
  }
  return { added, removed, unchanged };
}

/**
 * Render a unified diff to an HTML string (safe-escaped). Used by the
 * customizer done state. Minimal styling — the caller provides CSS
 * for .diff-line / .diff-add / .diff-del / .diff-equal.
 */
export function renderUnifiedHtml(ops: DiffOp[]): string {
  const rows: string[] = [];
  for (const op of ops) {
    const escaped = escapeHtml(op.text);
    if (op.kind === "add") {
      rows.push(
        `<div class="diff-line diff-add"><span class="diff-sign">+</span>${escaped}</div>`,
      );
    } else if (op.kind === "del") {
      rows.push(
        `<div class="diff-line diff-del"><span class="diff-sign">−</span>${escaped}</div>`,
      );
    } else {
      rows.push(
        `<div class="diff-line diff-equal"><span class="diff-sign"> </span>${escaped}</div>`,
      );
    }
  }
  return rows.join("");
}

/**
 * Render diff with context collapsing — unchanged runs of >3 lines
 * get collapsed to 3 visible + a "… N lines unchanged …" marker.
 * Keeps long SKILL.md diffs scannable.
 */
export function renderUnifiedHtmlCollapsed(
  ops: DiffOp[],
  contextLines = 3,
): string {
  const rows: string[] = [];
  let i = 0;
  while (i < ops.length) {
    if (ops[i].kind !== "equal") {
      rows.push(lineHtml(ops[i]));
      i++;
      continue;
    }
    // Scan the run of equal ops.
    let runStart = i;
    while (i < ops.length && ops[i].kind === "equal") i++;
    const runLength = i - runStart;

    const nearStart = runStart === 0;
    const nearEnd = i === ops.length;

    if (runLength <= contextLines * 2) {
      // Short run: show entirely.
      for (let k = runStart; k < i; k++) rows.push(lineHtml(ops[k]));
      continue;
    }

    if (!nearStart) {
      for (let k = runStart; k < runStart + contextLines; k++)
        rows.push(lineHtml(ops[k]));
    }
    const hidden = runLength - (nearStart ? 0 : contextLines) - (nearEnd ? 0 : contextLines);
    if (hidden > 0) {
      rows.push(
        `<div class="diff-line diff-fold">… ${hidden} unchanged line${hidden === 1 ? "" : "s"} …</div>`,
      );
    }
    if (!nearEnd) {
      for (let k = i - contextLines; k < i; k++) rows.push(lineHtml(ops[k]));
    }
  }
  return rows.join("");
}

function lineHtml(op: DiffOp): string {
  const escaped = escapeHtml(op.text);
  if (op.kind === "add") {
    return `<div class="diff-line diff-add"><span class="diff-sign">+</span>${escaped}</div>`;
  }
  if (op.kind === "del") {
    return `<div class="diff-line diff-del"><span class="diff-sign">−</span>${escaped}</div>`;
  }
  return `<div class="diff-line diff-equal"><span class="diff-sign"> </span>${escaped}</div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
