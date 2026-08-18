import talaAvatar from "@/assets/tala-avatar.png";
import { SafeImage } from "@/components/SafeImage";
import { cn } from "@/utils/cn";
import type { TalaMood } from "@/agent/types";

const MOOD_RING: Record<TalaMood, string> = {
  idle: "ring-brand-100",
  listening: "ring-[#93c5fd]/70",
  processing: "ring-[#fde68a]/70",
  analyzing: "ring-[#c4b5fd]/70",
  happy: "ring-[#86efac]/70",
  confused: "ring-[#fdba74]/70",
  busy: "ring-[#fca5a5]/70",
  speaking: "ring-[#93c5fd]/70",
};

const MOOD_DOT: Record<TalaMood, string> = {
  idle: "bg-brand-400",
  listening: "bg-sky-400",
  processing: "bg-amber-400",
  analyzing: "bg-violet-400",
  happy: "bg-emerald-400",
  confused: "bg-orange-400",
  busy: "bg-rose-400",
  speaking: "bg-sky-400",
};

/**
 * TALA's face — the generated portrait avatar with a mood-tinted ring and a
 * status dot, replacing the plain emoji circle used elsewhere in the app.
 */
export function TalaAvatarImage({
  mood = "idle",
  size = 40,
  pulse = false,
  className,
}: {
  mood?: TalaMood;
  size?: number;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <SafeImage
        src={talaAvatar}
        alt="TALA"
        fallbackLabel="T"
        className={cn(
          "h-full w-full rounded-full object-cover ring-2 transition-all duration-300",
          MOOD_RING[mood],
          pulse && "animate-[talaPulse_1.4s_ease-in-out_infinite]",
        )}
        fallbackClassName="rounded-full ring-2"
        style={{ background: "linear-gradient(135deg,#0b2138,#1668c9)" }}
      />
      <span
        className={cn(
          "absolute bottom-0 right-0 block rounded-full ring-2 ring-white dark:ring-surface",
          MOOD_DOT[mood],
        )}
        style={{ width: Math.max(8, size * 0.24), height: Math.max(8, size * 0.24) }}
      />
      {pulse && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-ping rounded-full bg-emerald-400" />}
      <style>{`@keyframes talaPulse { 0%,100% { transform: scale(1)} 50% { transform: scale(1.05)} }`}</style>
    </div>
  );
}
