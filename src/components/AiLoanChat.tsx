import React, { useEffect, useMemo, useRef, useState } from "react";
import { callLoanManager } from "@/lib/loan-manager";
import { deriveLoan as deriveLoanShared, type Loan as LoanRow } from "../index";
import { MessageCircle, X, Send, Loader2, CheckCircle, AlertCircle, Bot, Wallet, LineChart, Coins } from "lucide-react";
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip as ReTooltip,
} from "recharts";
import { LLMParseResponse } from "@/lib/parse-command";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
type GetLoansParamsUI = { loan_name?: string };

// ────────────────────────────────────────────────────────────
// Env + Edge Function Caller (no shared supabase client)
// ────────────────────────────────────────────────────────────
// Edge Function calls are centralized in @/lib/loan-manager

function getOrCreateSessionId(): string {
    if (typeof window === "undefined") return crypto.randomUUID();
    const KEY = "loan_chat_session_id";
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  }

// callLoanManager is imported from @/lib/loan-manager

// ────────────────────────────────────────────────────────────
export type PaidBy = "Steven" | "Katerina";
export interface Payment {
    id?: string;
    loan_id: string;
    amount: number;
    paid_by: PaidBy;
    payment_date: string; // YYYY-MM-DD
    created_at?: string;
}
export type Loan = LoanRow;

// LLM parser response (matches our new API contract)
type Action = "create_loan" | "add_payment" | "get_loans" | "delete_loan" | "unknown";
type CreateLoanParams = { loan_name: string; amount: number; term_months?: number; loan_date?: string; lender?: string; loan_type?: string; };
type AddPaymentParams = { amount: number; loan_name: string; person?: PaidBy; payment_date?: string; };
type DeleteLoanParams = { loan_name: string; loan_id?: string; };
type ParseParameters =
    | CreateLoanParams
    | AddPaymentParams
    | DeleteLoanParams
    | GetLoansParamsUI
    | Record<string, never>;

type ParserResult = {
    action: Action;
    parameters: ParseParameters;
    message: string;
    need_followup: boolean;
    followup_question: string | null;
};

// ────────────────────────────────────────────────────────────
// Derivation helpers
// ────────────────────────────────────────────────────────────
const fmtCurrency = (n: number) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(n);
const fmtPercent = (n: number, digits = 1) => `${n.toFixed(digits)}%`;
const toISO = (d: Date) => d.toISOString().slice(0, 10);

function deriveLoan(loan: Loan) {
    // Use the shared derivation to ensure canonical logic
    const base = deriveLoanShared(loan as any);
    const remaining = base.remaining_balance;
    const progress_pct = base.progress_percentage;
    const avgDays = base.average_days_between_payments;
    const projectedPayoff = base.projected_payoff_date;
    const payments = base.payments ?? [];
    const total_paid = base.total_paid;
    const is_paid_off = base.is_paid_off;
    return { ...base, payments, total_paid, remaining, progress_pct, is_paid_off, avgDays, projectedPayoff } as any;
}

function summarizePortfolio(loans: ReturnType<typeof deriveLoan>[]) {
    const loan_count = loans.length;
    const paid_off_count = loans.filter((l) => l.is_paid_off).length;
    const open_count = loan_count - paid_off_count;
    const total_original = loans.reduce((s, l) => s + l.original_amount, 0);
    const total_paid = loans.reduce((s, l) => s + l.total_paid, 0);
    const total_remaining = loans.reduce((s, l) => s + Math.max(0, l.remaining), 0);
    const portfolio_progress = total_original ? (total_paid / total_original) * 100 : 0;

    const by_type: Record<string, { loan_count: number; total_original: number; total_paid: number; total_remaining: number; progress_pct: number }> = {};
    for (const l of loans) {
        const key = l.loan_type ?? "general";
        by_type[key] ??= { loan_count: 0, total_original: 0, total_paid: 0, total_remaining: 0, progress_pct: 0 };
        by_type[key].loan_count++;
        by_type[key].total_original += l.original_amount;
        by_type[key].total_paid += l.total_paid;
        by_type[key].total_remaining += Math.max(0, l.remaining);
    }
    for (const k of Object.keys(by_type)) {
        const g = by_type[k];
        g.progress_pct = g.total_original ? (g.total_paid / g.total_original) * 100 : 0;
    }

    return { loan_count, paid_off_count, open_count, total_original, total_paid, total_remaining, portfolio_progress, by_type };
}

