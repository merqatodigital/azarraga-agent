import { useEffect, useMemo, useRef, useState } from "react";
import {
  CircleDollarSign,
  ClipboardList,
  ListChecks,
  Mail,
  Send,
  Users,
  X,
  FolderSearch,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { OPENROUTER_MODELS } from "@/agent/seed";
import { QUICK_ACTION_PROMPTS, TALA_TYPING_STATUSES, type QuickActionKey } from "@/agent/runtime";
import { TalaAvatarImage } from "@/components/TalaAvatarImage";
import type { AzarragaState, ChatMessage, TalaMood, QuickReply } from "@/agent/types";

const QUICK_ACTIONS: Array<{
  key: QuickActionKey;
  label: string;
  hint: string;
  icon: typeof ListChecks;
}> = [
  { key: "leads", label: "Leads", hint: "Rank next actions", icon: ListChecks },
  { key: "email", label: "Email follow-ups", hint: "Draft messages", icon: Mail },
  { key: "customers", label: "Customer accounts", hint: "Review customer status", icon: Users },
  { key: "money", label: "Money owed", hint: "Prioritize collections", icon: CircleDollarSign },
  { key: "documents", label: "Documents", hint: "Review learned files", icon: FolderSearch },
  { key: "pricing", label: "PO & pricing", hint: "Trace source evidence", icon: ClipboardList },
];

const MOOD_META: Record<TalaMood, { emoji: string; bg: string; ring: string; label: string }> = {
  idle: { emoji: "🤖", bg: "bg-brand-100", ring: "ring-brand-100", label: "Idle — waiting po" },
  listening: { emoji: "👂", bg: "bg-[#dbeafe] dark:bg-[#1e3a8a]/30", ring: "ring-[#93c5fd]/60", label: "Listening..." },
  processing: { emoji: "🤔", bg: "bg-[#fef9c3] dark:bg-[#78350f]/40", ring: "ring-[#fde68a]/60", label: "Thinking..." },
  analyzing: { emoji: "🔍", bg: "bg-[#ede9fe] dark:bg-[#4c1d95]/30", ring: "ring-[#c4b5fd]/60", label: "Analyzing photos..." },
  happy: { emoji: "😊", bg: "bg-[#dcfce7] dark:bg-[#14532d]/40", ring: "ring-[#86efac]/60", label: "Happy — done po!" },
  confused: { emoji: "🤨", bg: "bg-[#ffedd5] dark:bg-[#7c2d12]/40", ring: "ring-[#fdba74]/60", label: "Ay, confusing po..." },
  busy: { emoji: "🏃", bg: "bg-[#fee2e2] dark:bg-[#7f1d1d]/40", ring: "ring-[#fca5a5]/60", label: "Busy po, wait lang!" },
  speaking: { emoji: "🗣️", bg: "bg-[#dbeafe] dark:bg-[#1e3a8a]/30", ring: "ring-[#93c5fd]/60", label: "Speaking..." },
};

function LinkifiedText({ text }: { text: string }) {
  const pattern = /(https?:\/\/[^\s)]+|www\.[^\s)]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:\+?\d[\d\s().-]{7,}\d))/gi;
  const parts = text.split(pattern).filter(Boolean);
  return (
    <>
      {parts.map((part, i) => {
        if (/^https?:\/\//i.test(part) || /^www\./i.test(part)) {
          const href = part.startsWith("www.") ? `https://${part}` : part;
          return (
            <a key={i} href={href} target="_blank" rel="noreferrer" className="font-semibold text-brand-600 underline-offset-2 hover:underline">
              {part}
            </a>
          );
        }
        if (/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(part)) {
          return (
            <a key={i} href={`mailto:${part}`} className="font-semibold text-brand-600 underline-offset-2 hover:underline">
              {part}
            </a>
          );
        }
        const digits = part.replace(/\D/g, "");
        if (digits.length >= 8) {
          return (
            <a key={i} href={`tel:${digits}`} className="font-semibold text-brand-600 underline-offset-2 hover:underline">
              {part}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**"))
          return (
            <strong key={i} className="font-bold text-fg-900">
              {part.slice(2, -2)}
            </strong>
          );
        if (part.startsWith("`") && part.endsWith("`"))
          return (
            <code key={i} className="rounded bg-black/[0.07] px-1 py-[1px] font-mono text-[11.5px] dark:bg-white/10">
              {part.slice(1, -1)}
            </code>
          );
        if (part.startsWith("*") && part.endsWith("*") && part.length > 2)
          return (
            <em key={i} className="italic">
              {part.slice(1, -1)}
            </em>
          );
        return <LinkifiedText key={i} text={part} />;
      })}
    </>
  );
}

function MessageBody({ content }: { content: string }) {
  return (
    <div className="space-y-[4px]">
      {content.split("\n").map((line, i) =>
        line.trim() === "" ? (
          <div key={i} className="h-2" />
        ) : (
          <p key={i} className="leading-[1.55]">
            <Inline text={line} />
          </p>
        ),
      )}
    </div>
  );
}

function TypingIndicator({ statusText }: { statusText: string }) {
  return (
    <div className="flex items-center gap-2.5 px-1 py-1">
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-[7px] w-[7px] animate-bounce rounded-full bg-brand-500"
            style={{ animationDelay: `${i * 150}ms`, animationDuration: "0.9s" }}
          />
        ))}
      </span>
      <span className="animate-pulse text-[12px] font-medium text-brand-600">{statusText}</span>
    </div>
  );
}

