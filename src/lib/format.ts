export const usd = (n: number, compact = false) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? "compact" : "standard",
  }).format(n);

export const num = (n: number) => new Intl.NumberFormat("en-US").format(n);

export const pct = (n: number, digits = 0) => `${(n * 100).toFixed(digits)}%`;

export const longDate = (iso: string) => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return "";
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
};

export const shortDate = (iso: string) => {
  if (!iso) return "—";
  const dateStr = iso.length >= 10 ? iso.slice(0, 10) : iso;
  const d = new Date(`${dateStr}T12:00:00Z`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
};
