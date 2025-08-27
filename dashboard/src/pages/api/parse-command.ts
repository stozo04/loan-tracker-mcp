// src/pages/api/parse-command.ts
import type { NextApiRequest, NextApiResponse } from "next";
import {
  makeSystemPrompt,
  APP_TIMEZONE,
  type LLMParseResponse,
} from "@/lib/parse-command";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY as string;
const MODEL = process.env.LOAN_PARSER_MODEL || "gpt-5.1";

function bad(res: NextApiResponse, status: number, message: string) {
  return res.status(status).json({
    action: "unknown",
    parameters: {},
    message,
    need_followup: false,
    followup_question: null,
  });
}

function todayInTZ(tz: string): string {
  const d = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "0000";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${day}`;
}

// Try to parse JSON from any Responses API shape
function extractJSON(payload: any): any | null {
  // Preferred convenience field
  if (typeof payload?.output_text === "string") {
    const t = payload.output_text.trim();
    if (t) {
      try { return JSON.parse(t); } catch { }
    }
  }
  // Walk output[].content[].text
  const out = payload?.output;
  if (Array.isArray(out)) {
    for (const item of out) {
      const content = item?.content;
      if (Array.isArray(content)) {
        for (const c of content) {
          if (typeof c?.text === "string") {
            const txt = c.text.trim();
            if (txt) {
              try { return JSON.parse(txt); } catch { }
            }
          }
        }
      }
    }
  }
  // Legacy fallback (rare)
  const legacy = payload?.choices?.[0]?.message?.content;
  if (typeof legacy === "string") {
    const t = legacy.trim();
    if (t) {
      try { return JSON.parse(t); } catch { }
    }
  }
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return bad(res, 405, "Method not allowed.");
  if (!OPENAI_API_KEY) return bad(res, 500, "OPENAI_API_KEY is not set.");

  const { command } = (req.body ?? {}) as { command?: string };
  if (!command || typeof command !== "string") {
    return bad(res, 400, "Missing 'command' string in body.");
  }

  const todayISO = todayInTZ(APP_TIMEZONE);

  // OVERRIDE the prompt to avoid tool-calls entirely and force raw JSON only.
  const system =
    makeSystemPrompt(todayISO) +
    "\n\nOVERRIDE: Do NOT call any tools. Return ONLY a single JSON object exactly matching the Output contract. No prose.";

  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        input: [
          { role: "system", content: system },
          { role: "user", content: command },
        ],
        // No text.format schema and no tools – we validate ourselves.
      }),
    });

    if (!r.ok) {
      const errTxt = await r.text().catch(() => "");
      return bad(res, r.status, `OpenAI error: ${errTxt || r.statusText}`);
    }

    const data = await r.json();
    const parsed = extractJSON(data);

    if (!parsed || typeof parsed !== "object") {
      return bad(res, 502, "Parser returned no JSON.");
    }

    const { action, parameters, message, need_followup, followup_question } = parsed as LLMParseResponse;

    if (
      !action ||
      typeof message !== "string" ||
      typeof need_followup !== "boolean" ||
      (need_followup && followup_question !== null && typeof followup_question !== "string" && followup_question !== undefined)
    ) {
      return bad(res, 502, "Structured output missing required fields.");
    }

    // Minimal per-action validation when not asking a follow-up
    const p: any = parameters || {};
    if (!need_followup) {
      if (action === "create_loan") {
        if (typeof p.loan_name !== "string" || typeof p.amount !== "number") {
          return bad(res, 400, "Missing loan_name or amount for create_loan.");
        }
      } else if (action === "add_payment") {
        if (typeof p.loan_name !== "string" || typeof p.amount !== "number") {
          return bad(res, 400, "Missing loan_name or amount for add_payment.");
        }
      } else if (action === "delete_loan") {
        if (typeof p.loan_name !== "string" && typeof p.loan_id !== "string") {
          return bad(res, 400, "Missing loan_name (or loan_id) for delete_loan.");
        }
      }
    }

    // ✅ Server-side validation: enforce required fields
    if (action === "create_loan" && !need_followup) {
      const { loan_name, amount, loan_date, term_months } = parameters as any;

      if (!loan_name || !amount || !loan_date || !term_months) {
        return bad(res, 400, "Missing required fields for create_loan.");
      }
    }

    return res.status(200).json({
      action,
      parameters: parameters ?? {},
      message,
      need_followup,
      followup_question: need_followup ? followup_question ?? "Could you clarify?" : null,
    } satisfies LLMParseResponse);
  } catch (e: any) {
    return bad(res, 500, `Parser failed: ${e?.message || "Unknown error"}`);
  }
}
