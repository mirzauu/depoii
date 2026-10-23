import { cn } from "cn";

const ARMS = 7;
const STEPS = 5;

export interface SpiralBlock {
  key: string;
  step: number;
  x: number;
  y: number;
  w: number;
  h: number;
  angle: number;
}

export const SPIRAL_BLOCKS: SpiralBlock[] = Array.from({ length: ARMS * STEPS }, (_, i) => {
  const arm = i % ARMS;
  const step = Math.floor(i / ARMS);
  const r = 13 + step * 7.4;
  const angle = (arm * 360) / ARMS + step * 21;
  const rad = (angle * Math.PI) / 180;
  return {
    key: `${arm}-${step}`,
    step,
    x: +(Math.cos(rad) * r).toFixed(2),
    y: +(Math.sin(rad) * r).toFixed(2),
    w: +(5.2 + step * 2.3).toFixed(2),
    h: +(4.4 + step * 0.9).toFixed(2),
    angle: +(angle + 90).toFixed(1),
  };
});

export function spiralSvg(fill: string = "#ffffff", background?: string) {
  const bg = background ? `<rect x="-50" y="-50" width="100" height="100" rx="22" fill="${background}"/>` : "";
  const blocks = SPIRAL_BLOCKS.map((b) => `<rect x="${-b.w / 2}" y="${-b.h / 2}" width="${b.w}" height="${b.h}" rx="0.6" transform="translate(${b.x} ${b.y}) rotate(${b.angle})"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100">${bg}<g fill="${fill}">${blocks}</g></svg>`;
}

export function DepoiiMark({ className, animated = false, title = "Depoii" }: { className?: string; animated?: boolean; title?: string }) {
  return (
    <svg viewBox="-50 -50 100 100" role="img" aria-label={title} className={cn("shrink-0 text-foreground", animated && "depoii-spin", className)}>
      <g fill="currentColor">
        {SPIRAL_BLOCKS.map((b) => (
          <rect
            key={b.key}
            x={-b.w / 2}
            y={-b.h / 2}
            width={b.w}
            height={b.h}
            rx={0.6}
            transform={`translate(${b.x} ${b.y}) rotate(${b.angle})`}
            className={animated ? "depoii-block" : undefined}
            style={animated ? { animationDelay: `${b.step * 140}ms` } : undefined}
          />
        ))}
      </g>
    </svg>
  );
}

export function DepoiiAiMark({ className, title = "Depoii AI" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="-50 -50 100 100" role="img" aria-label={title} className={cn("shrink-0", className)}>
      <g fill="currentColor">
        {/* Altered Depoii spiral vortex tiles (outer vortex arms) */}
        {SPIRAL_BLOCKS.filter((b) => b.step >= 1).map((b) => (
          <rect
            key={b.key}
            x={-b.w / 2}
            y={-b.h / 2}
            width={b.w}
            height={b.h}
            rx={0.6}
            transform={`translate(${b.x} ${b.y}) rotate(${b.angle})`}
          />
        ))}
        {/* Central 4-point AI Star Core */}
        <path d="M0 -16 C0 -4 4 0 16 0 C4 0 0 4 0 16 C0 4 -4 0 -16 0 C-4 0 0 -4 0 -16 Z" />
        <circle cx="0" cy="0" r="2.8" fill="var(--background, #0c0c0e)" />
      </g>
    </svg>
  );
}

export function DepoiiLogo({ className, collapsed = false }: { className?: string; collapsed?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <DepoiiMark className="size-8 text-foreground" />
      {!collapsed && <span className="text-xl font-bold tracking-tight">Depoii</span>}
    </span>
  );
}

export function DepoiiLoader({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-3 text-sm text-muted-foreground", className)} role="status">
      <DepoiiMark animated className="size-12 text-foreground" title={label || "Loading"} />
      {label && <p>{label}</p>}
    </div>
  );
}
