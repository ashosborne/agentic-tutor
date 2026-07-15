# Agentic Tutor

Local web app for generating themed printable worksheet images and tracking each child's progress against the Marble Skill Taxonomy.

## Quick start

```bash
# from repo root
npm install
cp app/.env.example app/.env
npm run seed -w agentic-tutor   # optional; auto-seeds on first API boot
npm run dev
```

- UI: http://127.0.0.1:5173  
- API: http://127.0.0.1:8787  

Demo mode is **on** by default (`DEMO_MODE=true`) — no API keys required.

## Guided tutor

From a child’s page, **Continue with the tutor** runs the parent-guided loop:

- Baseline questionnaire (new children) → lesson proposal → worksheet → scan → “how it went” report → insights
- Design styles from the research brief are tried one at a time and adopted into a per-child tutor profile
- Demo mode supports the full loop with fixtures (no API keys)

## Live agents

Set in `app/.env`:

```
DEMO_MODE=false
OPENAI_API_KEY=...
```

Or toggle Demo mode off in **Settings** (OpenAI key still required).

| Agent | Model |
|---|---|
| Worksheet generator | OpenAI `gpt-image-1` (prompt from `docs/examplePrompt.md` + design brief + design variant) |
| Scan assessor | GPT-4o (vision) |
| Tutor loop | Rules engine (baseline, A/B assignment, scoring) + generators above |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | API + Vite client |
| `npm run seed` / `seed:reset` | Load Maya (5) & Leo (7) + sample worksheets |
| `npm test` | Unit + API tests (Vitest) |
| `npm run test:e2e` | Playwright functional tests |
| `npm run build` / `npm start` | Production client build + API serving static files |

## Data

Child profiles, mastery, worksheets, and assessments live in `app/storage/` (SQLite via Node’s built-in `node:sqlite` + worksheet images/scans). Taxonomy is read from repo `data/`.
