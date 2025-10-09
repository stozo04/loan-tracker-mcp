// supabase/functions/loan-manager/index.ts
// Edge Function (Deno) to manage loans + payments.
//
// Expected request body (one of):
// { action: "create_loan", name, original_amount, loan_date, term_months, loan_type?, lender? }
// { action: "add_payment", loan_id? , loan_name?, amount, paid_by?, payment_date? }
// { action: "get_loans" }
// { action: "delete_loan", loan_id? , loan_name? }
//
// Response shape:
// { success: true, data: ... } | { success: false, error: "..." }

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const NEXT_PUBLIC_SUPABASE_URL = Deno.env.get("NEXT_PUBLIC_SUPABASE_URL")!;
const NEXT_PUBLIC_SUPABASE_ANON_KEY = Deno.env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Utilities
function ok(data: unknown, status = 200) {
  return new Response(JSON.stringify({ success: true, data }, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

function bad(error: string, status = 400) {
  return new Response(JSON.stringify({ success: false, error }, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

function isISODate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function normalizePaidBy(v?: string): "Steven" | "Katerina" {
  if (!v) return "Steven";
  const p = v.trim().toLowerCase();
  if (p === "i" || p === "me" || p === "myself" || p === "steven") return "Steven";
  if (p === "katerina") return "Katerina";
  return "Steven";
}

async function resolveLoanIdByName(
  supabase: ReturnType<typeof createClient>,
  name: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("loan_tracker_loans")
    .select("id,name")
    .ilike("name", name.trim());

  if (error) throw error;

  if (!data || data.length === 0) return null;

  // Prefer exact case-insensitive match
  const exact = data.find((r) => r.name.toLowerCase() === name.toLowerCase());
  return (exact ?? data[0]).id;
}

serve(async (req) => {
  try {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    // Forward the caller's JWT so RLS works
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    if (req.method !== "POST") {
      return bad("Method not allowed", 405);
    }

    const body = await req.json().catch(() => ({} as any));
    const action = body?.action as
      | "create_loan"
      | "add_payment"
      | "get_loans"
      | "delete_loan";

    if (!action) return bad("Missing 'action'.");

    // CREATE LOAN
    if (action === "create_loan") {
      const {
        name,
        original_amount,
        loan_date,
        term_months,
        loan_type = "general",
        lender,
      } = body as {
        name?: string;
        original_amount?: number;
        loan_date?: string;
        term_months?: number;
        loan_type?: string;
        lender?: string;
      };

      if (
        !name ||
        typeof original_amount !== "number" ||
        !isISODate(loan_date) ||
        typeof term_months !== "number" ||
        term_months <= 0
      ) {
        return bad(
          "create_loan requires name, numeric original_amount, loan_date (YYYY-MM-DD), and positive term_months.",
        );
      }

      const { data, error } = await supabase
        .from("loan_tracker_loans")
        .insert([
          {
            name,
            original_amount,
            current_balance: original_amount,
            loan_type,
            term_months,
            loan_date, // store as date or text column formatted YYYY-MM-DD
          },
        ])
        .select("*")
        .single();

      if (error) throw error;
      return ok(data, 201);
    }

    // ADD PAYMENT
    if (action === "add_payment") {
      const {
        loan_id,
        loan_name,
        amount,
        paid_by = "Steven",
        payment_date,
      } = body as {
        loan_id?: string;
        loan_name?: string;
        amount?: number;
        paid_by?: "Steven" | "Katerina";
        payment_date?: string;
      };

      if (typeof amount !== "number" || amount <= 0) {
        return bad("add_payment requires a positive numeric 'amount'.");
      }

      const id =
        loan_id ??
        (loan_name ? await resolveLoanIdByName(supabase, loan_name) : null);

      if (!id) return bad("add_payment requires loan_id or valid loan_name.");

      const iso = isISODate(payment_date)
        ? payment_date
        : new Date().toISOString().slice(0, 10);

      const paidBy = normalizePaidBy(paid_by as string | undefined);

      // 1) Insert payment
      const { error: pErr } = await supabase.from("loan_tracker_payments").insert([
        {
          loan_id: id,
          amount,
          paid_by: paidBy,
          payment_date: iso,
        },
      ]);
      if (pErr) throw pErr;

      // 2) Decrement current balance (prefer RPC; fallback to select+update)
      const { error: rpcErr } = await supabase.rpc("decrement_loan_balance", {
        p_loan_id: id,
        p_amount: amount,
      });

      if (rpcErr) {
        // Fallback: read current balance, compute, then update
        const { data: loanRow, error: selErr } = await supabase
          .from("loan_tracker_loans")
          .select("current_balance")
          .eq("id", id)
          .single();
        if (selErr) throw selErr;

        const curr = Number(loanRow?.current_balance ?? 0);
        const newBal = Math.max(0, curr - amount);

        const { error: updErr } = await supabase
          .from("loan_tracker_loans")
          .update({ current_balance: newBal })
          .eq("id", id);
        if (updErr) throw updErr;
      }

      return ok({ loan_id: id, amount, paid_by: paidBy, payment_date: iso });
    }

    // GET LOANS (returns loans + payments; UI filters if it asked for a specific loan)
    if (action === "get_loans") {
      const { data: loans, error: lErr } = await supabase
        .from("loan_tracker_loans")
        .select(
          "id,name,original_amount,current_balance,loan_type,term_months,loan_date,created_at,estimated_monthly_payment",
        )
        .order("created_at", { ascending: false });

      if (lErr) throw lErr;

      const { data: payments, error: pErr } = await supabase
        .from("loan_tracker_payments")
        .select("id,loan_id,amount,paid_by,payment_date,created_at");
      if (pErr) throw pErr;

      // group payments by loan
      const byLoan: Record<string, any[]> = {};
      for (const p of payments ?? []) {
        (byLoan[p.loan_id] ??= []).push(p);
      }

      // derive totals + sort payments by date
      const result = (loans ?? []).map((l) => {
        const ps = (byLoan[l.id] ?? []).sort((a, b) =>
          (b.payment_date ?? "").localeCompare(a.payment_date ?? "")
        );
        const total_paid = ps.reduce((s, p) => s + (p.amount ?? 0), 0);
        const last_payment = ps.length ? ps[0].payment_date : null;
        return { ...l, payments: ps, total_paid, last_payment };
      });

      return ok(result);
    }

    // DELETE LOAN (soft-delete recommended; here we hard delete for simplicity)
    if (action === "delete_loan") {
      const { loan_id, loan_name } = body as {
        loan_id?: string;
        loan_name?: string;
      };

      const id =
        loan_id ??
        (loan_name ? await resolveLoanIdByName(supabase, loan_name) : null);

      if (!id) return bad("delete_loan requires loan_id or valid loan_name.");

      // Hard delete (replace with is_archived=true if you prefer soft delete)
      const { error: delPays } = await supabase
        .from("loan_tracker_payments")
        .delete()
        .eq("loan_id", id);
      if (delPays) throw delPays;

      const { error: delLoan } = await supabase.from("loan_tracker_loans").delete().eq(
        "id",
        id,
      );
      if (delLoan) throw delLoan;

      return ok({ loan_id: id });
    }

    return bad(`Unknown action: ${action}`, 400);
  } catch (e) {
    console.error(e);
    return bad(e?.message ?? "Unexpected error", 500);
  }
});
