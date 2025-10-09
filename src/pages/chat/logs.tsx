// src/pages/chat/logs.tsx
import { useEffect, useState } from "react";
import { fetchChatSessions, fetchChatMessages } from "@/lib/chat-api";

export default function ChatLogs() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    fetchChatSessions(50).then(d => setSessions(d.sessions)).catch(console.error);
  }, []);

  useEffect(() => {
    if (!active) return;
    fetchChatMessages(active, { limit: 500 }).then(d => setMessages(d.messages)).catch(console.error);
  }, [active]);

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
      <div>
        <h2 className="font-semibold mb-2">Sessions</h2>
        <ul className="space-y-2">
          {sessions.map(s => (
            <li key={s.session_id}>
              <button
                className={`w-full text-left p-2 rounded ${active === s.session_id ? "bg-indigo-100" : "hover:bg-gray-100"}`}
                onClick={() => setActive(s.session_id)}
              >
                <div className="text-sm font-mono truncate">{s.session_id}</div>
                <div className="text-xs text-gray-600">
                  {new Date(s.started_at).toLocaleString()} → {new Date(s.last_at).toLocaleString()}
                </div>
                <div className="text-xs text-gray-500">{s.message_count} messages</div>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="md:col-span-2">
        <h2 className="font-semibold mb-2">Messages {active ? `(${active})` : ""}</h2>
        <div className="space-y-3">
          {messages.map(m => (
            <div key={m.id} className="border rounded p-3">
              <div className="text-xs text-gray-500">{new Date(m.created_at).toLocaleString()} · {m.role}</div>
              <div className="whitespace-pre-wrap">{m.content}</div>
              {m.action && (
                <div className="mt-2 text-xs text-gray-600">
                  action: <span className="font-mono">{m.action}</span>
                  {typeof m.need_followup === "boolean" ? ` · need_followup: ${m.need_followup}` : ""}
                </div>
              )}
            </div>
          ))}
          {!messages.length && active && (
            <div className="text-sm text-gray-500">No messages yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
