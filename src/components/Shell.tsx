import type { ReactNode } from "react";
import {
  FileSpreadsheet,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  FilePlus2,
  ReceiptText,
  RefreshCw,
  Sparkles,
  UserRoundSearch,
} from "lucide-react";
import { cn } from "@/utils/cn";
import azarragaIcon from "@/assets/azarraga-icon.png";
import { SafeImage } from "@/components/SafeImage";
import { ThemeToggle } from "@/components/ThemeToggle";
import { WorldClock } from "@/components/WorldClock";
import { TalaAvatarImage } from "@/components/TalaAvatarImage";

export type PageKey = "overview" | "leads" | "quotes" | "invoices" | "documents";

export const NAV: Array<{ key: PageKey; label: string; icon: typeof LayoutDashboard }> = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "leads", label: "Leads", icon: UserRoundSearch },
  { key: "quotes", label: "Quotes", icon: FileSpreadsheet },
  { key: "invoices", label: "Invoices", icon: ReceiptText },
  { key: "documents", label: "Documents", icon: FolderOpen },
];

export function Sidebar({
  page,
  onNavigate,
  open,
  onClose,
}: {
  page: PageKey;
  onNavigate: (p: PageKey) => void;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[248px] shrink-0 flex-col text-white transition-transform duration-200 lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
        style={{ backgroundImage: "linear-gradient(180deg,#0b2138 0%,#0a1e33 100%)" }}
      >
        <div className="flex items-center gap-3 px-6 pt-7 pb-6">
          <SafeImage
            src={azarragaIcon}
            alt="Azarraga"
            fallbackLabel="AG"
            className="h-11 w-11 shrink-0 rounded-lg bg-white object-contain p-1.5 shadow-sm"
            fallbackClassName="h-11 w-11 rounded-lg"
          />
          <div className="min-w-0 leading-tight">
            <h1 className="truncate text-[16.5px] font-bold tracking-[-0.01em] text-white">Azarraga Glass</h1>
            <p className="truncate text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate-400/80">
              &amp; Aluminum
            </p>
          </div>
        </div>
        <div className="mx-6 border-t border-white/10" />

        <p className="px-6 pt-6 pb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400/80">
          Commercial workspace
        </p>

        <nav className="flex flex-col gap-1 px-3">
          {NAV.map(({ key, label, icon: Icon }) => {
            const active = page === key;
            return (
              <button
                key={key}
                onClick={() => {
                  onNavigate(key);
                  onClose();
                }}
                className={cn(
                  "group flex h-11 items-center gap-3 rounded-lg px-4 text-[15px] transition-colors",
                  active
                    ? "bg-[#173a5e] font-semibold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
                    : "text-slate-300/90 hover:bg-white/[0.06] hover:text-white",
                )}
              >
                <Icon className="h-[18px] w-[18px] shrink-0 opacity-90" strokeWidth={1.9} />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto">
          <div className="mx-6 border-t border-white/10" />
          <div className="flex items-center gap-3 px-6 py-5">
            <TalaAvatarImage mood="happy" size={38} />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[13px] font-bold text-white">TALA — Azarraga Agent</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[12px] font-medium text-emerald-400">
                <span className="inline-block h-[6px] w-[6px] shrink-0 rounded-full bg-emerald-400" />
                Connected
              </p>
            </div>
          </div>
          <button className="flex w-full items-center gap-3 px-6 pb-7 text-[13px] text-slate-400 transition-colors hover:text-white">
            <LogOut className="h-[17px] w-[17px]" strokeWidth={1.8} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}

export function TopBar({
  crumb,
  title,
  onRefresh,
  onToggleAgent,
  onPrimaryAction,
  primaryActionLabel = "New quote",
  onOpenNav,
  navOpen,
  refreshing,
}: {
  crumb: string;
  title: string;
  onRefresh: () => void;
  onToggleAgent: () => void;
  onPrimaryAction: () => void;
  primaryActionLabel?: string;
  onOpenNav: () => void;
  navOpen: boolean;
  refreshing: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <WorldClock />
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            onClick={onOpenNav}
            className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-fg-900 lg:hidden"
            aria-label={navOpen ? "Close navigation" : "Open navigation"}
          >
            {navOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
          </button>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-600">{crumb}</p>
            <h2 className="font-display mt-2 text-[26px] font-bold leading-none tracking-[-0.02em] text-fg-900 sm:text-[30px]">
              {title}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            onClick={onRefresh}
            title="Resync Durable Object state"
            aria-label="Refresh workspace"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface text-fg-700 shadow-[0_1px_2px_rgba(16,40,70,0.05)] transition-colors hover:bg-surface-hover"
          >
            <RefreshCw className={cn("h-[17px] w-[17px]", refreshing && "animate-spin")} strokeWidth={2} />
          </button>
          <button
            onClick={onToggleAgent}
            className="flex h-10 items-center gap-2 rounded-lg border border-line bg-surface px-3.5 text-[14px] font-medium text-fg-700 shadow-[0_1px_2px_rgba(16,40,70,0.05)] transition-colors hover:bg-surface-hover sm:px-4 sm:text-[15px]"
          >
            <Sparkles className="h-[17px] w-[17px] text-brand-500" strokeWidth={2} />
            <span>Agent</span>
          </button>
          <button
            onClick={onPrimaryAction}
            className="flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-[14px] font-semibold text-white shadow-[0_2px_6px_rgba(22,104,201,0.28)] transition-colors hover:bg-brand-700 sm:px-5 sm:text-[15px]"
          >
            <FilePlus2 className="h-[18px] w-[18px]" strokeWidth={2.2} />
            <span>{primaryActionLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(16,40,70,0.04)] dark:shadow-none",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card className={cn("flex flex-col overflow-hidden", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-6 sm:py-[18px]">
        <h3 className="text-[15.5px] font-bold tracking-[-0.01em] text-fg-900 sm:text-[17px]">{title}</h3>
        {action}
      </div>
      <div className={cn("flex-1", bodyClassName)}>{children}</div>
    </Card>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon?: typeof LayoutDashboard;
}) {
  return (
    <Card className="px-4 py-4 sm:px-5 sm:py-[18px]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-fg-700 sm:text-[14px]">{label}</p>
        {Icon && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600 sm:h-8 sm:w-8">
            <Icon className="h-[14px] w-[14px] sm:h-[15px] sm:w-[15px]" strokeWidth={2} />
          </span>
        )}
      </div>
      <p className="mt-2 text-[22px] font-bold leading-none tracking-[-0.02em] text-fg-900 sm:text-[26px]">
        {value}
      </p>
      <p className="mt-2 text-[12px] text-fg-400 sm:mt-2.5 sm:text-[13px]">{hint}</p>
    </Card>
  );
}

export function Badge({
  tone = "slate",
  children,
  dot = false,
}: {
  tone?: "blue" | "slate" | "green" | "amber" | "red";
  children: ReactNode;
  dot?: boolean;
}) {
  const tones = {
    blue: "bg-brand-100 text-brand-700",
    slate: "bg-surface-2 text-fg-500",
    green: "bg-success-soft text-success",
    amber: "bg-warning-soft text-warning",
    red: "bg-danger-soft text-danger",
  } as const;
  const dots = {
    blue: "bg-brand-600",
    slate: "bg-fg-400",
    green: "bg-success",
    amber: "bg-warning",
    red: "bg-danger",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] whitespace-nowrap",
        tones[tone],
      )}
    >
      {dot && <span className={cn("h-[6px] w-[6px] rounded-full", dots[tone])} />}
      {children}
    </span>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  const renderChildren = () => {
    if (typeof children !== "string") return children;
    const pattern = /(https?:\/\/[^\s)]+|www\.[^\s)]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:\+?\d[\d\s().-]{7,}\d))/gi;
    return children.split(pattern).filter(Boolean).map((part, index) => {
      if (/^https?:\/\//i.test(part) || /^www\./i.test(part)) {
        const href = part.startsWith("www.") ? `https://${part}` : part;
        return <a key={index} href={href} target="_blank" rel="noreferrer" className="text-brand-600 underline-offset-2 hover:underline">{part}</a>;
      }
      if (/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(part)) {
        return <a key={index} href={`mailto:${part}`} className="text-brand-600 underline-offset-2 hover:underline">{part}</a>;
      }
      const digits = part.replace(/\D/g, "");
      if (digits.length >= 8) {
        return <a key={index} href={`tel:${digits}`} className="text-brand-600 underline-offset-2 hover:underline">{part}</a>;
      }
      return <span key={index}>{part}</span>;
    });
  };
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-fg-400">{label}</p>
      <div className="mt-1.5 text-[13px] leading-snug text-fg-900">{renderChildren()}</div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  text,
}: {
  icon?: ReactNode;
  title?: string;
  text: string;
}) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 px-6 py-12 text-center sm:min-h-[220px] sm:py-16">
      {icon && <div className="mb-1 text-3xl">{icon}</div>}
      {title && <p className="text-[15px] font-semibold text-fg-900">{title}</p>}
      <p className="max-w-[320px] text-[13.5px] leading-relaxed text-fg-400">{text}</p>
    </div>
  );
}

export const thCls =
  "whitespace-nowrap px-4 py-3 text-[11.5px] font-bold uppercase tracking-[0.05em] text-fg-500 first:pl-5 last:pr-5";
export const tdCls = "px-4 py-3.5 text-[13.5px] text-fg-900 first:pl-5 last:pr-5 align-middle";
