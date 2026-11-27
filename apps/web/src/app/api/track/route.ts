import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { NextResponse, type NextRequest } from "next/server";
import type { TrackResponse } from "@/lib/contract";
import { apiError } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { hashTrackingCode, normalizeTrackingCode } from "@/lib/tracking";

interface TrackingRow {
  limited: boolean;
  institution_name: string;
  title: string | null;
  responsible_unit: string;
  target_date: string;
  completed_at: string | null;
  outcome_summary: string | null;
}

function rateKey(request: NextRequest, secret: string) {
  const header = process.env.VERCEL === "1"
    ? "x-vercel-forwarded-for"
    : process.env.TRACKING_CLIENT_IP_HEADER;
  const ip = header ? request.headers.get(header)?.trim().toLowerCase() : undefined;
  return createHmac("sha256", secret)
    .update(`track-rate:${ip && isIP(ip) ? ip : "shared"}`)
    .digest("hex");
}

export async function POST(request: NextRequest) {
  const secret = process.env.TRACKING_CODE_SECRET;
  if (!secret || secret.length < 32) {
    return apiError(503, "server_error", "Takip sorgusu şu anda yapılamıyor.");
  }

  const body = await request.json().catch(() => null) as { trackingCode?: unknown } | null;
  const input = body?.trackingCode;
  const code = typeof input === "string" && input.length <= 64 ? normalizeTrackingCode(input) : null;
  const { data, error } = await supabaseAdmin()
    .rpc("lookup_report_tracking", {
      p_code_hash: code ? hashTrackingCode(code) : null,
      p_rate_key: rateKey(request, secret),
    })
    .maybeSingle()
    .overrideTypes<TrackingRow, { merge: false }>();

  if (error) {
    console.error("lookup_report_tracking failed", { code: error.code });
    return apiError(503, "server_error", "Takip sorgusu şu anda yapılamıyor.");
  }
  if (data?.limited) {
    return apiError(429, "rate_limited", "Çok fazla sorgu yapıldı. Bir dakika sonra tekrar deneyin.", {
      "Retry-After": "60",
    });
  }
  if (!data) return apiError(404, "invalid_code", "Takip kodu bulunamadı.");

  return NextResponse.json<TrackResponse>(
    {
      institutionName: data.institution_name,
      status: data.completed_at ? "completed" : data.title ? "measure_planned" : "in_review",
      measure: data.title ? {
        title: data.title,
        responsibleUnit: data.responsible_unit,
        targetDate: data.target_date,
        completedAt: data.completed_at,
        outcomeSummary: data.completed_at ? data.outcome_summary : null,
      } : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
