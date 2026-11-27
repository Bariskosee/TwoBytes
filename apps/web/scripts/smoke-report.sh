#!/usr/bin/env bash
# İlk test kaydı: Çarşı ve çevresinde fotoğrafsız bir güvenlik bildirimi gönderir,
# aynı gönderimi tekrar dener ve aynı takip kodunun döndüğünü kontrol eder.
# Kullanım: ./scripts/smoke-report.sh [API_URL]   (varsayılan http://localhost:3000)
set -euo pipefail

API="${1:-http://localhost:3000}"
SUBMISSION_ID="$(uuidgen | tr '[:upper:]' '[:lower:]')"
OCCURRED_AT="$(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d '-1 hour' +%Y-%m-%dT%H:%M:%SZ)"

BODY=$(cat <<EOF
{"submissionId":"$SUBMISSION_ID","location":{"latitude":40.992,"longitude":29.025},"occurredAt":"$OCCURRED_AT","description":"Kurgu test kaydı: meydanda yetersiz aydınlatma."}
EOF
)

post() {
  curl -sS -w '\n%{http_code}' -X POST "$API/api/reports" \
    -H 'Content-Type: application/json' --data "$BODY"
}

first=$(post);  first_status=$(tail -n1 <<<"$first");  first_body=$(sed '$d' <<<"$first")
second=$(post); second_status=$(tail -n1 <<<"$second"); second_body=$(sed '$d' <<<"$second")

echo "1. gönderim: HTTP $first_status $first_body"
echo "2. gönderim: HTTP $second_status $second_body"

code1=$(sed -n 's/.*"trackingCode":"\([^"]*\)".*/\1/p' <<<"$first_body")
code2=$(sed -n 's/.*"trackingCode":"\([^"]*\)".*/\1/p' <<<"$second_body")

if [[ "$first_status" == 201 && "$second_status" == 200 && -n "$code1" && "$code1" == "$code2" ]]; then
  echo "OK: tek kayıt, aynı takip kodu ($code1)"
else
  echo "HATA: beklenen 201 + 200 ve aynı takip kodu" >&2
  exit 1
fi
