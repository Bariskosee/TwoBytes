import { connection, NextResponse } from "next/server";
import type { ScorecardResponse } from "@/lib/contract";
import { apiError } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  await connection();

  const { data, error } = await supabaseAdmin().rpc("read_institution_scorecard");

  if (error || !data) {
    console.error("read_institution_scorecard failed", { code: error?.code });
    return apiError(503, "server_error", "Kurum karnesi şu anda kullanılamıyor.");
  }

  return NextResponse.json(data as ScorecardResponse, { headers: { "Cache-Control": "no-store" } });
}
