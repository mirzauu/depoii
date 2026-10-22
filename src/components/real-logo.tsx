"use client";

import { useState } from "react";

interface RealLogoProps {
  url?: string | null;
  alt?: string;
  size?: number;
  className?: string;
  fallback?: React.ReactNode;
}

/**
 * Renders an authentic company logo ONLY if it is available and loads successfully.
 * Adheres strictly to the user requirement: "dont makeup any give only the real logo if available".
 * If url is null/empty or if image loading fails/404s, it renders fallback (or null).
 */
export function RealLogo({
  url,
  alt = "",
  size = 20,
  className = "",
  fallback = null,
}: RealLogoProps) {
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    return <>{fallback}</>;
  }

  return (
    <img
      src={url}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`shrink-0 rounded bg-white/10 object-contain p-0.5 border border-border/40 ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  );
}
