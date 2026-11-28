import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import type { InstitutionReportResponse } from "@/lib/institution-contract";
import {
  parseMeasureAction,
  readInstitutionReport,
  reportNotFound,
  updateInstitutionMeasure,
  UUID_RE,
} from "@/lib/institution-reports";
import { institutionClient } from "@/lib/supabase/institution";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await institutionClient();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  if (!UUID_RE.test(id)) return reportNotFound();
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return apiError(415, "invalid_request", "İstek JSON biçiminde olmalı.");
  }

  const input = parseMeasureAction(await request.json().catch(() => null));
  if (!input) return apiError(400, "invalid_request", "Önlem alanlarını kontrol edin.");

  const { error } = await updateInstitutionMeasure(auth.client, id, input);
  if (error) {
    switch (error.code) {
      case "P0002":
      case "42501":
        return reportNotFound();
      case "23505":
        return apiError(409, "conflict", "Bu bildirim bir önleme bağlandı.");
      case "23514":
      case "22007":
      case "22008":
        return apiError(400, "invalid_request", "Önlem alanlarını kontrol edin.");
      default:
        return apiError(503, "server_error", "Önlem işlemi şu anda tamamlanamadı.");
    }
  }

  const result = await readInstitutionReport(auth.client, id);
  if (result.error) return result.error;
  return NextResponse.json<InstitutionReportResponse>(
    result,
    { headers: { "Cache-Control": "no-store" } },
  );
}
