export type TdiStatus = "open" | "urgent" | "closed";

export interface TdiWindow {
  deadline: string;
  daysRemaining: number;
  status: TdiStatus;
}

export const TDI_WINDOW_MONTHS = 24;
const DAY = 86_400_000;

export function tdiWindow(stormDate: string, now: Date = new Date()): TdiWindow {
  const d = new Date(`${stormDate}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + TDI_WINDOW_MONTHS);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysRemaining = Math.round((d.getTime() - today) / DAY);
  return {
    deadline: d.toISOString().slice(0, 10),
    daysRemaining,
    status: daysRemaining < 0 ? "closed" : daysRemaining <= 180 ? "urgent" : "open",
  };
}
