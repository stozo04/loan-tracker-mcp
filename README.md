# Loan Tracker (MCP)

Lightweight loan tracking with a Next.js dashboard, Supabase Edge Function, and a small MCP (Model Context Protocol) helper layer for AI-driven interactions.

This repository contains:

- A Next.js dashboard in `dashboard/` (frontend UI).
- Supabase Edge Function(s) in `supabase/functions/loan-manager` (loan + payment API).
- A small MCP / helper client in `src/` that calls the Edge Function and derives dashboard data.
- Quick test scripts in the repo root (e.g., `test-*.js`).

> Contributing & Agents: If you’re a coding agent or a new teammate, start with `AGENTS.md` for project conventions, security notes, test/run commands, and deployment steps.

## Goals

- Track loans and payments for multiple people.
- Provide a beautiful dashboard UI for viewing loans, payments, and trends.
- Offer a single Edge Function (`loan-manager`) to create loans, add payments, list loans, and delete loans.
- Support simple AI-driven flows via the MCP client.

## Tech stack

- Frontend: Next.js (app router), TypeScript, Tailwind CSS
- Backend: Supabase (Postgres + Edge Functions on Deno)
- Client / helpers: Node + TypeScript (root `src/`)
- Dev tooling: tsx, nodemon, TypeScript

## Project layout (short)

- `dashboard/` — Next.js app (frontend). Use `dashboard/package.json` scripts to run.
- `supabase/functions/loan-manager/` — Deno Edge Function source for loan management.
- `src/` — MCP helpers + small client (`index.ts`, `database.ts`).
- `test-*.js` — small test scripts to exercise the function(s).
- `package.json` — root scripts to run the MCP helper locally.

## Quick start (development)

1. Clone the repo and install root deps:

```bash
git clone https://github.com/stozo04/loan-tracker-mcp.git
cd loan-tracker-mcp
npm install
```

2. Install dashboard dependencies and run the frontend:

```bash
cd dashboard
npm install
npm run dev
```

The dashboard runs on http://localhost:3000 by default.

3. Run the local MCP helper / dev server (root):

```bash
# from repo root
npm run dev
```

That starts the TypeScript MCP helper (see `src/index.ts`) which calls the deployed Edge Function.

4. Use tests to exercise the API locally (these assume you have a deployed Edge Function or valid SUPABASE env):

```bash
node test-edge-function.js
node test-create-loan.js
node test-payment.js
node test-full-flow.js
```

## Environment variables

Create a `.env` file in the project root and `dashboard/.env.local` for the Next.js app.

Root `.env` (used by the MCP helpers and tests):

```
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_ANON_KEY=<your-anon-key-or-service-key>
```

Dashboard `dashboard/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

Notes:
- The Edge Function expects callers to forward an Authorization Bearer token so RLS policies (if enabled) work. The repo uses the anon key for simple setups.
- For production, prefer a service_role or proper auth tokens where appropriate.

## Database (recommended schema)

This project expects two tables: `loan_tracker_loans` and `loan_tracker_payments`.

Example SQL (run in Supabase SQL editor):

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

Optional: an RPC used by the Edge Function called `decrement_loan_balance` (the function falls back to a read+update if the RPC is missing):

```sql
-- Example RPC (Postgres plpgsql):
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

Base URL: POST https://<your-project>.supabase.co/functions/v1/loan-manager

Request body actions (JSON):

- Create loan:
  { "action": "create_loan", "name": "string", "original_amount": number, "loan_date": "YYYY-MM-DD", "term_months": number, "loan_type": "string" }

- Add payment:
  { "action": "add_payment", "loan_id": "uuid" | "loan_name": "string", "amount": number, "paid_by": "Steven|Katerina", "payment_date": "YYYY-MM-DD" }

- Get loans:
  { "action": "get_loans" }

- Delete loan:
  { "action": "delete_loan", "loan_id": "uuid" | "loan_name": "string" }

Response shape:

- Success: { success: true, data: ... }
- Error:   { success: false, error: "message" }

Example (add a payment):

```bash
curl -X POST https://<your-project>.supabase.co/functions/v1/loan-manager \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d '{"action":"add_payment","loan_name":"New Couch","amount":200,"paid_by":"Steven"}'
```

## Scripts (root)

From the repo root (see `package.json`):

