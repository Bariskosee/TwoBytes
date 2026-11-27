import { NextResponse } from "next/server";
import type { MapResponse } from "@/lib/contract";
import { SAMPLE_HEADERS, sampleMap } from "@/lib/samples";

// TODO(saat 10–14): public_map_snapshots tablosundan son yayımlanan haftayı oku.
export function GET() {
  return NextResponse.json<MapResponse>(sampleMap, { headers: SAMPLE_HEADERS });
}
