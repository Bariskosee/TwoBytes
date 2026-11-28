#!/usr/bin/env bash
# Mobil uygulamayı ortak sunum API'sine bağlı başlatır.
#   npm run demo                         # varsayılan: http://172.20.10.4:3000
#   npm run demo -- http://ADRES:PORT    # başka bir API adresi
# Adresi .env.local dosyasına yazar, API'ye ulaşılabildiğini kontrol eder ve Expo'yu
# önbelleği temizleyerek başlatır. EXPO_PUBLIC_ değişkenleri derleme sırasında koda
# yazıldığı için adres değişince --clear gerekir; bu komut bunu her seferinde yapar.
set -euo pipefail
cd "$(dirname "$0")/.."

API="${1:-http://172.20.10.4:3000}"
API="${API%/}"

echo "API adresi: $API"
if ! curl -fsS --max-time 5 -o /dev/null "$API/api/map"; then
  echo "HATA: $API/api/map yanıt vermiyor." >&2
  echo "  - Bu bilgisayar API'yi çalıştıran bilgisayarla aynı ağda (hotspot) mı?" >&2
  echo "  - API bilgisayarında 'ipconfig getifaddr en0' bu adresi mi veriyor?" >&2
  echo "  - API çalışıyor mu? (apps/web: npm run dev -- -H 0.0.0.0 -p 3000)" >&2
  exit 1
fi
echo "API yanıt veriyor."

printf 'EXPO_PUBLIC_API_URL=%s\n' "$API" > .env.local
echo ".env.local güncellendi. Uygulamada Bağlantı sekmesi bu adresi göstermeli."

exec npx expo start --clear