// ────────────────────────────────────────────────────────────
// UI bits
// ────────────────────────────────────────────────────────────
const colors = ["#8884d8", "#82ca9d", "#ffc658", "#a4de6c", "#8dd1e1", "#d0ed57"];

function Donut({ paid, remaining }: { paid: number; remaining: number }) {
    const data = useMemo(
        () => [
            { name: "Paid", value: Math.max(0, paid) },
            { name: "Remaining", value: Math.max(0, remaining) },
        ],
        [paid, remaining]
    );
    return (
        <div className="w-24 h-24">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie data={data} innerRadius={28} outerRadius={44} dataKey="value" strokeWidth={0}>
                        {data.map((_, i) => (
                            <Cell key={i} fill={i === 0 ? colors[1] : colors[0]} />
                        ))}
                    </Pie>
                    <ReTooltip formatter={(v: any, n: any) => [fmtCurrency(v as number), n as string]} />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}

function ProgressBar({ pct }: { pct: number }) {
    return (
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
        </div>
    );
}

function LoanCard({ loan, onQuickAdd }: { loan: ReturnType<typeof deriveLoan>; onQuickAdd: (loan: ReturnType<typeof deriveLoan>, delta: number) => void }) {
    return (
        <div className="rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-md shadow-sm p-4 flex gap-4">
            <Donut paid={loan.total_paid} remaining={loan.remaining} />
            <div className="flex-1">
                <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-gray-500" />
                    <h4 className="font-semibold text-gray-800">{loan.name}</h4>
                    {loan.is_paid_off && <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">PAID</span>}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                    <div>
                        Original: <span className="font-medium text-gray-800">{fmtCurrency(loan.original_amount)}</span>
                    </div>
                    <div>
                        Remaining: <span className="font-medium text-gray-800">{fmtCurrency(Math.max(0, loan.remaining))}</span>
                    </div>
                    <div>
                        Est. Monthly: <span className="font-medium text-gray-800">{fmtCurrency(loan.estimated_monthly_payment ?? (loan.original_amount / Math.max(1, loan.term_months)))}</span>
                    </div>
                </div>
                <div className="mt-2">
                    <ProgressBar pct={loan.progress_pct} />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>{fmtPercent(loan.progress_pct)} paid</span>
                        <span>{loan.projectedPayoff ? `Est. payoff ${loan.projectedPayoff}` : loan.avgDays ? `~${loan.avgDays}d cadence` : ""}</span>
                    </div>
                </div>
                {!loan.is_paid_off && (
                    <div className="flex gap-2 mt-3">
                        {[25, 50, 100].map((amt) => (
                            <button
                                key={amt}
                                onClick={() => onQuickAdd(loan, amt)}
                                className="text-xs px-2 py-1 rounded-md border border-gray-300 hover:bg-gray-50"
                            >
                                +{fmtCurrency(amt)}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function TypingDots() {
    return (
        <div className="flex items-center gap-1">
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
        </div>
    );
}

// ────────────────────────────────────────────────────────────
// Chat types
// ────────────────────────────────────────────────────────────
interface BaseMsg {
    id: number;
    type: "user" | "assistant";
    timestamp: Date;
    status?: "success" | "error";
}
interface TextMsg extends BaseMsg {
    variant: "text";
    content: string;
}
interface SummaryMsg extends BaseMsg {
    variant: "summary";
    portfolio: ReturnType<typeof summarizePortfolio>;
}
interface LoansMsg extends BaseMsg {
    variant: "loans";
    loans: ReturnType<typeof deriveLoan>[];
}

type ChatMessage = TextMsg | SummaryMsg | LoansMsg;


