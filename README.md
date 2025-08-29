# Loan Tracker (MCP)

Lightweight loan tracking with a Next.js dashboard, a Supabase Edge Function, and a small helper layer for AI-driven interactions.

This repository contains:

- `dashboard/` – Next.js app (frontend UI)
- `supabase/functions/loan-manager/` – Deno Edge Function (loan + payment API)
- `src/` – Node/TypeScript helpers and derived metrics
- `test-*.js` – quick smoke scripts in the repo root

> Contributing & Agents: If you're a coding agent or a new teammate, start with `AGENTS.md` for conventions, security notes, run/build commands, and deployment steps.

## Goals

- Track loans and payments for multiple people.
- Provide a clean dashboard UI to visualize progress and trends.
- Offer a single Edge Function (`loan-manager`) to create loans, add payments, list loans, and delete loans.
- Support AI-driven flows via a simple helper API.

## Tech Stack

- Frontend: Next.js (App Router), TypeScript, Tailwind CSS
- Backend: Supabase (Postgres + Edge Functions on Deno)
- Helpers: Node + TypeScript (root `src/`)
- Tooling: tsx, nodemon, TypeScript

## Project Layout

- `dashboard/` – Next.js app (frontend). Use `dashboard/package.json` scripts to run.
- `supabase/functions/loan-manager/` – Deno Edge Function source for loan management.
- `src/` – Helpers + small client (`index.ts`, `database.ts`).
- `test-*.js` – Small test scripts to exercise the function(s).
- `package.json` – Root scripts to run the helper locally.

## Quick Start (Development)

1) Install dependencies

```bash
# Root
npm i

# Dashboard
cd dashboard && npm i
```

2) Start development

```bash
# Root helpers (from repo root)
npm run dev

# Dashboard (from dashboard/)
npm run dev
```

The dashboard runs on http://localhost:3000.

3) Optional: Supabase CLI (to deploy the Edge Function)

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
```

## Environment Variables

Create a `.env` in the project root and `dashboard/.env.local` for the Next.js app.

Root `.env` (used by helpers and smoke scripts):

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key-or-service-key>
```

Dashboard `dashboard/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

Notes
- The Edge Function expects callers to send `Authorization: Bearer <JWT>` so RLS can apply. For simple setups, the anon key works.
- For production, prefer authenticated user tokens or a server-side context.

## Using Shared Helpers from the Dashboard

The dashboard imports types and helpers from the root `src/index.ts` to keep derivation logic canonical. Use relative paths based on the importing file location.

Examples
- From a component under `dashboard/src/components`:
  `import { deriveLoan, type Loan as LoanRow } from '../../../src/index'`
- From a hook under `dashboard/src/lib/hooks`:
  `import { deriveLoan, type Loan as LoanRow, type LoanComputed } from '../../../../src/index'`

Please do not duplicate derivation logic in the dashboard. Use `deriveLoan`, `summarizePortfolio`, and related exports from the shared module.

Build note: Next.js may warn about multiple lockfiles and infer the workspace root. You can ignore this, remove `dashboard/package-lock.json`, or set `turbopack.root` in `dashboard/next.config.ts` to silence the warning.

## Database (Recommended Schema)

This project expects two tables: `loan_tracker_loans` and `loan_tracker_payments`.

Example SQL

```sql
create extension if not exists pgcrypto;

CREATE TABLE loan_tracker_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  original_amount numeric(12,2) NOT NULL,
  current_balance numeric(12,2) NOT NULL,
  loan_type text NOT NULL DEFAULT 'general',
  term_months integer NOT NULL,
  loan_date date NOT NULL,
  created_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE loan_tracker_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid REFERENCES loan_tracker_loans(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  paid_by text NOT NULL,
  payment_date date NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);
```

Optional RPC used by the Edge Function (falls back to read+update if missing):

```sql
create or replace function decrement_loan_balance(p_loan_id uuid, p_amount numeric) returns void as $$
begin
  update loan_tracker_loans
  set current_balance = greatest(0, current_balance - p_amount)
  where id = p_loan_id;
end;
$$ language plpgsql;
```

Enable Row Level Security if you use RLS and add policies that match your auth model.

## Edge Function API (loan-manager)

Base URL: `POST https://<your-project>.supabase.co/functions/v1/loan-manager`

Request bodies (JSON)
- Create loan: `{ "action": "create_loan", "name": string, "original_amount": number, "loan_date": "YYYY-MM-DD", "term_months": number, "loan_type": string }`
- Add payment: `{ "action": "add_payment", "loan_id": uuid | "loan_name": string, "amount": number, "paid_by": "Steven|Katerina", "payment_date": "YYYY-MM-DD" }`
- Get loans: `{ "action": "get_loans" }`
- Delete loan: `{ "action": "delete_loan", "loan_id": uuid | "loan_name": string }`

Response shape
- Success: `{ success: true, data: ... }`
- Error: `{ success: false, error: "message" }`

Example (add a payment)

```bash
curl -X POST https://<your-project>.supabase.co/functions/v1/loan-manager \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -d '{"action":"add_payment","loan_name":"New Couch","amount":200,"paid_by":"Steven"}'
```

## Scripts

From the repo root (see `package.json`):

- `npm run dev` – runs the helper locally via nodemon + tsx
- `npm run start` – run `tsx src/index.ts`
- `npm run build` – compile TypeScript (tsc)

Dashboard scripts live in `dashboard/package.json`.

## Deploy

- Dashboard: Deploy the `dashboard/` folder to Vercel (project root = `dashboard`). Add `NEXT_PUBLIC_SUPABASE_*` env vars in Vercel.
- Edge Function: Use the Supabase CLI to deploy `supabase/functions/loan-manager`:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase functions deploy loan-manager
```

## Tests / Smoke Checks

These call the deployed Edge Function and expect a functioning Supabase backend:

```bash
node test-edge-function.js
node test-create-loan.js
node test-payment.js
node test-full-flow.js
```

## AI-only Chat (POC)

This repo supports a POC where an AI assistant issues all app actions. The dashboard can stay open for visualization, while the assistant calls the Edge Function with the same action objects described above.

Security
- Never expose `OPENAI_API_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the browser.
- Prefer server-side calls and validation.

## Contributing

Small, focused PRs are welcome. See `AGENTS.md` for workflow and Definition of Done.

## License

MIT

— Made by Steven Gates (stozo04)

