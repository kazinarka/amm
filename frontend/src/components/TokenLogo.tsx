"use client";

import { useMemo } from "react";

const FALLBACK_LOGO = "/token-fallback.svg";

interface TokenLogoProps {
  src?: string | null;
  alt: string;
  size: number;
  className?: string;
}

/**
 * Token logo image with automatic fallback.
 *
 * Zero React state — onError swaps the src directly on the DOM element,
 * avoiding any re-render. The `key` prop resets the element when `src` changes.
 */
export function TokenLogo({ src, alt, size, className }: TokenLogoProps) {
  const normalizedSrc = useMemo(() => {
    if (!src) return FALLBACK_LOGO;
    const value = src.trim();
    return value.length > 0 ? value : FALLBACK_LOGO;
  }, [src]);

  return (
    <img
      key={normalizedSrc}
      src={normalizedSrc}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className={className}
      onError={(e) => {
        const img = e.currentTarget;
        if (!img.src.endsWith(FALLBACK_LOGO)) {
          img.src = FALLBACK_LOGO;
        }
      }}
    />
  );
}
