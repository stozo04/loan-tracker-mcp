// src/index.ts — Web app caller + summaries for the loan tracker
//
// What this file does:
// 1) Calls your Supabase Edge Function "loan-manager" with Authorization: Bearer <JWT>.
// 2) Provides typed helpers: createLoan, addPayment, getLoans, deleteLoan.
// 3) Computes rich summaries for UI dashboards (portfolio totals, per-loan derived fields,
//    grouping by loan_type, progress %, projected payoff date, etc.).
//
// REQUIRED ENV (e.g., .env.local in Next.js):
//   NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
//   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJI...   // anon (public) key
//
// NOTE: This file does NOT use a shared supabase client. It uses plain fetch per call.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const FUNCTION_NAME = "loan-manager";

// ───────────────────────────────────────────────────────────────────────────────
// Types that match your Edge Function responses
// ───────────────────────────────────────────────────────────────────────────────

export type PaidBy = "Steven" | "Katerina";

export interface Payment {
  id?: string;
  loan_id: string;
  amount: number;
  paid_by: PaidBy;
  payment_date: string; // YYYY-MM-DD
  created_at?: string;  // ISO
}

export interface Loan {
  id: string;
  name: string;
  original_amount: number;
  current_balance: number;
  loan_type: string;
  term_months: number;
  loan_date: string;     // YYYY-MM-DD
  created_at?: string;   // ISO
  // When fetched via get_loans, the function attaches:
  payments?: Payment[];
  total_paid?: number;
  last_payment?: string | null;
}

export interface Ok<T> {
  success: true;
  data: T;
}
export interface Err {
  success: false;
  error: string;
}

// Edge Function result unions
export type CreateLoanOk = Ok<Loan>;
export type AddPaymentOk = Ok<{ loan_id: string; amount: number; paid_by: PaidBy; payment_date: string }>;
export type GetLoansOk   = Ok<Loan[]>;
export type DeleteLoanOk = Ok<{ loan_id: string }>;

// ───────────────────────────────────────────────────────────────────────────────
// Low-level caller: always sends Authorization header (fixes the 401)
// ───────────────────────────────────────────────────────────────────────────────

async function getBearer(): Promise<string> {
  // If/when you add Supabase Auth on the client, swap to prefer the user’s access_token.
  // For now, anon key is a valid JWT for verify_jwt=true functions.
  return SUPABASE_ANON_KEY;
}

async function callEdge<T>(body: unknown): Promise<T> {
  const token = await getBearer();

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${FUNCTION_NAME}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`, // 👈 caller identity for RLS
      "x-client-info": "loan-tracker-client",
    },
    body: JSON.stringify(body),
  });

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    // ignore
  }

  if (!res.ok) {
    const msg = (json && (json.error || json.message)) || `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }

  // Edge function returns { success, data } or { success, error }
  if (!json?.success) {
    throw new Error(json?.error || "Unknown error from edge function");
  }

  return json as T;
}

// ───────────────────────────────────────────────────────────────────────────────
// Public API: thin wrappers that match your Edge Function actions
// ───────────────────────────────────────────────────────────────────────────────

export function createLoan(params: {
  name: string;
  original_amount: number;
  loan_type?: string;
  term_months: number;     // REQUIRED
  loan_date: string;       // REQUIRED (YYYY-MM-DD)
  lender?: string;
}) {
  return callEdge<CreateLoanOk>({ action: "create_loan", ...params });
}

export function addPayment(params: {
  loan_id?: string;      // preferred
  loan_name?: string;    // optional fallback
  amount: number;
  paid_by?: PaidBy;      // default handled server-side ("Steven")
  payment_date?: string; // YYYY-MM-DD
}) {
  return callEdge<AddPaymentOk>({ action: "add_payment", ...params });
}

export function getLoans() {
  return callEdge<GetLoansOk>({ action: "get_loans" });
}

export function deleteLoan(params: { loan_id?: string; loan_name?: string }) {
  return callEdge<DeleteLoanOk>({ action: "delete_loan", ...params });
}

