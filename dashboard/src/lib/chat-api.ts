// src/lib/chat-api.ts
export type ChatMessageRow = {
    id: string;
    session_id: string;
    role: "user" | "assistant" | "system";
    content: string;
    response_json: any | null;
    action: string | null;
    need_followup: boolean | null;
    created_at: string;
  };
  
  export type ChatSessionSummary = {
    session_id: string;
    message_count: number;
    started_at: string;
    last_at: string;
    last_snippet: string;
  };
  
  export async function fetchChatMessages(sessionId: string, opts?: { after?: string; limit?: number }) {
    const params = new URLSearchParams({ session_id: sessionId });
    if (opts?.after) params.set("after", opts.after);
    if (opts?.limit) params.set("limit", String(opts.limit));
  
    const r = await fetch(`/api/chats?${params.toString()}`);
    const json = await r.json();
    if (!r.ok || !json?.success) {
      throw new Error(json?.error || `${r.status} ${r.statusText}`);
    }
    return json.data as { session_id: string; messages: ChatMessageRow[] };
  }
  
  export async function fetchChatSessions(limit = 50) {
    const r = await fetch(`/api/chats?limit=${limit}`);
    const json = await r.json();
    if (!r.ok || !json?.success) {
      throw new Error(json?.error || `${r.status} ${r.statusText}`);
    }
    return json.data as { sessions: ChatSessionSummary[] };
  }
  