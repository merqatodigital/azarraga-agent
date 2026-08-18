import { useState, type ImgHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

interface SafeImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  fallbackClassName?: string;
  fallbackLabel?: string;
}

/**
 * <img> that never shows a broken-image icon. If the source fails to load
 * (missing asset, blocked network, bad build path) it swaps to a branded
 * placeholder tile instead of the browser's default broken-image glyph.
 */
export function SafeImage({ fallbackClassName, fallbackLabel, className, alt, ...props }: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-gradient-to-br from-brand-600 to-navy-900 text-[11px] font-bold uppercase text-white",
          className,
          fallbackClassName,
        )}
        aria-label={alt}
        title={alt}
      >
        {fallbackLabel ?? (alt ? alt.slice(0, 2).toUpperCase() : "AG")}
      </div>
    );
  }

  return <img {...props} alt={alt} className={className} onError={() => setFailed(true)} />;
}
