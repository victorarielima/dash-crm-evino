import type { PeriodId } from "./types";

export interface DateRange {
  start: Date; // 00:00:00.000 local
  end: Date; // 23:59:59.999 local (nunca além de "agora")
}

export interface Bucket {
  start: Date;
  end: Date;
  /** YYYY-MM-DD (dia inicial do bucket). */
  key: string;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
export function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export const PERIOD_LABELS: Record<PeriodId, string> = {
  year: "Este ano",
  "30d": "Últimos 30 dias",
  "15d": "Últimos 15 dias",
  "7d": "Últimos 7 dias",
  "2d": "Últimos 2 dias",
  today: "Hoje",
  custom: "Personalizado",
};

export function resolveRange(
  period: PeriodId,
  customStart?: string,
  customEnd?: string,
): DateRange {
  const now = new Date();
  const today = startOfDay(now);
  let start: Date;
  let end: Date = endOfDay(now);

  switch (period) {
    case "today":
      start = today;
      break;
    case "2d":
      start = addDays(today, -1);
      break;
    case "7d":
      start = addDays(today, -6);
      break;
    case "15d":
      start = addDays(today, -14);
      break;
    case "30d":
      start = addDays(today, -29);
      break;
    case "year":
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      break;
    case "custom": {
      start = customStart ? startOfDay(new Date(customStart + "T00:00:00")) : today;
      end = customEnd ? endOfDay(new Date(customEnd + "T00:00:00")) : endOfDay(now);
      if (end > endOfDay(now)) end = endOfDay(now);
      break;
    }
    default:
      start = today;
  }
  if (start > end) start = startOfDay(end);
  return { start, end };
}

export function dayCount(range: DateRange): number {
  const a = startOfDay(range.start).getTime();
  const b = startOfDay(range.end).getTime();
  return Math.floor((b - a) / 86400000) + 1;
}

/** Divide o range em buckets diários (<=45 dias) ou semanais (períodos longos). */
export function splitBuckets(range: DateRange): { granularity: "day" | "week"; buckets: Bucket[] } {
  const days = dayCount(range);
  const granularity: "day" | "week" = days <= 45 ? "day" : "week";
  const buckets: Bucket[] = [];
  const step = granularity === "day" ? 1 : 7;
  let cursor = startOfDay(range.start);
  const hardEnd = range.end;
  while (cursor <= hardEnd) {
    const bStart = cursor;
    let bEnd = endOfDay(addDays(cursor, step - 1));
    if (bEnd > hardEnd) bEnd = hardEnd;
    buckets.push({ start: bStart, end: bEnd, key: isoDay(bStart) });
    cursor = addDays(cursor, step);
  }
  return { granularity, buckets };
}

export const epochSec = (d: Date): number => Math.floor(d.getTime() / 1000);

const spHourFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  hour12: false,
});
/** Hora do dia (0–23) de um epoch em segundos, no fuso America/Sao_Paulo. */
export function hourOfEpoch(epochSeconds: number): number {
  const h = parseInt(spHourFmt.format(new Date(epochSeconds * 1000)), 10);
  return Number.isFinite(h) ? h % 24 : 0;
}

/** DD/MM/YYYY (formato do Architect). */
export function ddmmyyyy(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${m}/${d.getFullYear()}`;
}
