import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import type { InstitutionReportPhotoResponse } from "@/lib/institution-contract";
import { UUID_RE } from "@/lib/institution-reports";
import { REPORT_PHOTOS_BUCKET } from "@/lib/report-photos";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { institutionClient } from "@/lib/supabase/institution";

const PHOTO_URL_TTL_SECONDS = 60;

function photoNotFound() {
  return apiError(404, "not_found", "Fotoğraf bulunamadı.");
}

function photoUnavailable() {
  return apiError(503, "server_error", "Fotoğraf şu anda açılamadı.");
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await institutionClient();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  if (!UUID_RE.test(id)) return photoNotFound();

  const { data: report, error: reportError } = await auth.client
    .from("institution_reports")
    .select("id,institution_id,has_photo")
    .eq("id", id)
    .maybeSingle<{ id: string; institution_id: string; has_photo: boolean }>();

  if (reportError) return photoUnavailable();
  if (!report?.has_photo) return photoNotFound();

  const admin = supabaseAdmin();
  const { data: attachment, error: attachmentError } = await admin
    .from("reports")
    .select("photo_key")
    .eq("id", report.id)
    .eq("institution_id", report.institution_id)
    .maybeSingle<{ photo_key: string | null }>();

  if (attachmentError) return photoUnavailable();
  if (!attachment?.photo_key) return photoNotFound();

  const { data, error } = await admin.storage
    .from(REPORT_PHOTOS_BUCKET)
    .createSignedUrl(attachment.photo_key, PHOTO_URL_TTL_SECONDS);
  if (error?.status === 404 || error?.statusCode === "404" || error?.statusCode === "NoSuchKey") {
    return photoNotFound();
  }
  if (!data) return photoUnavailable();

  return NextResponse.json<InstitutionReportPhotoResponse>(
    { signedUrl: data.signedUrl },
    { headers: { "Cache-Control": "no-store" } },
  );
}
