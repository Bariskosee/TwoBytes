// Sunum veritabanını supabase/demo.sql için temizler.
//
// Siler: bütün bildirimler (takip kodları birlikte), bildirim fotoğrafları, önlemler ve
// yayımlanmış haftalık harita özetleri. Kurumlara, bölgelere ve görevli hesaplarına dokunmaz.
//
// Varsayılan olarak yalnızca ne silineceğini listeler. Silmek için hedef Supabase sunucusunun
// adını --confirm ile verin (yanlış veritabanını temizlemeyi önler):
//
//   node --env-file=.env.local scripts/reset-demo.mjs
//   node --env-file=.env.local scripts/reset-demo.mjs --confirm=mygmosguieafmbxhenyn.supabase.co
//
// Ardından demo verisini yükleyin: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f ../../supabase/demo.sql
import { createClient } from "@supabase/supabase-js";

const BUCKET = "report-photos";

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required (run with --env-file=.env.local).`);
  return value;
}

const url = new URL(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"));
const confirm = process.argv.find((arg) => arg.startsWith("--confirm="))?.slice("--confirm=".length);
const admin = createClient(url.origin, requiredEnv("SUPABASE_SECRET_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

function must(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result;
}

async function count(table) {
  const { count: total } = must(
    await admin.from(table).select("*", { count: "exact", head: true }),
    `count ${table}`,
  );
  return total ?? 0;
}

async function storedPhotoKeys() {
  const keys = [];
  for (let offset = 0; ; offset += 1000) {
    const { data } = must(
      await admin.storage.from(BUCKET).list("reports", { limit: 1000, offset }),
      "list photos",
    );
    keys.push(...data.filter((item) => item.id).map((item) => `reports/${item.name}`));
    if (data.length < 1000) return keys;
  }
}

async function main() {
  const [reports, measures, snapshots, photos] = await Promise.all([
    count("reports"),
    count("measures"),
    count("public_map_snapshots"),
    storedPhotoKeys(),
  ]);

  console.log(`Hedef: ${url.host}`);
  console.log(`  ${reports} bildirim, ${photos.length} fotoğraf, ${measures} önlem, ${snapshots} harita özeti satırı`);

  if (confirm !== url.host) {
    console.log(`\nHiçbir şey silinmedi. Silmek için: --confirm=${url.host}`);
    return;
  }

  // Önce fotoğraflar: bildirim satırları silinirse anahtarlar kaybolur.
  for (let i = 0; i < photos.length; i += 100) {
    must(await admin.storage.from(BUCKET).remove(photos.slice(i, i + 100)), "remove photos");
  }
  // Bildirimler önlemlere bağlı; önce bildirimler, sonra önlemler.
  must(await admin.from("reports").delete().not("id", "is", null), "delete reports");
  must(await admin.from("measures").delete().not("id", "is", null), "delete measures");
  must(
    await admin.from("public_map_snapshots").delete().not("period_start", "is", null),
    "delete map snapshots",
  );

  const left = await Promise.all([count("reports"), count("measures"), count("public_map_snapshots")]);
  if (left.some((n) => n !== 0)) throw new Error(`Temizlik tamamlanamadı: ${left.join(", ")}`);
  console.log("\nTemizlendi. Şimdi supabase/demo.sql dosyasını bu veritabanına uygulayın.");
}

main().catch((error) => {
  console.error(`HATA — ${error.message}`);
  process.exitCode = 1;
});
