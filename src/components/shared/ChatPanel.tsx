import { useEffect, useRef, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Send, MessageCircle, Lock, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  body: string;
  created_at: string;
}

interface ThreadResponse {
  can_send: boolean;
  disabled_reason: string | null;
  messages: ChatMessage[];
}

const POLL_INTERVAL_MS = 8000;

/**
 * Chat between a consumer and their assigned nurse, scoped to either a
 * single booking or a whole care package. Disables itself automatically
 * once the backend reports the booking/package as terminal (completed /
 * cancelled / missed) — no client-side "is this over" logic here, the
 * server is the single source of truth for that.
 */
export function ChatPanel({ scope, id }: { scope: "booking" | "package"; id: string }) {
  const { user } = useAuth();
  const [thread, setThread] = useState<ThreadResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const endpoint = `/api/messages/${scope}/${id}`;

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    apiFetch(endpoint)
      .then(setThread)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load messages"))
      .finally(() => setLoading(false));
  }, [endpoint]);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [thread?.messages.length]);

  const send = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      await apiFetch(endpoint, { method: "POST", body: JSON.stringify({ body: draft.trim() }) });
      setDraft("");
      load(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card px-5 py-8 text-center text-[13px] text-muted-foreground">
        Loading conversation…
      </div>
    );
  }

  if (error && !thread) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-6 text-center text-[13px] text-red-600">
        {error}
        <button onClick={() => load()} className="ml-2 inline-flex items-center gap-1 text-primary hover:underline">
          <RefreshCw className="h-3 w-3" /> Retry
        </button>
      </div>
    );
  }

  if (!thread) return null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
        <MessageCircle className="h-4 w-4 text-primary" />
        <span className="text-[13px] font-semibold text-foreground">Messages</span>
      </div>

      <div ref={scrollRef} className="max-h-80 overflow-y-auto px-4 py-3 space-y-2.5 min-h-[120px]">
        {thread.messages.length === 0 && (
          <p className="text-[12.5px] text-muted-foreground text-center py-6">
            No messages yet. Say hello!
          </p>
        )}
        {thread.messages.map(m => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[80%] rounded-2xl px-3.5 py-2",
                mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm"
              )}>
                {!mine && <p className="text-[10.5px] font-semibold opacity-70 mb-0.5">{m.sender_name}</p>}
                <p className="text-[13px] leading-snug whitespace-pre-wrap break-words">{m.body}</p>
                <p className={cn("text-[10px] mt-1", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {thread.can_send ? (
        <div className="flex items-center gap-2 px-3 py-2.5 border-t border-border">
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Type a message…"
            className="flex-1 px-3 py-2 text-[13px] rounded-full border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
          <button
            onClick={send}
            disabled={sending || !draft.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-95 disabled:opacity-50 transition"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-3 border-t border-border bg-muted/30 text-[12px] text-muted-foreground">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          {thread.disabled_reason ?? "Messaging is closed for this conversation."}
        </div>
      )}
    </div>
  );
}
