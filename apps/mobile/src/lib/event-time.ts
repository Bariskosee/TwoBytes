// Olay zamanı kuralları. Saf fonksiyonlar, cihazın saat diliminden bağımsız.
// Türkiye 2016'dan beri yıl boyu UTC+3 kullanır (yaz saati uygulaması yok), bu yüzden
// İstanbul saati sabit +03:00 farkıyla hesaplanır.

const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/** Sunucu `occurredAt` değerini son 365 gün içinde ister. */
export const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

const pad = (value: number) => String(value).padStart(2, "0");

function istanbulParts(date: Date) {
  const shifted = new Date(date.getTime() + ISTANBUL_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  };
}

/** "28.11.2026 14:05" biçiminde İstanbul saati. */
export function formatIstanbul(date: Date): string {
  const p = istanbulParts(date);
  return `${pad(p.day)}.${pad(p.month)}.${p.year} ${pad(p.hour)}:${pad(p.minute)}`;
}

/** Saat dilimi bilgili ISO 8601, örn. "2026-11-28T14:05:00+03:00". Aynı anı gösterir. */
export function toIstanbulIso(date: Date): string {
  const p = istanbulParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}+03:00`;
}

/** Saniye ve milisaniyeyi atar. Varsayılan "şimdi" böylece asla gelecekte kalmaz. */
export function floorToMinute(date: Date): Date {
  return new Date(Math.floor(date.getTime() / MINUTE_MS) * MINUTE_MS);
}

/** Geçersizse alanın altında gösterilecek Türkçe neden, geçerliyse null. */
export function validateEventTime(selected: Date, nowMs: number): string | null {
  const time = selected.getTime();
  if (Number.isNaN(time)) {
    return "Geçerli bir tarih ve saat seçin.";
  }
  if (time > nowMs) {
    return "Olayın zamanı gelecekte olamaz. Şu andan önceki bir zaman seçin.";
  }
  if (time < nowMs - MAX_AGE_MS) {
    const oldest = formatIstanbul(new Date(nowMs - MAX_AGE_MS));
    return `Olay en fazla bir yıl önce yaşanmış olabilir. En eski zaman: ${oldest} (İstanbul saati).`;
  }
  return null;
}
