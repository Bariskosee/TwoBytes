import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/http";
import type { InstitutionInboxResponse } from "@/lib/institution-contract";
import { INBOX_COLUMNS, reportSummary, UUID_RE, type InboxRow } from "@/lib/institution-reports";
import { institutionClient } from "@/lib/supabase/institution";

const PAGE_SIZE = 50;
const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

export async function GET(request: NextRequest) {
  const auth = await institutionClient();
  if (auth.error) return auth.error;

  let query = auth.client
    .from("institution_reports")
    .select(INBOX_COLUMNS)
    .order("submitted_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1);

  const cursor = request.nextUrl.searchParams.get("cursor");
  if (cursor !== null) {
    const [submittedAt, id, extra] = cursor.split("|");
    if (extra !== undefined || !TIMESTAMP_RE.test(submittedAt) ||
      Number.isNaN(Date.parse(submittedAt)) || !id || !UUID_RE.test(id)) {
      return apiError(400, "invalid_request", "Bildirim sayfası geçersiz.");
    }
    query = query.or(`submitted_at.lt.${submittedAt},and(submitted_at.eq.${submittedAt},id.lt.${id})`);
  }

  const { data, error } = await query
    .overrideTypes<InboxRow[], { merge: false }>();
  if (error) return apiError(503, "server_error", "Gelen kutusu yüklenemedi.");

  const page = data.slice(0, PAGE_SIZE);
  const last = page.at(-1);
  return NextResponse.json<InstitutionInboxResponse>(
    {
      reports: page.map(reportSummary),
      nextCursor: data.length > PAGE_SIZE && last ? `${last.submitted_at}|${last.id}` : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
