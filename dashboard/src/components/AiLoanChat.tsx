import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MessageCircle, X, Send, Loader2, CheckCircle, AlertCircle, Bot, Wallet, LineChart, Coins } from "lucide-react";
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip as ReTooltip,
} from "recharts";
import { LLMParseResponse } from "@/lib/parse-command";
type GetLoansParamsUI = { loan_name?: string };

// ────────────────────────────────────────────────────────────
// Env + Edge Function Caller (no shared supabase client)
// ────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const FUNCTION_NAME = "loan-manager";

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

async function callLoanManager(body: unknown) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.warn("Supabase env missing. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${FUNCTION_NAME}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            "x-client-info": "loan-tracker-ui",
        },
        body: JSON.stringify(body),
    });
    let json: any = null;
    try {
        json = await res.json();
    } catch { }
    if (!res.ok) {
        const msg = (json && (json.error || json.message)) || `${res.status} ${res.statusText}`;
        throw new Error(msg);
    }
    return json;
}

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
export interface Loan {
    id: string;
    name: string;
    original_amount: number;
    current_balance: number;
    loan_type?: string;
    term_months?: number;
    loan_date?: string;
    created_at?: string;
    payments?: Payment[];
    total_paid?: number;
    progress_percentage?: number;
}

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
    const payments = (loan.payments ?? []).slice().sort((a, b) => a.payment_date.localeCompare(b.payment_date));
    const total_paid = typeof loan.total_paid === "number" ? loan.total_paid : payments.reduce((s, p) => s + p.amount, 0);
    const remaining = loan.current_balance;
    const progress_pct = Math.min(100, Math.max(0, (total_paid / Math.max(1, loan.original_amount)) * 100));
    const is_paid_off = remaining <= 0.000001;

    let avgPayment: number | undefined;
    let avgDays: number | undefined;
    let projectedPayoff: string | undefined;

    if (payments.length > 0 && remaining > 0) {
        const amounts = payments.map((p) => p.amount);
        const total = amounts.reduce((s, a) => s + a, 0);
        avgPayment = total / payments.length;

        if (payments.length >= 2) {
            const dayDiffs: number[] = [];
            for (let i = 1; i < payments.length; i++) {
                const prev = new Date(payments[i - 1].payment_date);
                const curr = new Date(payments[i].payment_date);
                const diffDays = Math.max(1, Math.round((+curr - +prev) / 86400000));
                dayDiffs.push(diffDays);
            }
            avgDays = Math.round(dayDiffs.reduce((s, d) => s + d, 0) / dayDiffs.length);
        }

        const last = payments[payments.length - 1];
        if (avgPayment && avgPayment > 0 && avgDays && last?.payment_date) {
            const intervals = Math.ceil(remaining / avgPayment);
            const d = new Date(last.payment_date);
            d.setDate(d.getDate() + intervals * avgDays);
            projectedPayoff = toISO(d);
        }
    }

    return {
        ...loan,
        payments,
        total_paid,
        remaining,
        progress_pct,
        is_paid_off,
        avgPayment,
        avgDays,
        projectedPayoff,
        first_payment: payments[0]?.payment_date,
        last_payment: payments[payments.length - 1]?.payment_date,
    };
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

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────
export default function AiLoanAssistantPro({ onLoanUpdate }: { onLoanUpdate?: () => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId] = useState<string>(() => getOrCreateSessionId());
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: Date.now(),
            type: "assistant",
            variant: "text",
            content: "Hi! How can I help you manage your loans?",
            timestamp: new Date(),
        },
    ]);
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    async function logChat(
        role: "user" | "assistant" | "system",
        content: string,
        extra?: Partial<LLMParseResponse>
      ) {
        try {
          await supabase.from("loan_tracker_chat_messages").insert([{
            session_id: sessionId,
            role,
            content,
            response_json: extra ?? null,
            action: extra?.action ?? null,
            need_followup: typeof extra?.need_followup === "boolean" ? extra?.need_followup : null,
          }]);
        } catch {
          // swallow logging errors (don’t break chat)
        }
      }
      

    // Parse natural language using your API route (LLM with Structured Outputs)
    async function parseCommand(command: string): Promise<ParserResult> {
        try {
            const res = await fetch("/api/parse-command", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ command }),
            });
            if (!res.ok) throw new Error("Failed to parse command");
            return (await res.json()) as ParserResult;
        } catch (e: any) {
            console.error(e);
            return {
                action: "unknown",
                parameters: {},
                message: "Sorry, I couldn't understand that.",
                need_followup: false,
                followup_question: null,
            };
        }
    }

    // Execute parsed command with rich responses
    async function execute(parsed: ParserResult): Promise<ChatMessage[]> {
        const { action, parameters } = parsed;

        // GET LOANS (supports optional loan_name filter for details)
        if (action === "get_loans") {
            const p = (parameters as GetLoansParamsUI) || {};
            const res = await callLoanManager({ action: "get_loans" });
            if (!res?.success) {
                return [
                    {
                        id: Date.now(),
                        type: "assistant",
                        variant: "text",
                        status: "error",
                        content: res?.error || "Failed to fetch loans",
                        timestamp: new Date(),
                    },
                ];
            }

            const raw: Loan[] = res.data;
            const derived = raw.map(deriveLoan);

            // If the user asked about a specific loan, try to show details for that one
            if (p.loan_name) {
                const q = p.loan_name.trim().toLowerCase();

                // case-insensitive match with a couple of fallbacks
                const exact = derived.find((l) => l.name.toLowerCase() === q);
                const starts = exact || derived.find((l) => l.name.toLowerCase().startsWith(q));
                const fuzzy = starts || derived.find((l) => l.name.toLowerCase().includes(q));
                const target = fuzzy;

                if (!target) {
                    return [
                        {
                            id: Date.now(),
                            type: "assistant",
                            variant: "text",
                            status: "error",
                            content: `I couldn't find a loan named “${p.loan_name}”. I currently have ${derived.length} loan${derived.length === 1 ? "" : "s"}.`,
                            timestamp: new Date(),
                        },
                    ];
                }

                // Compose a concise, info-dense summary message
                const summary =
                    `Here's what I have for “${target.name}”:\n` +
                    `• Original: ${fmtCurrency(target.original_amount)}\n` +
                    `• Remaining: ${fmtCurrency(Math.max(0, target.remaining))}\n` +
                    (target.term_months ? `• Term: ${target.term_months} months\n` : "") +
                    (target.loan_date ? `• Started: ${target.loan_date}\n` : "") +
                    (target.last_payment ? `• Last payment: ${target.last_payment}\n` : "") +
                    (typeof target.total_paid === "number" ? `• Total paid: ${fmtCurrency(target.total_paid)}\n` : "") +
                    (target.projectedPayoff ? `• Est. payoff: ${target.projectedPayoff}\n` : "");

                const msgs: ChatMessage[] = [
                    {
                        id: Date.now(),
                        type: "assistant",
                        variant: "text",
                        status: "success",
                        content: summary.trim(),
                        timestamp: new Date(),
                    },
                    {
                        id: Date.now() + 1,
                        type: "assistant",
                        variant: "loans",
                        loans: [target],
                        timestamp: new Date(),
                        status: "success",
                    },
                    {
                        id: Date.now() + 2,
                        type: "assistant",
                        variant: "text",
                        content: `Want to see the recent payment history for “${target.name}”? You can say “Show payments for ${target.name}”.`,
                        timestamp: new Date(),
                    },
                ];

                return msgs;
            }

            // Default behavior: portfolio summary + all loans
            const portfolio = summarizePortfolio(derived);
            return [
                { id: Date.now(), type: "assistant", variant: "summary", portfolio, timestamp: new Date(), status: "success" },
                { id: Date.now() + 1, type: "assistant", variant: "loans", loans: derived, timestamp: new Date(), status: "success" },
            ];
        }

        // ADD PAYMENT
        if (action === "add_payment") {
            const p = parameters as AddPaymentParams;

            if (!p.loan_name || typeof p.amount !== "number") {
                return [
                    {
                        id: Date.now(),
                        type: "assistant",
                        variant: "text",
                        status: "error",
                        content: "I need a loan name and a numeric amount to add a payment.",
                        timestamp: new Date(),
                    },
                ];
            }

            const payload = {
                action: "add_payment" as const,
                loan_name: p.loan_name,
                amount: p.amount,
                paid_by: p.person ?? "Steven",           // 👈 explicit default
                payment_date: p.payment_date,            // optional; server will default to today if missing
            };

            const res = await callLoanManager(payload);
            if (!res?.success) {
                return [
                    {
                        id: Date.now(),
                        type: "assistant",
                        variant: "text",
                        status: "error",
                        content: res?.error || "Failed to add payment",
                        timestamp: new Date(),
                    },
                ];
            }

            onLoanUpdate?.();
            return [
                {
                    id: Date.now(),
                    type: "assistant",
                    variant: "text",
                    status: "success",
                    content: `💸 Recorded ${fmtCurrency(p.amount)} toward “${p.loan_name}”.`,
                    timestamp: new Date(),
                },
            ];
        }

        // CREATE LOAN
        if (action === "create_loan") {
            const p = parameters as CreateLoanParams;

            // 🔒 UI-side guard: do not invent defaults; require all four fields
            const missing: string[] = [];
            if (!p.loan_name) missing.push("loan name");
            if (typeof p.amount !== "number") missing.push("amount");
            if (!p.loan_date) missing.push("loan date (YYYY-MM-DD)");
            if (typeof p.term_months !== "number") missing.push("term in months");

            if (missing.length > 0) {
                return [
                    {
                        id: Date.now(),
                        type: "assistant",
                        variant: "text",
                        status: "error",
                        content:
                            `I still need: ${missing.join(", ")}.` +
                            `\nTip: you can say “Create a loan for 'Mirror' for $1,000 on 2025-08-01 with 18 months financing.”`,
                        timestamp: new Date(),
                    },
                ];
            }

            const payload = {
                action: "create_loan",
                name: p.loan_name,
                original_amount: p.amount,
                loan_type: p.loan_type || "general",
                term_months: p.term_months,      // ✅ required, no default
                loan_date: p.loan_date,          // ✅ required, no default
            };

            const res = await callLoanManager(payload);
            if (!res?.success) {
                return [
                    {
                        id: Date.now(),
                        type: "assistant",
                        variant: "text",
                        status: "error",
                        content: res?.error || "Failed to create loan",
                        timestamp: new Date(),
                    },
                ];
            }

            onLoanUpdate?.();
            return [
                {
                    id: Date.now(),
                    type: "assistant",
                    variant: "text",
                    status: "success",
                    content: `✨ New loan created: ${p.loan_name} for ${fmtCurrency(p.amount)} (${p.term_months} mo) on ${p.loan_date}.`,
                    timestamp: new Date(),
                },
            ];
        }


        // DELETE LOAN
        if (action === "delete_loan") {
            const p = parameters as DeleteLoanParams;
            const payload = {
                action: "delete_loan",
                loan_id: p.loan_id, // optional if you support it
                loan_name: p.loan_name,
            };
            const res = await callLoanManager(payload);
            if (!res?.success) {
                return [
                    {
                        id: Date.now(),
                        type: "assistant",
                        variant: "text",
                        status: "error",
                        content: res?.error || "Failed to delete loan",
                        timestamp: new Date(),
                    },
                ];
            }
            onLoanUpdate?.();
            return [
                {
                    id: Date.now(),
                    type: "assistant",
                    variant: "text",
                    status: "success",
                    content: `Deleted loan: ${p.loan_name || p.loan_id}.`,
                    timestamp: new Date(),
                },
            ];
        }

        // Unknown
        return [
            {
                id: Date.now(),
                type: "assistant",
                variant: "text",
                status: "error",
                content: "I understood your request but couldn't execute that yet.",
                timestamp: new Date(),
            },
        ];
    }

    async function onSend() {
        if (!input.trim() || isLoading) return;
        const content = input.trim();
        const userMsg: ChatMessage = {
            id: Date.now(),
            type: "user",
            variant: "text",
            content,
            timestamp: new Date(),
        } as TextMsg;
        logChat("user", content);
        setMessages((m) => [...m, userMsg]);
        setInput("");
        setIsLoading(true);

        try {
            const parsed = await parseCommand(content);

            // 1) Follow-up flow
            if (parsed.need_followup && parsed.followup_question) {
                logChat("assistant", parsed.followup_question!, parsed);
                setMessages((m) => [
                    ...m,
                    {
                        id: Date.now(),
                        type: "assistant",
                        variant: "text",
                        content: parsed.followup_question!,
                        timestamp: new Date(),
                    },
                ]);
                return;
            }

            // 2) Unknown intent → show the model's message verbatim
            if (parsed.action === "unknown") {
                logChat("assistant", parsed.message, parsed);
                setMessages((m) => [
                    ...m,
                    {
                        id: Date.now(),
                        type: "assistant",
                        variant: "text",
                        content:
                            parsed.message ||
                            "I can create loans, add payments, show loans, or delete a loan. What would you like to do?",
                        timestamp: new Date(),
                    },
                ]);
                return;
            }

            // 3) Otherwise, execute as usual
            const replies = await execute(parsed);
            logChat("assistant", parsed.message, parsed);
            setMessages((m) => [...m, ...replies]);
        } catch (e: any) {
            logChat("assistant", e?.message || "Unknown", { action: "unknown" });
            setMessages((m) => [
                ...m,
                {
                    id: Date.now(),
                    type: "assistant",
                    variant: "text",
                    status: "error",
                    content: `Sorry, something went wrong: ${e?.message || "Unknown"}`,
                    timestamp: new Date(),
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    }


    function handleQuickAdd(loan: ReturnType<typeof deriveLoan>, delta: number) {
        void (async () => {
            setIsLoading(true);
            try {
                const res = await callLoanManager({
                    action: "add_payment",
                    loan_name: loan.name,
                    amount: delta,
                    paid_by: "Steven",
                    payment_date: new Date().toISOString().slice(0, 10),
                });
                if (res?.success) {
                    onLoanUpdate?.();
                    setMessages((m) => [
                        ...m,
                        {
                            id: Date.now(),
                            type: "assistant",
                            variant: "text",
                            status: "success",
                            content: `+${fmtCurrency(delta)} to ${loan.name}. Nice!`,
                            timestamp: new Date(),
                        },
                    ]);
                } else {
                    setMessages((m) => [
                        ...m,
                        {
                            id: Date.now(),
                            type: "assistant",
                            variant: "text",
                            status: "error",
                            content: res?.error || "Payment failed",
                            timestamp: new Date(),
                        },
                    ]);
                }
            } catch (e: any) {
                setMessages((m) => [
                    ...m,
                    {
                        id: Date.now(),
                        type: "assistant",
                        variant: "text",
                        status: "error",
                        content: e?.message || "Payment failed",
                        timestamp: new Date(),
                    },
                ]);
            } finally {
                setIsLoading(false);
            }
        })();
    }

    // Slash command mini-hints
    const showHints = input.startsWith("/");
    const hints = useMemo(() => {
        const base = [
            { key: "/summary", text: "Show me all current loans", action: () => setInput("Show me all current loans") },
            { key: "/pay", text: "Steven paid $50 to the IKEA bed", action: () => setInput("Steven paid $50 to the IKEA bed") },
            { key: "/new", text: "Create a new loan: Katerina bought a chair for $800", action: () => setInput("Create a new loan: Katerina bought a chair for $800") },
        ];
        const q = input.slice(1).toLowerCase();
        return base.filter((h) => h.key.includes(q));
    }, [input]);

    return (
        <>
            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen((o) => !o)}
                className={`fixed bottom-4 right-4 z-50 p-4 rounded-full shadow-lg transition-all duration-300 ${isOpen ? "bg-gray-700 hover:bg-gray-800" : "bg-blue-600 hover:bg-blue-700"
                    } text-white`}
            >
                {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
            </button>

            {/* Chat Panel */}
            {isOpen && (
                <div className="fixed bottom-20 right-4 z-40 w-[420px] h-[580px] rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-md shadow-2xl flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center shadow">
                            <Bot size={18} />
                        </div>
                        <div>
                            <div className="font-semibold text-gray-800">AI Loan Assistant</div>
                            <div className="text-xs text-gray-500">Ask me to add payments, create loans, or summarize</div>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}>
                                <div
                                    className={`max-w-[85%] rounded-2xl shadow-sm ${msg.type === "user"
                                        ? "bg-blue-600 text-white"
                                        : msg.status === "error"
                                            ? "bg-red-50 text-red-800 border border-red-200"
                                            : msg.status === "success"
                                                ? "bg-green-50 text-green-800 border border-green-200"
                                                : "bg-white/90 text-gray-800 border border-gray-200"
                                        } p-3`}
                                >
                                    {/* Assistant bubble header icons */}
                                    {msg.type === "assistant" && msg.variant !== "text" && (
                                        <div className="flex items-center gap-2 mb-1 text-gray-700">
                                            {msg.variant === "summary" && <LineChart size={16} />}
                                            {msg.variant === "loans" && <Coins size={16} />}
                                            {msg.status === "success" && <CheckCircle size={16} className="text-green-600" />}
                                            {msg.status === "error" && <AlertCircle size={16} className="text-red-600" />}
                                        </div>
                                    )}

                                    {/* Render variants */}
                                    {msg.variant === "text" && <p className="text-sm whitespace-pre-line">{(msg as TextMsg).content}</p>}

                                    {msg.variant === "summary" && (
                                        <div className="text-sm">
                                            {(() => {
                                                const m = msg as SummaryMsg;
                                                const p = m.portfolio;
                                                return (
                                                    <div className="space-y-2">
                                                        <div className="flex items-center gap-3">
                                                            <Donut paid={p.total_paid} remaining={p.total_remaining} />
                                                            <div>
                                                                <div className="font-semibold text-gray-800">Portfolio</div>
                                                                <div className="text-gray-700">
                                                                    {p.loan_count} loans • {p.open_count} open • {p.paid_off_count} paid
                                                                </div>
                                                                <div className="text-gray-700">Progress {fmtPercent(p.portfolio_progress)}</div>
                                                            </div>
                                                        </div>
                                                        <div className="text-gray-700">
                                                            <div>
                                                                Total Original: <span className="font-medium text-gray-900">{fmtCurrency(p.total_original)}</span>
                                                            </div>
                                                            <div>
                                                                Total Paid: <span className="font-medium text-gray-900">{fmtCurrency(p.total_paid)}</span>
                                                            </div>
                                                            <div>
                                                                Remaining: <span className="font-medium text-gray-900">{fmtCurrency(p.total_remaining)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}

                                    {msg.variant === "loans" && (
                                        <div className="space-y-3">
                                            {(msg as LoansMsg).loans.map((l) => (
                                                <LoanCard key={l.id} loan={l} onQuickAdd={handleQuickAdd} />
                                            ))}
                                        </div>
                                    )}

                                    <div className="text-[10px] opacity-60 mt-2">
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white/90 text-gray-800 border border-gray-200 p-3 rounded-2xl flex items-center gap-2">
                                    <TypingDots />
                                    <span className="text-sm">Thinking…</span>
                                </div>
                            </div>
                        )}
                        <div ref={endRef} />
                    </div>

                    {/* Input */}
                    <div className="p-3 border-t border-gray-200 bg-white/70 backdrop-blur">
                        <div className="relative">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        void onSend();
                                    }
                                }}
                                placeholder=""
                                className="w-full pr-24 pl-3 py-2 rounded-xl border border-gray-300 bg-white/80 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 placeholder-gray-500"
                                disabled={isLoading}
                            />
                            <button
                                onClick={() => void onSend()}
                                disabled={isLoading || !input.trim()}
                                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
                            >
                                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                            </button>

                            {/* Slash command hints */}
                            {showHints && (
                                <div className="absolute left-0 right-24 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                                    {hints.length === 0 ? (
                                        <div className="px-3 py-2 text-sm text-gray-500">No matches</div>
                                    ) : (
                                        hints.map((h) => (
                                            <button key={h.key} onClick={() => h.action()} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
                                                <span className="font-mono text-xs mr-2 text-gray-500">{h.key}</span>
                                                {h.text}
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
