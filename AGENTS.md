# Contributor Guidelines

This repository is a small multi-app project (not a Turborepo). It has:
- `dashboard/` (Next.js app)
- `supabase/functions/loan-manager/` (Deno Edge Function)
- `src/` (Node/TypeScript helpers and derived metrics)

## Development Setup
1. Install dependencies:
   - Root: `npm i`
   - Dashboard: `cd dashboard && npm i`
2. Start development:
   - Root helpers: `npm run dev` (tsx + nodemon)
   - Dashboard: `cd dashboard && npm run dev` (Next.js dev server)
3. Optional: Supabase CLI for deploying the Edge Function:
   - `npx supabase login`
   - `npx supabase link --project-ref <your-project-ref>`

Node 18+ recommended (20+ ideal). See README for environment variables.

## Common Scripts
The root `package.json` defines the main scripts and should be run from the repository root unless noted:
- `npm run build` – Compile TypeScript (`tsc`) to `dist/`.
- `npm run dev` – Run the helper (`tsx src/index.ts`) with nodemon.
- `npm run start` – Run the helper once via `tsx`.

Dashboard scripts (run inside `dashboard/`):
- `npm run dev` – Start Next.js dev server (Turbopack).
- `npm run build` – Build the app.
- `npm run start` – Start the built app.
- `npm run lint` – Run ESLint.

Supabase function (from repo root):
- `npx supabase functions deploy loan-manager` – Deploy edge function (after `login` and `link`).

## Code Style
- TypeScript with ES modules across the repo; Edge Function uses Deno TS.
- Type-checking: root is `strict: true` (see `tsconfig.json`). Prefer explicit types and descriptive names.
- Linting: dashboard uses ESLint (`dashboard/eslint.config.mjs`). Root has no linter; follow nearby style.
- Formatting: follow existing code style (two-space indentation, consistent quotes, trailing commas where present). No repo-wide Prettier/Biome config.
- Exports: export types and values explicitly where helpful (`export type { Foo }`, `export { bar }`).
- Imports: in dashboard prefer `@/` aliased imports where configured.

## Testing
- Smoke scripts (require functioning Supabase + deployed function):
  - From repo root: `node test-edge-function.js`, `node test-create-loan.js`, `node test-payment.js`, `node test-full-flow.js`.
  - These use `SUPABASE_URL` and `SUPABASE_ANON_KEY` from `.env`.
- Manual API checks via curl/postman: POST to `/functions/v1/loan-manager` with `Authorization: Bearer <JWT>`.
- UI manual testing: run `cd dashboard && npm run dev` and browse `http://localhost:3000`.

When adding automated tests later, focus on behavior and public APIs rather than implementation details. Prefer a11y-first queries for UI tests. Avoid testing Tailwind class names or specific HTML tags; test outcomes.

## Public API
The helper’s public API is defined in `src/index.ts`.

- Keep exported functions stable (`createLoan`, `addPayment`, `getLoans`, `deleteLoan`) and documented inline when behavior changes.
- Ensure exported types mirror the Edge Function responses and stay in sync when the function contract evolves.

## Commit Messages
Use short, imperative descriptions starting with a capital letter, e.g. `Fix edge function validation` or `Add projected payoff calculation`. Conventional Commits are welcome (`feat:`, `fix:`, `docs:`) but not required.

## Before Sending a Pull Request
Run the following and ensure they succeed:

```bash
# Root (type-check/build)
npm run build

# Dashboard (lint + build)
cd dashboard && npm run lint && npm run build

# Optional: quick smoke checks (requires env + deployed function)
cd .. && node test-edge-function.js
```

If smoke scripts fail due to auth or missing env, verify `.env` and `dashboard/.env.local` are set and that the function is deployed.

## Fixing Bugs
Follow a lightweight TDD loop where possible:
1. Red – Reproduce with a focused test or smoke case.
2. Green – Implement the minimal fix.
3. Refactor – Clean up while keeping behavior and types consistent across layers (function, helpers, UI).

## Definition of Done

- Root compiles: `npm run build` passes with no type errors.
- Dashboard is clean: `npm run lint` and `npm run build` pass in `dashboard/`.
- Smoke scripts (if applicable) succeed against your environment.
- Docs updated: README/AGENTS reflect contract or behavior changes.

## Security Considerations (Essentials)
- Do not commit secrets; keep `.env` and `dashboard/.env.local` local.
- Always send `Authorization: Bearer <JWT>` when calling the Edge Function so RLS can apply. Dev can use the anon key; production should rely on authenticated user tokens or server-side contexts.
- Consider restricting CORS origins in production.