// ───────────────────────────────────────────────────────────────────────────────
// Formatting helpers
// ───────────────────────────────────────────────────────────────────────────────

export function formatCurrency(n: number, currency: string = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
}

export function formatPercent(n: number, digits = 1) {
  return `${n.toFixed(digits)}%`;
}

export function toISODate(d: Date) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// ───────────────────────────────────────────────────────────────────────────────
// Derivation helpers for dashboard views
// ───────────────────────────────────────────────────────────────────────────────

export interface LoanComputed extends Loan {
  payments: Payment[];           // ensure present
  total_paid: number;            // ensure present
  progress_percentage: number;   // ensure present (0..100)
  is_paid_off: boolean;
  remaining_balance: number;     // == current_balance
  first_payment_date?: string;
  last_payment_date?: string | null;
  payments_count: number;
  average_payment?: number;
  average_days_between_payments?: number;
  projected_payoff_date?: string; // best-effort projection
}

export interface PortfolioSummary {
  loan_count: number;
  paid_off_count: number;
  open_count: number;
  total_original: number;
  total_paid: number;
  total_remaining: number;
  portfolio_progress_pct: number; // weighted by original amounts
  by_type: Record<string, {
    loan_count: number;
    total_original: number;
    total_paid: number;
    total_remaining: number;
    progress_pct: number;
  }>;
}

function parseDateSafe(s?: string): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Best-effort projection:
 * - If there are ≥2 payments, compute average days between payments and average payment amount.
 * - Project how many intervals remain to pay off the remaining balance using average payment.
 * - projected_payoff_date = last_payment_date + intervals_remaining * avg_interval_days
 * Falls back to undefined if insufficient data.
 */
function computeProjection(payments: Payment[], remaining: number): {
  average_payment?: number;
  average_days_between_payments?: number;
  projected_payoff_date?: string;
} {
  if (!payments || payments.length === 0 || remaining <= 0) {
    return { average_payment: undefined, average_days_between_payments: undefined, projected_payoff_date: undefined };
  }

  // Sort by payment_date asc
  const sorted = [...payments].sort((a, b) => a.payment_date.localeCompare(b.payment_date));
  const amounts = sorted.map(p => p.amount);
  const totalPaid = amounts.reduce((s, a) => s + a, 0);
  const average_payment = totalPaid / amounts.length;

  let average_days_between_payments: number | undefined;
  if (sorted.length >= 2) {
    const dayDiffs: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = parseDateSafe(sorted[i - 1].payment_date)!;
      const curr = parseDateSafe(sorted[i].payment_date)!;
      const diffDays = Math.max(1, Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)));
      dayDiffs.push(diffDays);
    }
    const avg = dayDiffs.reduce((s, d) => s + d, 0) / dayDiffs.length;
    average_days_between_payments = Math.round(avg);
  }

  let projected_payoff_date: string | undefined;
  const lastDate = parseDateSafe(sorted[sorted.length - 1].payment_date);
  if (average_payment && average_payment > 0 && lastDate && average_days_between_payments) {
    const intervalsRemaining = Math.ceil(remaining / average_payment);
    const projected = new Date(lastDate);
    projected.setDate(projected.getDate() + intervalsRemaining * average_days_between_payments);
    projected_payoff_date = toISODate(projected);
  }

  return { average_payment, average_days_between_payments, projected_payoff_date };
}

