import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import type { InstitutionKind, InstitutionProfileResponse } from "@/lib/institution-contract";
import { institutionClient } from "@/lib/supabase/institution";

export async function GET() {
  const auth = await institutionClient();
  if (auth.error) return auth.error;

  const [institution, areas] = await Promise.all([
    auth.client
      .from("institutions")
      .select("id,name,routing_key")
      .eq("id", auth.institutionId)
      .maybeSingle<{ id: string; name: string; routing_key: InstitutionKind }>(),
    auth.client
      .from("map_areas")
      .select("id,name")
      .order("name")
      .overrideTypes<{ id: string; name: string }[], { merge: false }>(),
  ]);

  if (institution.error || !institution.data || areas.error) {
    return apiError(503, "server_error", "Kurum bilgileri yüklenemedi.");
  }

  return NextResponse.json<InstitutionProfileResponse>(
    {
      email: auth.user.email ?? null,
      institution: {
        id: institution.data.id,
        name: institution.data.name,
        kind: institution.data.routing_key,
      },
      areas: areas.data,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
