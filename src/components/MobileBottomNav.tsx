import { FileSpreadsheet, FolderOpen, LayoutDashboard, ReceiptText, UserRoundSearch } from "lucide-react";
import { cn } from "@/utils/cn";
import type { PageKey } from "./Shell";

const MOBILE_NAV: Array<{ key: PageKey; label: string; icon: typeof LayoutDashboard }> = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "leads", label: "Leads", icon: UserRoundSearch },
  { key: "quotes", label: "Quotes", icon: FileSpreadsheet },
  { key: "invoices", label: "Invoices", icon: ReceiptText },
  { key: "documents", label: "Docs", icon: FolderOpen },
];

export function MobileBottomNav({
  page,
  onNavigate,
}: {
  page: PageKey;
  onNavigate: (p: PageKey) => void;
}) {
  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-line bg-surface/95 px-2 py-2 backdrop-blur-md md:hidden"
    >
      {MOBILE_NAV.map(({ key, label, icon: Icon }) => {
        const active = page === key;
        return (
          <button
            key={key}
            onClick={() => onNavigate(key)}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 rounded-lg py-1.5 transition-colors",
              active ? "font-bold text-brand-600 dark:text-brand-500" : "text-fg-400 hover:text-fg-900",
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.7} />
            <span className="text-[10.5px] tracking-tight">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
