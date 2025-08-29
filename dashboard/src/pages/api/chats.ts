// src/pages/api/chats.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

// Prefer service role on the server (stays private), fallback to anon if needed
const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SERVICE_KEY =
  (process.env.SUPABASE_SERVICE_ROLE_KEY as string) ||
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string);

if (!NEXT_PUBLIC_SUPABASE_URL || !SERVICE_KEY) {
  console.warn("[/api/chats] Missing Supabase env vars");
}

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

type ChatRow = {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  response_json: any | null;
  action: string | null;
  need_followup: boolean | null;
  created_at: string; // ISO
};

type SessionSummary = {
  session_id: string;
  message_count: number;
  started_at: string;
  last_at: string;
  last_snippet: string;
};

function bad(res: NextApiResponse, status: number, error: string) {
  return res.status(status).json({ success: false, error });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return bad(res, 405, "Method not allowed");
  }

  const { session_id, after, limit: limitStr } = req.query as {
    session_id?: string;
    after?: string;
    limit?: string;
  };

  const limit = Math.min(Math.max(parseInt(limitStr || "100", 10) || 100, 1), 500);

  try {
    if (session_id) {
      // === Return messages for a specific session ===
      let q = supabase
        .from("loan_tracker_chat_messages")
        .select("id,session_id,role,content,response_json,action,need_followup,created_at")
        .eq("session_id", session_id)
        .order("created_at", { ascending: true })
        .limit(limit);

      if (after) q = q.gt("created_at", after);

      const { data, error } = await q;
      if (error) throw error;

      return res.status(200).json({
        success: true,
        data: { session_id, messages: (data as ChatRow[]) ?? [] },
      });
    }

    // === No session_id → list recent sessions ===
    // Strategy: pull recent N messages and group in-memory into distinct sessions.
    const { data, error } = await supabase
      .from("loan_tracker_chat_messages")
      .select("session_id,created_at,role,content")
      .order("created_at", { ascending: false })
      .limit(1000); // plenty; we’ll compress to unique sessions below
    if (error) throw error;

    const sessions = new Map<string, SessionSummary>();

    (data ?? []).forEach((r: any) => {
      const sid = r.session_id as string;
      const created = new Date(r.created_at).toISOString();
      const existing = sessions.get(sid);
      if (!existing) {
        sessions.set(sid, {
          session_id: sid,
          message_count: 1,
          started_at: created,
          last_at: created,
          last_snippet: (r.content || "").toString().slice(0, 140),
        });
      } else {
        existing.message_count += 1;
        existing.started_at = created < existing.started_at ? created : existing.started_at;
        existing.last_at = created > existing.last_at ? created : existing.last_at;
      }
    });

    const list = Array.from(sessions.values())
      .sort((a, b) => b.last_at.localeCompare(a.last_at))
      .slice(0, Math.min(limit, 200));

    return res.status(200).json({ success: true, data: { sessions: list } });
  } catch (e: any) {
    console.error("[/api/chats] error:", e);
    return bad(res, 500, e?.message || "Unexpected error");
  }
}
