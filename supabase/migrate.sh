#!/usr/bin/env bash
# supabase/migrations/ altındaki, hedefte henüz uygulanmamış migration'ları sırayla uygular.
# Her migration, geçmiş kaydıyla birlikte tek bir transaction içinde çalışır; hata olursa
# o migration geri alınır ve o hedefte sonraki migration'lara geçilmez.
#
# Hedefler:
#   yerel  Çalışan bütün "supabase_db_twobytes*" Docker konteynerleri (ör. 54322, 55322).
#   bulut  SUPABASE_DB_URL bağlantı adresi. Ortam değişkeninden veya apps/web/.env.local'dan okunur.
#          Adres: Supabase Dashboard > Connect > Session pooler (şifre dahil).
#
# Kullanım:
#   supabase/migrate.sh                 # önce plan gösterir, onay ister, sonra yerel + bulut
#   supabase/migrate.sh --dry-run       # yalnızca uygulanacakları listeler
#   supabase/migrate.sh --local         # yalnızca yerel veritabanları
#   supabase/migrate.sh --cloud         # yalnızca bulut
#   supabase/migrate.sh --yes           # onay sormadan uygular
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATIONS="${MIGRATIONS_DIR:-$ROOT/supabase/migrations}"
DRY_RUN=0 LOCAL=1 CLOUD=1 YES=0

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --local) CLOUD=0 ;;
    --cloud) LOCAL=0 ;;
    --yes) YES=1 ;;
    -h|--help) sed -n '2,17p' "$0"; exit 0 ;;
    *) echo "Bilinmeyen seçenek: $arg" >&2; exit 2 ;;
  esac
done

# Bulut için bilgisayardaki psql kullanılır (brew install libpq). PATH'te değilse Homebrew'un
# kurduğu yere bakılır. Yerel psql yoksa yerel Supabase konteynerindeki psql kullanılır.
LOCAL_PSQL="$(command -v psql || true)"
for candidate in /opt/homebrew/opt/libpq/bin/psql /usr/local/opt/libpq/bin/psql; do
  [[ -z "$LOCAL_PSQL" && -x "$candidate" ]] && LOCAL_PSQL="$candidate"
done

LOCAL_DBS=()
if command -v docker >/dev/null && docker info >/dev/null 2>&1; then
  while IFS= read -r name; do [[ -n "$name" ]] && LOCAL_DBS+=("$name"); done \
    < <(docker ps --format '{{.Names}}' | grep '^supabase_db_twobytes' | sort)
elif [[ $LOCAL -eq 1 ]]; then
  echo "UYARI: Docker çalışmıyor, yerel veritabanları atlandı." >&2
fi
PSQL_HOST="${LOCAL_DBS[0]:-}"

if [[ $CLOUD -eq 1 && -z "${SUPABASE_DB_URL:-}" && -f "$ROOT/apps/web/.env.local" ]]; then
  SUPABASE_DB_URL="$(sed -n 's/^SUPABASE_DB_URL=//p' "$ROOT/apps/web/.env.local" | tail -1)"
fi
if [[ $CLOUD -eq 1 && -n "${SUPABASE_DB_URL:-}" && -z "$LOCAL_PSQL" && -z "$PSQL_HOST" ]]; then
  echo "HATA: Bulut için psql bulunamadı. Kurun: brew install libpq" >&2; exit 1
fi

# Hedef başına psql: yerelde konteynerin kendi veritabanı, bulutta bağlantı adresi.
run_psql() { # <hedef> [psql argümanları...]
  local target="$1"; shift
  if [[ "$target" == cloud && -n "$LOCAL_PSQL" ]]; then
    PGCONNECT_TIMEOUT=15 "$LOCAL_PSQL" "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 "$@"
  elif [[ "$target" == cloud ]]; then
    docker exec -i -e PGCONNECT_TIMEOUT=15 "$PSQL_HOST" psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 "$@"
  else
    docker exec -i "$target" psql -U postgres -X -v ON_ERROR_STOP=1 "$@"
  fi
}

label() { [[ "$1" == cloud ]] && echo "bulut" || echo "yerel $1 (port $(docker port "$1" 5432/tcp | head -1 | sed 's/.*://'))"; }

pending() { # <hedef> → uygulanmamış dosya adları
  local applied
  applied="$(run_psql "$1" -tAc "select version from supabase_migrations.schema_migrations" 2>/dev/null)" || {
    echo "HATA: $(label "$1") migration geçmişi okunamadı." >&2; return 1;
  }
  for file in "$MIGRATIONS"/*.sql; do
    local base; base="$(basename "$file" .sql)"
    grep -qx "${base%%_*}" <<<"$applied" || echo "$base"
  done
}

TARGETS=()
if [[ $LOCAL -eq 1 && ${#LOCAL_DBS[@]} -gt 0 ]]; then TARGETS+=("${LOCAL_DBS[@]}"); fi
if [[ $CLOUD -eq 1 ]]; then
  if [[ -n "${SUPABASE_DB_URL:-}" ]]; then
    TARGETS+=(cloud)
  else
    echo "UYARI: SUPABASE_DB_URL tanımlı değil, bulut atlandı. apps/web/.env.local dosyasına ekleyin." >&2
  fi
fi
[[ ${#TARGETS[@]} -gt 0 ]] || { echo "Uygulanacak hedef yok." >&2; exit 1; }

declare -a PLAN_TARGETS PLAN_FILES
total=0
echo "Plan:"
for t in "${TARGETS[@]}"; do
  files="$(pending "$t")" || exit 1
  if [[ -z "$files" ]]; then
    echo "  $(label "$t"): güncel"
  else
    echo "  $(label "$t"):"; sed 's/^/    - /' <<<"$files"
    PLAN_TARGETS+=("$t"); PLAN_FILES+=("$files")
    total=$((total + $(wc -l <<<"$files")))
  fi
done

[[ $total -eq 0 ]] && { echo "Bütün hedefler güncel."; exit 0; }
[[ $DRY_RUN -eq 1 ]] && exit 0

if grep -qiwE 'drop|rename' $(for f in ${PLAN_FILES[@]}; do echo "$MIGRATIONS/$f.sql"; done | sort -u); then
  echo
  echo "DİKKAT: Uygulanacak migration'lardan en az biri DROP veya RENAME içeriyor."
  echo "Bu veritabanına bağlı ve eski kodla çalışan sunucular bozulabilir. Önce kodu güncelleyin."
fi

if [[ $YES -eq 0 ]]; then
  read -r -p "Uygulansın mı? [e/H] " answer
  [[ "$answer" =~ ^[eEyY]$ ]] || { echo "İptal edildi."; exit 1; }
fi

failed=0
for i in "${!PLAN_TARGETS[@]}"; do
  t="${PLAN_TARGETS[$i]}"
  echo "== $(label "$t")"
  while IFS= read -r base; do
    version="${base%%_*}" name="${base#*_}"
    if { echo "begin;"; cat "$MIGRATIONS/$base.sql"; echo;
         echo "insert into supabase_migrations.schema_migrations (version, name) values ('$version', '$name');";
         echo "commit;"; } | run_psql "$t" -q >/dev/null; then
      echo "  ✓ $base"
    else
      echo "  ✗ $base: geri alındı, bu hedefte sonraki migration'lar atlandı." >&2
      failed=1; break
    fi
  done <<<"${PLAN_FILES[$i]}"
  run_psql "$t" -qc "notify pgrst, 'reload schema';" >/dev/null || true
done

exit $failed