/** Compute rich derived fields for one loan row */
export function deriveLoan(loan: Loan): LoanComputed {
  const payments: Payment[] = loan.payments ?? [];
  const total_paid = typeof loan.total_paid === "number"
    ? loan.total_paid
    : payments.reduce((s, p) => s + p.amount, 0);

  const remaining_balance = loan.current_balance;
  const progress_percentage = Math.min(100, Math.max(0, (total_paid / Math.max(1, loan.original_amount)) * 100));
  const is_paid_off = remaining_balance <= 0.000001;

  const sorted = [...payments].sort((a, b) => a.payment_date.localeCompare(b.payment_date));
  const first_payment_date = sorted[0]?.payment_date;
  const last_payment_date = (loan as any).last_payment ?? sorted[sorted.length - 1]?.payment_date;
  const payments_count = payments.length;

  const { average_payment, average_days_between_payments, projected_payoff_date } =
    computeProjection(payments, remaining_balance);

  return {
    ...loan,
    payments,
    total_paid,
    progress_percentage,
    is_paid_off,
    remaining_balance,
    first_payment_date,
    last_payment_date,
    payments_count,
    average_payment,
    average_days_between_payments,
    projected_payoff_date,
  };
}

/** Build a portfolio summary and group by loan_type */
export function summarizePortfolio(loans: LoanComputed[]): PortfolioSummary {
  const acc: PortfolioSummary = {
    loan_count: loans.length,
    paid_off_count: loans.filter(l => l.is_paid_off).length,
    open_count: loans.filter(l => !l.is_paid_off).length,
    total_original: 0,
    total_paid: 0,
    total_remaining: 0,
    portfolio_progress_pct: 0,
    by_type: {},
  };

  let weightedPaid = 0;
  let weightedOriginal = 0;

  for (const l of loans) {
    acc.total_original += l.original_amount;
    acc.total_paid += l.total_paid;
    acc.total_remaining += Math.max(0, l.remaining_balance);

    weightedPaid += l.total_paid;
    weightedOriginal += l.original_amount;

    const key = l.loan_type ?? "unknown";
    const group = (acc.by_type[key] ??= {
      loan_count: 0,
      total_original: 0,
      total_paid: 0,
      total_remaining: 0,
      progress_pct: 0,
    });
    group.loan_count += 1;
    group.total_original += l.original_amount;
    group.total_paid += l.total_paid;
    group.total_remaining += Math.max(0, l.remaining_balance);
  }

  acc.portfolio_progress_pct = weightedOriginal > 0 ? (weightedPaid / weightedOriginal) * 100 : 0;

  // compute group progress
  for (const key of Object.keys(acc.by_type)) {
    const g = acc.by_type[key];
    g.progress_pct = g.total_original > 0 ? (g.total_paid / g.total_original) * 100 : 0;
  }

  return acc;
}

// Helpful transformer for tables
export function toDisplayRows(loans: LoanComputed[]) {
  return loans
    .slice()
    .sort((a, b) => (a.is_paid_off === b.is_paid_off)
      ? a.name.localeCompare(b.name)
      : (a.is_paid_off ? 1 : -1))
    .map(l => ({
      id: l.id,
      name: l.name,
      type: l.loan_type,
      original: formatCurrency(l.original_amount),
      paid: formatCurrency(l.total_paid),
      remaining: formatCurrency(Math.max(0, l.remaining_balance)),
      progress: formatPercent(l.progress_percentage),
      last_payment: l.last_payment_date ?? "—",
      avg_payment: l.average_payment ? formatCurrency(l.average_payment) : "—",
      projected_payoff: l.projected_payoff_date ?? "—",
    }));
}

// ───────────────────────────────────────────────────────────────────────────────
// One-call dashboard data: fetch loans, derive, summarize
// ───────────────────────────────────────────────────────────────────────────────

export async function getDashboardData() {
  const { data: rawLoans } = await getLoans();
  const loans = rawLoans.map(deriveLoan);
  const portfolio = summarizePortfolio(loans);
  const rows = toDisplayRows(loans);

  return {
    loans,        // rich per-loan objects with derived fields
    portfolio,    // overall summary + by_type
    rows,         // ready for a simple table view
  };
}

// ───────────────────────────────────────────────────────────────────────────────
// (Optional) Tiny demo call:
// (Uncomment to quickly smoke test in a Node script context)
// ───────────────────────────────────────────────────────────────────────────────
// (async () => {
//   const { data } = await getLoans();
//   const loans = data.map(deriveLoan);
//   console.log(JSON.stringify(summarizePortfolio(loans), null, 2));
// })();
