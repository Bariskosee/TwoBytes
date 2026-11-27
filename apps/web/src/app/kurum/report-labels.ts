import type { PlaceType, ReportStatus } from "@/lib/contract";

export const placeLabels: Record<PlaceType, string> = {
  transit_stop: "Durak",
  street: "Sokak",
  other: "Diğer",
};

export const statusLabels: Record<ReportStatus, string> = {
  in_review: "İncelemede",
  measure_planned: "Önlem planlandı",
  completed: "Tamamlandı",
};

const dateTime = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  dateStyle: "medium",
  timeStyle: "short",
});

const date = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  dateStyle: "medium",
});

export function formatDateTime(value: string) {
  return dateTime.format(new Date(value));
}

export function formatDate(value: string) {
  return date.format(new Date(`${value}T12:00:00Z`));
}
