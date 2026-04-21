# skillkit.dev — catalog site

The source code for [skillkit.dev](https://skillkit.dev), the browseable catalog for SDAS skills.

## What this is

A static site generated from the SKILL.md files in `../departments/`. Every skill gets a page. Every department gets an index. Search is client-side (Pagefind) — no backend.

## Architecture

```
../departments/*/skills/*/SKILL.md   ← source of truth
                │
                ▼
scripts/generate-manifest.ts         ← parses frontmatter + body
                │
                ▼
src/data/skills.json                 ← manifest consumed by pages (gitignored)
src/content/skills/<id>.md           ← body copies for rendering (gitignored)
                │
                ▼
Astro build → dist/                  ← static HTML/CSS/JS
                │
                ▼
Azure Static Web Apps                ← served at skillkit.dev
```

The manifest generator and content mirror run automatically via `predev` / `prebuild` npm scripts — you don't invoke them manually.

## Local development

```bash
cd site
npm install
npm run dev
```

Site runs at `http://localhost:4321`. Edits to `../departments/*/skills/*/SKILL.md` require a dev restart to pick up frontmatter changes (Astro HMR handles body edits live via content collections).

## Build

```bash
npm run build
npm run preview
```

Output lands in `dist/` and includes a `_pagefind/` subdirectory with the static search index.

## Deploy

Pushes to `main` trigger `.github/workflows/azure-static-web-apps.yml` which builds and deploys to Azure Static Web Apps. Pull requests get automatic preview URLs.

## Directory layout

```
site/
├── astro.config.mjs
├── package.json
├── tsconfig.json
├── public/                 static assets (favicon, og image)
├── scripts/
│   └── generate-manifest.ts
└── src/
    ├── components/         shared Astro components
    ├── content/            (generated) skill body .md files for Astro content collections
    ├── data/               (generated) skills.json manifest
    ├── layouts/            page layouts
    ├── pages/              routes
    ├── styles/             global CSS tokens
    └── utils/              helpers (skill loading, formatting)
```

## Conventions

- **No backend.** If a feature seems to need one, it probably belongs in a separate service. The site stays purely static.
- **No tracking beyond Plausible/GoatCounter** (Phase B). No cookies, no personal data, no third-party scripts that aren't privacy-friendly.
- **All skill data comes from SKILL.md.** Never hard-code skill descriptions, departments, or safety levels in site code — those change, the manifest re-reads them.

## Status

- **Phase A (this branch):** catalog + search. What you see here.
- **Phase B (pending):** customizer form, one-line install, shareable customization URLs.
- **Phase C (pending):** fork-to-GitHub, team presets.

See the root [README.md](../README.md) for the rest of the kit.
