import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/utils/cn";

interface CityClockConfig {
  code: string;
  city: string;
  timeZone: string;
}

const CITIES: CityClockConfig[] = [
  { code: "MNL", city: "Manila", timeZone: "Asia/Manila" },
  { code: "HOU", city: "Houston", timeZone: "America/Chicago" },
];

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function formatParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
    dayPeriod: get("dayPeriod").toUpperCase(),
  };
}

function CityDigitalClock({ config, now, compact }: { config: CityClockConfig; now: Date; compact?: boolean }) {
  const { hour, minute, second, dayPeriod } = formatParts(now, config.timeZone);
  return (
    <div className="flex items-center gap-1.5" title={`${config.city} time`}>
      <span className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-fg-400">{config.code}</span>
      <div className="clock-digits flex items-baseline gap-[1px] rounded-md bg-surface-2 px-1.5 py-1 text-[12px] font-semibold text-fg-900 sm:px-2 sm:text-[13px]">
        <span>{hour}</span>
        <span className="clock-colon">:</span>
        <span>{minute}</span>
        {!compact && (
          <>
            <span className="clock-colon">:</span>
            <span>{second}</span>
          </>
        )}
        <span className="ml-1 text-[9.5px] font-bold text-brand-600">{dayPeriod}</span>
      </div>
    </div>
  );
}

export function WorldClock({ className, compact = false }: { className?: string; compact?: boolean }) {
  const now = useNow(1000);

  const dateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(now);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2.5 rounded-xl border border-line bg-surface px-2.5 py-1.5 shadow-[0_1px_2px_rgba(16,40,70,0.04)] sm:gap-3 sm:px-3",
        className,
      )}
    >
      {!compact && (
        <div className="hidden items-center gap-1.5 border-r border-line pr-3 sm:flex">
          <CalendarDays className="h-[14px] w-[14px] text-fg-400" strokeWidth={2} />
          <span className="text-[12.5px] font-semibold text-fg-700">{dateLabel}</span>
        </div>
      )}
      <CityDigitalClock config={CITIES[0]} now={now} compact={compact} />
      <div className="h-5 w-px bg-line sm:h-6" />
      <CityDigitalClock config={CITIES[1]} now={now} compact={compact} />
    </div>
  );
}
