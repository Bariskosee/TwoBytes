import type { DensityBand, ReportStatus } from "@/api/contract";

export const statusLabels: Record<ReportStatus, string> = {
  in_review: "İncelemede",
  measure_planned: "Önlem planlandı",
  completed: "Tamamlandı",
};

export const bandInfo: Record<DensityBand, { label: string; fill: number }> = {
  "5-9": { label: "5–9 bildirim", fill: 1 / 3 },
  "10-19": { label: "10–19 bildirim", fill: 2 / 3 },
  "20+": { label: "20 ve üzeri bildirim", fill: 1 },
  insufficient_data: { label: "Yetersiz veri", fill: 0 },
};

/** "2026-11-16" -> "16.11.2026". */
export function formatDay(day: string): string {
  const [year, month, date] = day.split("-");
  return year && month && date ? `${date}.${month}.${year}` : day;
}

/** ISO zamanını İstanbul saatiyle gün olarak gösterir. */
export function formatInstant(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });
}
