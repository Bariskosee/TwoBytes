import { NextResponse } from "next/server";
import type { ScorecardResponse } from "@/lib/contract";
import { SAMPLE_HEADERS, sampleScorecard } from "@/lib/samples";

// TODO(saat 10–14): son 30 günde açılan benzersiz önlemlerden hesapla.
export function GET() {
  return NextResponse.json<ScorecardResponse>(sampleScorecard, { headers: SAMPLE_HEADERS });
}
