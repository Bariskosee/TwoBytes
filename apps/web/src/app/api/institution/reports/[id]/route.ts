import { NextResponse } from "next/server";
import type { InstitutionReportResponse } from "@/lib/institution-contract";
import { readInstitutionReport, reportNotFound, UUID_RE } from "@/lib/institution-reports";
import { institutionClient } from "@/lib/supabase/institution";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await institutionClient();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  if (!UUID_RE.test(id)) return reportNotFound();
  const result = await readInstitutionReport(auth.client, id);
  if (result.error) return result.error;

  return NextResponse.json<InstitutionReportResponse>(
    result,
    { headers: { "Cache-Control": "no-store" } },
  );
}