- npm run dev — runs the MCP helper locally via nodemon + tsx
- npm run start — run `tsx src/index.ts`
- npm run build — compile TypeScript (tsc)

Dashboard scripts live in `dashboard/package.json` (use `npm run dev`, `npm run build`, etc.).

## Deploy

- Dashboard: Deploy the `dashboard/` folder to Vercel (set the project root to `dashboard` in the Vercel project settings). Add the `NEXT_PUBLIC_SUPABASE_*` env vars in the Vercel dashboard.

- Edge Function: Use the Supabase CLI to deploy the function in `supabase/functions/loan-manager`:

```bash
# login & link
npx supabase login
npx supabase link --project-ref <your-project-ref>

# deploy the loan-manager function
npx supabase functions deploy loan-manager
```

## Tests / smoke checks

The repo contains small smoke-test scripts at the project root (e.g., `test-edge-function.js`, `test-create-loan.js`, `test-payment.js`, `test-full-flow.js`). They call the deployed Edge Function and expect a functioning Supabase backend.

Run them with:

```bash
node test-edge-function.js
```

Adjust env vars or the test files if you use different endpoints or keys.

## Notes & next steps

- The MCP helper in `src/index.ts` contains helpful derivation code for the dashboard (progress %, projected payoff, portfolio summary).
- The Edge Function is implemented in Deno at `supabase/functions/loan-manager/index.ts`.
- Consider adding CI checks to run the smoke tests against a staging Supabase project.

## AI-only chat (POC): interact with the app via OpenAI

This repository supports a proof-of-concept mode where all user interactions are done through an AI chat interface (OpenAI or similar). In this POC the UI is intentionally passive: users talk to the AI, and the AI issues API calls (via the MCP helper or directly to the Edge Function) to create loans, add payments, list loans, and so on.

Why this exists
- Demonstrates an "AI-first" interaction model where the app surface is controlled by an assistant.
- Useful for experiments, accessibility, or voice-driven controls.

Behavior and UX (POC)
- The dashboard can be left open for visualization, but all state changes should originate from the chat assistant.
- The assistant sends structured commands to the Edge Function (`loan-manager`) using the same action objects documented above (create_loan, add_payment, get_loans, delete_loan).
- Responses from the Edge Function are returned to the chat and can be rendered or summarized by the assistant.

How to enable (local POC)
1. Provide your OpenAI key (or other provider) to the MCP helper or a small server-side bridge. Never put this key in client-side code.

Root `.env` additions (example):

```
OPENAI_API_KEY=sk-...
AI_ONLY_MODE=true    # optional: a flag your local MCP helper can check
```

2. Implement or enable a small bridge in `src/` (or your own server) that:
  - Accepts chat messages from you (CLI, local UI, or an external assistant session).
  - Sends the message to OpenAI (or the model of your choice) and receives the assistant reply.
  - Parses structured commands from the assistant and calls the Edge Function with the appropriate action payloads.

Notes:
- This repo includes `src/index.ts` which already contains helpers to call the Edge Function; you can adapt it to forward chat-derived commands.
- If you want a fully managed MCP flow, you can replace the OpenAI calls with an MCP-enabled model or adapter.

Security & safety
- Never expose `OPENAI_API_KEY` or `SUPABASE_ANON_KEY` in the browser.
- Use server-side validation on the Edge Function where appropriate (validate amounts, dates, and who may modify loans).
- Consider adding an allow-list of assistant commands or requiring a secondary approval step before destructive actions (e.g., delete_loan).

Example assistant prompts (POC)
- "Create a loan named 'IKEA Couch' for $1200 with 12 months starting 2025-08-01"
- "Record a $150 payment toward 'IKEA Couch' from Katerina on 2025-08-10"
- "Show me all loans and how much is left to pay"

Small contract for the POC bridge
- Input: plain chat text (string) or a structured assistant object with intent.
- Output: Edge Function action objects (JSON) and assistant-friendly summaries.
- Error modes: malformed commands, invalid amounts, or unknown loan names should be converted into assistant replies explaining the problem.

Next steps for production
- Add authentication and a server-side chat broker to sign/verify commands.
- Create an approvals flow for destructive actions.
- Add audit logging for assistant-initiated changes.

## Contributing

Feel free to open issues or PRs. Keep changes small and provide tests where appropriate.

## License

MIT

---

Made by Steven Gates (stozo04)
