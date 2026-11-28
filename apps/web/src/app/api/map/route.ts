import { connection, NextResponse } from "next/server";
import type { MapResponse } from "@/lib/contract";
import { apiError } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  await connection();

  const { data, error } = await supabaseAdmin().rpc("read_weekly_map");

  if (error || !data) {
    console.error("read_weekly_map failed", { code: error?.code });
    return apiError(503, "server_error", "Haftalık harita şu anda kullanılamıyor.");
  }

  return NextResponse.json(data as MapResponse, { headers: { "Cache-Control": "no-store" } });
}
