import { NextResponse, type NextRequest } from "next/server";
import type { CreateReportRequest, CreateReportResponse } from "@/lib/contract";
import { apiError } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { deriveTrackingCode, hashTrackingCode, mask } from "@/lib/tracking";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
const FUTURE_SKEW_MS = 5 * 60 * 1000;

type Parsed = { ok: true; value: CreateReportRequest } | { ok: false; message: string };

function parse(body: unknown): Parsed {
  if (typeof body !== "object" || body === null) {
    return { ok: false, message: "Body must be a JSON object." };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.submissionId !== "string" || !UUID_RE.test(b.submissionId)) {
    return { ok: false, message: "submissionId must be a UUID." };
  }

  const loc = b.location as Record<string, unknown> | undefined;
  const lat = loc?.latitude;
  const lng = loc?.longitude;
  if (
    typeof lat !== "number" || typeof lng !== "number" ||
    !Number.isFinite(lat) || !Number.isFinite(lng) ||
    lat < -90 || lat > 90 || lng < -180 || lng > 180
  ) {
    return { ok: false, message: "location.latitude and location.longitude are required." };
  }

  if (typeof b.occurredAt !== "string") {
    return { ok: false, message: "occurredAt must be an ISO 8601 string." };
  }
  const occurred = Date.parse(b.occurredAt);
  const now = Date.now();
  if (Number.isNaN(occurred) || occurred > now + FUTURE_SKEW_MS || occurred < now - MAX_AGE_MS) {
    return { ok: false, message: "occurredAt must be a valid time within the last year." };
  }

  if (b.description !== undefined && b.description !== null) {
    if (typeof b.description !== "string" || b.description.length > 2000 || b.description.includes("\0")) {
      return { ok: false, message: "description must be a string of at most 2000 characters." };
    }
  }

  return {
    ok: true,
    value: {
      submissionId: b.submissionId.toLowerCase(),
      location: { latitude: lat, longitude: lng },
      occurredAt: new Date(occurred).toISOString(),
      description: (b.description as string | undefined) ?? undefined,
    },
  };
}

export async function POST(request: NextRequest) {
  // Fotoğraflı multipart gönderim, özel fotoğraf akışıyla (saat 10–14) eklenecek.
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return apiError(415, "invalid_request", "Content-Type must be application/json.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "invalid_request", "Body is not valid JSON.");
  }

  const parsed = parse(body);
  if (!parsed.ok) return apiError(400, "invalid_request", parsed.message);
  const input = parsed.value;

  const trackingCode = deriveTrackingCode(input.submissionId);

  const { data, error } = await supabaseAdmin()
    .rpc("submit_report", {
      p_submission_id: input.submissionId,
      p_code_hash: hashTrackingCode(trackingCode),
      p_lng: input.location.longitude,
      p_lat: input.location.latitude,
      p_occurred_at: input.occurredAt,
      p_description: input.description ?? null,
      p_photo_key: null,
    })
    .single<{ report_id: string; institution_id: string; area_id: string | null; created: boolean }>();

  if (error || !data) {
    console.error("submit_report failed", {
      submission: mask(input.submissionId),
      code: error?.code,
    });
    return apiError(500, "server_error", "Bildirim kaydedilemedi. Lütfen tekrar deneyin.");
  }

  return NextResponse.json<CreateReportResponse>(
    { trackingCode, created: data.created },
    { status: data.created ? 201 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
