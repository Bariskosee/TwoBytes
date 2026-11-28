import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { apiError } from "@/lib/http";

export async function institutionClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return { error: apiError(503, "server_error", "Kurum paneli yapılandırması eksik.") };
  }

  const cookieStore = await cookies();
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (updates) => {
        for (const { name, value, options } of updates) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
  const { data: { user }, error } = await client.auth.getUser();
  if (error?.status && error.status >= 500) {
    return { error: apiError(503, "server_error", "Oturum şu anda doğrulanamadı.") };
  }
  if (!user || user.is_anonymous) {
    return { error: apiError(401, "unauthorized", "Kurum hesabınızla giriş yapın.") };
  }

  const { data: membership, error: membershipError } = await client
    .from("institution_members")
    .select("institution_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return { error: apiError(503, "server_error", "Kurum üyeliği doğrulanamadı.") };
  }
  if (!membership) {
    return { error: apiError(403, "forbidden", "Bu hesap bir kuruma atanmadı.") };
  }

  return { client, user, institutionId: membership.institution_id as string };
}