function QuickReplyRow({
  replies,
  onPick,
}: {
  replies: QuickReply[];
  onPick: (prompt: string) => void;
}) {
  if (!replies?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {replies.slice(0, 4).map((r, i) => (
        <button
          key={i}
          onClick={() => onPick(r.prompt)}
          className="rounded-full border border-line-strong bg-surface px-3 py-1 text-[11.5px] font-semibold text-brand-700 shadow-sm transition-all hover:border-brand-600 hover:bg-brand-600 hover:text-white hover:shadow-md active:scale-95"
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

export function AgentPanel({
  state,
  connected,
  onClose,
  onSend,
  onModelChange,
}: {
  state: AzarragaState;
  connected: boolean;
  onClose: () => void;
  onSend: (prompt: string) => void;
  onModelChange: (model: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [typingIndex, setTypingIndex] = useState(0);
  const [showConfig, setShowConfig] = useState(false);
  const [fullView, setFullView] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  const messages = useMemo(() => state.messages, [state.messages]);
  const isStreaming = useMemo(() => messages.some((m) => m.streaming), [messages]);
  const lastAssistant = useMemo(() => [...messages].reverse().find((m) => m.role === "assistant"), [messages]);

  const headerMood: TalaMood = (() => {
    if (isStreaming) return lastAssistant?.mood ?? "processing";
    if (draft.trim().length > 2) return "listening";
    if (lastAssistant?.mood) return lastAssistant.mood;
    if (!messages.length) return "idle";
    return "idle";
  })();

  useEffect(() => {
    if (!isStreaming) return;
    const id = window.setInterval(() => setTypingIndex((i) => (i + 1) % TALA_TYPING_STATUSES.length), 1200);
    return () => window.clearInterval(id);
  }, [isStreaming]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typingIndex]);

  const submit = (value: string) => {
    const text = value.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
  };

  return (
    <aside
      className={cn(
        "flex flex-col border-l border-line bg-surface transition-all duration-200",
        fullView ? "fixed inset-4 z-50 rounded-2xl shadow-2xl lg:inset-x-20 lg:inset-y-10" : "h-full w-full",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 pt-4 pb-3.5 sm:px-5 sm:pt-4 sm:pb-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <TalaAvatarImage mood={headerMood} size={42} pulse={connected && headerMood !== "idle"} />
          <div className="min-w-0">
            <p className="font-display flex items-center gap-1.5 text-[15.5px] font-bold leading-tight tracking-[-0.01em] text-fg-900 sm:text-[17px]">
              Azarraga Agent
              <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-brand-700">
                TALA
              </span>
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[12px] font-medium sm:text-[12.5px]">
              <span className={cn("inline-block h-[7px] w-[7px] shrink-0 rounded-full", connected ? "bg-emerald-500" : "bg-amber-400")} />
              <span className={cn("truncate", connected ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                {connected ? "Connected • Palawan ops" : "Connecting…"}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowConfig((v) => !v)}
            title="Toggle configuration & quick actions"
            aria-label="Toggle configuration"
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors",
              showConfig ? "bg-brand-100 text-brand-700" : "text-fg-500 hover:bg-surface-hover hover:text-fg-900",
            )}
          >
            <SlidersHorizontal className="h-4 w-4" strokeWidth={2} />
          </button>
          <button
            onClick={() => setFullView((v) => !v)}
            title={fullView ? "Exit full view" : "Expand full view"}
            aria-label={fullView ? "Exit full view" : "Expand full view"}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-500 transition-colors hover:bg-surface-hover hover:text-fg-900"
          >
            {fullView ? <Minimize2 className="h-4 w-4" strokeWidth={2} /> : <Maximize2 className="h-4 w-4" strokeWidth={2} />}
          </button>
          <button
            onClick={onClose}
            aria-label="Close agent panel"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-500 transition-colors hover:bg-surface-hover hover:text-fg-900"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Collapsible Config & Quick Actions (keeps 85% of panel height free for data output when collapsed) */}
      {showConfig && (
        <div className="fade-up border-b border-line bg-surface-2 px-4 py-3.5 sm:px-5">
          <div className="rounded-xl border border-line-strong bg-gradient-to-br from-brand-100 to-surface px-4 py-3">
            <p className="flex items-center gap-2 text-[13px] font-black tracking-[0.08em] text-fg-900">
              TALA{" "}
              <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] font-normal normal-case tracking-normal text-fg-700">
                {headerMood} • {MOOD_META[headerMood].emoji}
              </span>
            </p>
            <p className="mt-1 text-[12.5px] leading-[1.45] text-fg-700">
              Your commercial teammate at Azarraga. Professional, warm, speaks Taglish with po/opo.
            </p>
          </div>

          <p className="pb-1.5 pt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-fg-400">
            OpenRouter model
          </p>
          <select
            value={state.model}
            onChange={(e) => onModelChange(e.target.value)}
            className="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-[13px] text-fg-900 outline-none focus:border-brand-500"
          >
            {OPENROUTER_MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <p className="pb-1.5 pt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-fg-400">
            Quick actions
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {QUICK_ACTIONS.map(({ key, label, hint, icon: Icon }) => (
              <button
                key={key}
                onClick={() => {
                  submit(QUICK_ACTION_PROMPTS[key]);
                  setShowConfig(false);
                }}
                className="group rounded-lg border border-line bg-surface px-2.5 py-2 text-left transition-all hover:border-brand-500/60 hover:bg-brand-100/40"
              >
                <span className="flex items-center gap-1.5 text-[12px] font-bold text-fg-900 group-hover:text-brand-700">
                  <Icon className="h-[13px] w-[13px] text-brand-500" strokeWidth={2.1} />
                  {label}
                </span>
                <span className="mt-0.5 block truncate text-[10.5px] text-fg-400">{hint}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages — maximum vertical transparency for data output */}
      <div ref={scroller} className="thin-scroll flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
        {messages.map((m: ChatMessage) => {
          const mood: TalaMood = (m.mood as TalaMood) ?? (m.role === "assistant" ? "idle" : "speaking");
          const isAssistant = m.role === "assistant";
          return (
            <div key={m.id} className={cn("flex max-w-[96%] gap-2.5 fade-up", isAssistant ? "" : "ml-auto flex-row-reverse")}>
              {isAssistant && (
                <div className="shrink-0 pt-0.5">
                  <TalaAvatarImage mood={mood} size={28} pulse={!!m.streaming} />
                </div>
              )}
              <div className="flex-1 space-y-1">
                <div
                  className={cn(
                    "rounded-2xl border px-4 py-3 text-[13.5px] shadow-sm transition-all",
                    isAssistant
                      ? "rounded-tl-md border-line-strong bg-surface-2 text-fg-900"
                      : "rounded-tr-md border-[#0f2c4a] bg-[#0f2c4a] text-white",
                  )}
                >
                  {m.streaming && !m.content ? (
                    <TypingIndicator statusText={TALA_TYPING_STATUSES[typingIndex]} />
                  ) : (
                    <>
                      {m.streaming && m.content.length < 10 && (
                        <div className="mb-1">
                          <TypingIndicator statusText={TALA_TYPING_STATUSES[typingIndex]} />
                        </div>
                      )}
                      <MessageBody content={m.content} />
                      {m.streaming && m.content && (
                        <span className="ml-1 inline-block h-3 w-[2px] translate-y-[1px] animate-pulse bg-brand-500" />
                      )}
                    </>
                  )}
                </div>
                {isAssistant && !m.streaming && m.quickReplies && m.quickReplies.length > 0 && (
                  <QuickReplyRow replies={m.quickReplies} onPick={submit} />
                )}
              </div>
            </div>
          );
        })}

        {isStreaming && messages[messages.length - 1]?.role === "user" && (
          <div className="flex items-center gap-2.5">
            <TalaAvatarImage mood="processing" size={28} pulse />
            <div className="rounded-2xl rounded-tl-md border border-line-strong bg-surface-2 px-4 py-3">
              <TypingIndicator statusText={TALA_TYPING_STATUSES[typingIndex]} />
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-line bg-surface-2 px-4 py-3.5 sm:px-5 sm:py-4">
        {draft.length > 0 && (
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-brand-600">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-brand-500" />
            TALA is listening po — {draft.length} chars...
          </p>
        )}
        <div className="flex items-end gap-3">
          <div className="relative flex-1">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit(draft);
                }
              }}
              rows={2}
              placeholder="Ask TALA... (Taglish okay po!)"
              className="thin-scroll min-h-[64px] w-full resize-none rounded-xl border border-line-strong bg-surface px-4 py-3 pr-3 text-[14px] text-fg-900 outline-none placeholder:text-fg-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
            />
          </div>
          <button
            onClick={() => submit(draft)}
            disabled={!draft.trim()}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white shadow-[0_4px_12px_rgba(22,104,201,0.3)] transition-all hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-[0_6px_16px_rgba(22,104,201,0.4)] disabled:translate-y-0 disabled:opacity-40 disabled:shadow-none"
          >
            <Send className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-fg-400">
          TALA remembers everything • Click sliders icon above to toggle quick actions
        </p>
      </div>
    </aside>
  );
}
