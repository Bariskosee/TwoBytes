#!/usr/bin/env bash
# Sunum veritabanını demo başlangıcına (karne 1/2) döndürür:
#   1. apps/web/scripts/reset-demo.mjs: bildirim, fotoğraf, önlem ve harita özetlerini siler.
#      Kurumlar, bölgeler ve görevli hesapları kalır.
#   2. supabase/demo.sql: sunum kayıtlarını yükler ve sonucu kendisi doğrular.
#   3. Yayımlanan haritayı ve karneyi özetler.
#
# Kullanım: supabase/prepare-demo.sh [ORTAM_DOSYASI]
#   Varsayılan ortam dosyası: ~/TwoBytes/apps/web/.env.local (ortak sunum ortamı :3000, bulut).
#   Dosyada NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY ve SUPABASE_DB_URL bulunmalı.
#   Yerel bir veritabanı için SUPABASE_DB_URL yerine DEMO_DB_URL ortam değişkeni verilebilir.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${1:-$HOME/TwoBytes/apps/web/.env.local}"
[[ -f "$ENV_FILE" ]] || { echo "Ortam dosyası bulunamadı: $ENV_FILE" >&2; exit 1; }
ENV_FILE="$(cd "$(dirname "$ENV_FILE")" && pwd)/$(basename "$ENV_FILE")"

read_env() { sed -n "s/^$1=//p" "$ENV_FILE" | tail -1; }
SUPABASE_URL="$(read_env NEXT_PUBLIC_SUPABASE_URL)"
DB_URL="${DEMO_DB_URL:-$(read_env SUPABASE_DB_URL)}"
[[ -n "$SUPABASE_URL" ]] || { echo "NEXT_PUBLIC_SUPABASE_URL eksik: $ENV_FILE" >&2; exit 1; }
[[ -n "$DB_URL" ]] || { echo "SUPABASE_DB_URL eksik: $ENV_FILE (veya DEMO_DB_URL verin)" >&2; exit 1; }
HOST="$(node -e 'console.log(new URL(process.argv[1]).host)' "$SUPABASE_URL")"

PSQL="$(command -v psql || true)"
for candidate in /opt/homebrew/opt/libpq/bin/psql /usr/local/opt/libpq/bin/psql; do
  [[ -z "$PSQL" && -x "$candidate" ]] && PSQL="$candidate"
done
[[ -n "$PSQL" ]] || { echo "psql bulunamadı. Kurun: brew install libpq" >&2; exit 1; }

echo "== 1/3 Temizlik ($HOST)"
(cd "$ROOT/apps/web" && node --env-file="$ENV_FILE" scripts/reset-demo.mjs --confirm="$HOST")

echo "== 2/3 Sunum verisi"
"$PSQL" "$DB_URL" -X -q -v ON_ERROR_STOP=1 -f "$ROOT/supabase/demo.sql"

echo "== 3/3 Sonuç"
"$PSQL" "$DB_URL" -X -tA -v ON_ERROR_STOP=1 <<'SQL'
select 'Harita (' || (m -> 'period' ->> 'start') || ' – ' || (m -> 'period' ->> 'end') || '): '
  || string_agg((a ->> 'name') || ' ' || replace(a ->> 'band', 'insufficient_data', 'Yetersiz veri'), ', ' order by a ->> 'name')
from (select public.read_weekly_map() as m) as map, jsonb_array_elements(m -> 'areas') as a
group by m;
select 'Karne: ' || string_agg((e ->> 'institutionName') || ' ' || (e ->> 'completedMeasures') || '/' || (e ->> 'totalMeasures'), ', ')
from jsonb_array_elements(public.read_institution_scorecard() -> 'institutions') as e;
select 'Bildirim: ' || count(*) || ', açık önlem: ' || (select count(*) from public.measures where completed_at is null)
from public.reports;
SQL
