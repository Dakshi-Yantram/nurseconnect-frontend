import { useState, useRef, useEffect } from "react";
import { Send, Bot, User as UserIcon, Headset } from "lucide-react";
import { apiFetch } from "@/lib/api";

/**
 * Help-center bot, same shape as Swiggy/Zomato: type a question, the bot
 * tries to answer it from the FAQ catalogue (POST /api/help/ask). If the
 * person says none of the suggestions helped (or the bot has nothing),
 * it hands off to a real support agent by raising a ticket
 * (POST /api/help/escalate), carrying the conversation so the agent isn't
 * starting from zero.
 */

interface BotSuggestion { faq_id: string; question: string; answer: string; score: number }
interface BotAskResponse { resolved: boolean; suggestions: BotSuggestion[]; message: string }

type ChatMessage =
  | { role: "user"; text: string }
  | { role: "bot"; text: string; suggestions?: BotSuggestion[]; offerEscalate?: boolean }
  | { role: "system"; text: string };

export function HelpBotChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "bot", text: "Hi! Ask me anything and I'll try to help — if I can't, I'll connect you to our support team." },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const shownFaqIds = useRef<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || sending || escalated) return;
    setMessages(m => [...m, { role: "user", text }]);
    setInput("");
    setSending(true);
    try {
      const res: BotAskResponse = await apiFetch("/api/help/ask", {
        method: "POST",
        body: JSON.stringify({
          message: text,
          already_shown_faq_ids: Array.from(shownFaqIds.current),
        }),
      });
      res.suggestions.forEach(s => shownFaqIds.current.add(s.faq_id));
      setMessages(m => [
        ...m,
        { role: "bot", text: res.message, suggestions: res.suggestions, offerEscalate: !res.resolved },
      ]);
    } catch (e) {
      setMessages(m => [...m, { role: "bot", text: "Something went wrong. Let me connect you with support instead.", offerEscalate: true }]);
    } finally {
      setSending(false);
    }
  }

  async function escalate() {
    setSending(true);
    try {
      const transcript = messages
        .filter(m => m.role !== "system")
        .map(m => `${m.role === "user" ? "You" : "Bot"}: ${m.text}`)
        .join("\n");
      const lastUserMessage = [...messages].reverse().find(m => m.role === "user")?.text ?? "Need help";
      const shownQuestions = messages
        .flatMap(m => (m.role === "bot" && m.suggestions ? m.suggestions.map(s => s.question) : []));
      const ticket = await apiFetch("/api/help/escalate", {
        method: "POST",
        body: JSON.stringify({
          message: lastUserMessage,
          conversation_transcript: transcript,
          shown_faq_questions: shownQuestions,
        }),
      });
      setEscalated(true);
      setMessages(m => [
        ...m,
        { role: "system", text: `Connected you with our support team — ticket ${ticket.ticket_ref} has been raised. An agent will follow up shortly.` },
      ]);
    } catch (e) {
      setMessages(m => [...m, { role: "system", text: "Couldn't raise a ticket right now — please try again." }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border border-border rounded-xl flex flex-col h-[420px] bg-background overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto nc-scroll px-4 py-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "system" ? (
              <div className="mx-auto text-[11.5px] text-muted-foreground bg-muted/60 rounded-full px-3 py-1.5 inline-flex items-center gap-1.5">
                <Headset className="h-3 w-3" /> {m.text}
              </div>
            ) : (
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                m.role === "user" ? "bg-primary text-white rounded-br-sm" : "bg-secondary text-foreground rounded-bl-sm"
              }`}>
                <div className="flex items-center gap-1.5 mb-1 opacity-70 text-[10.5px] font-medium uppercase tracking-wide">
                  {m.role === "user" ? <UserIcon className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                  {m.role === "user" ? "You" : "Help Bot"}
                </div>
                <div>{m.text}</div>
                {m.role === "bot" && m.suggestions && m.suggestions.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {m.suggestions.map(s => (
                      <div key={s.faq_id} className="bg-background/70 rounded-lg px-3 py-2 border border-border/60">
                        <div className="font-medium text-[12.5px]">{s.question}</div>
                        <div className="text-[12px] text-muted-foreground mt-0.5">{s.answer}</div>
                      </div>
                    ))}
                  </div>
                )}
                {m.role === "bot" && m.offerEscalate && !escalated && (
                  <button
                    onClick={escalate}
                    disabled={sending}
                    className="mt-2.5 inline-flex items-center gap-1.5 text-[12px] font-medium text-primary hover:underline disabled:opacity-50"
                  >
                    <Headset className="h-3.5 w-3.5" /> None of this helped — connect me to an agent
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <form
        onSubmit={e => { e.preventDefault(); sendMessage(input); }}
        className="flex items-center gap-2 border-t border-border px-3 py-2.5"
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={sending || escalated}
          placeholder={escalated ? "Ticket raised — an agent will follow up" : "Type your question…"}
          className="flex-1 text-[13px] bg-transparent outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={sending || escalated || !input.trim()}
          className="h-8 w-8 rounded-full bg-primary text-white grid place-items-center disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}
