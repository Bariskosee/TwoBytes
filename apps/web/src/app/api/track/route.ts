import { NextResponse, type NextRequest } from "next/server";
import type { TrackResponse } from "@/lib/contract";
import { apiError } from "@/lib/http";
import { SAMPLE_HEADERS, sampleTrackCompleted, sampleTrackPlanned } from "@/lib/samples";
import { normalizeTrackingCode } from "@/lib/tracking";

// TODO(saat 2–10): kod özetini tracking_codes'ta ara, hız sınırı uygula.
// Örnek mod: geçerli biçimdeki kod "…0" ile bitiyorsa tamamlanmış, aksi halde
// planlanmış önlem döner. Mobil ekranlar iki durumu da deneyebilir.
export async function POST(request: NextRequest) {
  let code: string | null = null;
  try {
    const body = (await request.json()) as { trackingCode?: unknown };
    if (typeof body.trackingCode === "string") code = normalizeTrackingCode(body.trackingCode);
  } catch {
    // Geçersiz gövde de genel hata alır.
  }
  if (!code) return apiError(404, "invalid_code", "Takip kodu bulunamadı.");

  const sample = code.endsWith("0") ? sampleTrackCompleted : sampleTrackPlanned;
  return NextResponse.json<TrackResponse>(sample, { headers: SAMPLE_HEADERS });
}
