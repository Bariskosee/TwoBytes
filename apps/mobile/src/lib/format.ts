import type { DensityBand, ReportStatus } from "@/api/contract";

export const statusLabels: Record<ReportStatus, string> = {
  in_review: "İncelemede",
  measure_planned: "Önlem planlandı",
  completed: "Tamamlandı",
};

/** `label` tam metindir, `short` haritadaki küçük etiket içindir. */
export const bandInfo: Record<DensityBand, { label: string; short: string; fill: number }> = {
  "5-9": { label: "5–9 bildirim", short: "5–9", fill: 1 / 3 },
  "10-19": { label: "10–19 bildirim", short: "10–19", fill: 2 / 3 },
  "20+": { label: "20 ve üzeri bildirim", short: "20+", fill: 1 },
  insufficient_data: { label: "Yetersiz veri", short: "Yetersiz veri", fill: 0 },
};

/** Takip durumunun sırası. Durum izi bu sırayla çizilir. */
export const statusOrder: ReportStatus[] = ["in_review", "measure_planned", "completed"];

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
