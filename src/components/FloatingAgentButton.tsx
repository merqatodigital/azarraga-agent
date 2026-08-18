import { BotMessageSquare, Sparkles } from "lucide-react";
import { cn } from "@/utils/cn";

export function FloatingAgentButton({
  onClick,
  latestSnippet,
  className,
}: {
  onClick: () => void;
  latestSnippet?: string;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "fixed right-4 bottom-20 z-40 flex items-center gap-2.5 rounded-full border border-line-strong bg-surface px-4 py-3 shadow-2xl transition-all hover:scale-105 hover:border-brand-500 hover:shadow-2xl md:hidden",
        className,
      )}
      title="Open TALA agent"
    >
      <span className="relative flex h-3 w-3 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
      </span>
      <BotMessageSquare className="h-5 w-5 text-brand-600 dark:text-brand-500" strokeWidth={2} />
      <span className="max-w-[170px] truncate text-[13px] font-semibold text-fg-900">
        {latestSnippet ? latestSnippet.slice(0, 36) + "..." : "TALA is ready"}
      </span>
      <Sparkles className="h-4 w-4 text-amber-500" />
    </button>
  );
}
