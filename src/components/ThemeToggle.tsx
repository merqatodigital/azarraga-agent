import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/theme/ThemeProvider";
import { cn } from "@/utils/cn";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-line bg-surface text-fg-700 shadow-[0_1px_2px_rgba(16,40,70,0.05)] transition-colors hover:bg-surface-hover",
        className,
      )}
    >
      {isDark ? (
        <Moon key="moon" className="theme-icon-enter h-[18px] w-[18px] text-brand-500" strokeWidth={2} />
      ) : (
        <Sun key="sun" className="theme-icon-enter h-[18px] w-[18px] text-amber-500" strokeWidth={2} />
      )}
    </button>
  );
}
