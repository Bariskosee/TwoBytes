import { type ApiResult, getMap } from "./client";
import type { DensityBand, MapArea, MapResponse } from "./contract";

// Jüri gösterimi için sahte harita verisi. Yalnızca istemcide üretilir:
// sunucuya veya veritabanına hiçbir şey yazılmaz, hiçbir istek atılmaz.
// Açmak için: EXPO_PUBLIC_DEMO_MAP=1 npx expo start
// Kapalıyken uygulama gerçek GET /api/map yanıtını kullanır.

/** Metro bu ifadeyi derleme sırasında değerle değiştirir. */
export const demoMapEnabled = process.env.EXPO_PUBLIC_DEMO_MAP === "1";

type Point = [longitude: number, latitude: number];

// Kadıköy kıyısı, kuzeyden (Haydarpaşa) güneydoğuya (Caddebostan) doğru. Yaklaşık değerlerdir.
// Bölgeler denize taşmasın diye kıyı çizgisini izler.
// Kıyı koordinatları yaklaşık olduğu için çokgenler denize taşmasın diye hepsi karaya (kuzeydoğuya) kaydırılır.
const LAND_SHIFT: Point = [0.0022, 0.0014];
const RAW_COAST: Point[] = [
  [29.019, 41.0], // 0 Haydarpaşa
  [29.0225, 40.9925], // 1 Kadıköy iskelesi
  [29.023, 40.988], // 2
  [29.0238, 40.98], // 3 Moda burnu (iskele yaklaşık 29.0257 boylamında, kıyı buraya yakın)
  [29.0272, 40.9755], // 4
  [29.031, 40.9715], // 5
  [29.0345, 40.969], // 6
  [29.0368, 40.9672], // 7 Fenerbahçe burnu
  [29.042, 40.9685], // 8 Kalamış koyu
  [29.05, 40.966], // 9
  [29.06, 40.963], // 10 Caddebostan
];

const COAST: Point[] = RAW_COAST.map(([lng, lat]) => [lng + LAND_SHIFT[0], lat + LAND_SHIFT[1]]);

// Kıyıdan içeriye doğru kıyıya paralel çizgi (iç sınır). Her dilimin kıyı ve iç ucu aynı indekste durur.
// Kıyı noktası indeksleri: dilim istasyonları 0, 1, 3, 5, 7, 10.
const STATIONS = [0, 1, 3, 5, 7, 10];
const INLAND: Point[] = [
  [29.031, 41.0],
  [29.034, 40.993],
  [29.039, 40.981],
  [29.044, 40.977],
  [29.052, 40.972],
  [29.07, 40.969],
];

function mid(a: Point, b: Point): Point {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

/** Dilim `i`: kıyı tarafı (coast) veya iç taraf (inland) yarısı. Halka kapalıdır. */
function strip(i: number, half: "coast" | "inland" | "whole"): MapArea["boundary"] {
  const from = STATIONS[i];
  const to = STATIONS[i + 1];
  const coast = COAST.slice(from, to + 1);
  const inlandFrom = INLAND[i];
  const inlandTo = INLAND[i + 1];
  const midFrom = mid(COAST[from], inlandFrom);
  const midTo = mid(COAST[to], inlandTo);

  let ring: Point[];
  if (half === "coast") ring = [...coast, midTo, midFrom];
  else if (half === "inland") ring = [midFrom, midTo, inlandTo, inlandFrom];
  else ring = [...coast, inlandTo, inlandFrom];

  return { type: "Polygon", coordinates: [[...ring, ring[0]]] };
}

const DEMO_AREAS: { id: string; name: string; strip: number; half: "coast" | "inland" | "whole"; band: DensityBand }[] = [
  { id: "demo-rihtim", name: "Rıhtım", strip: 0, half: "whole", band: "10-19" },
  { id: "demo-carsi", name: "Çarşı ve çevresi", strip: 1, half: "coast", band: "20+" },
  { id: "demo-altiyol", name: "Altıyol", strip: 1, half: "inland", band: "5-9" },
  { id: "demo-moda", name: "Moda", strip: 2, half: "coast", band: "10-19" },
  { id: "demo-yeldegirmeni", name: "Yeldeğirmeni", strip: 2, half: "inland", band: "20+" },
  { id: "demo-fenerbahce", name: "Fenerbahçe", strip: 3, half: "coast", band: "5-9" },
  { id: "demo-bagdat", name: "Bağdat Caddesi", strip: 3, half: "inland", band: "10-19" },
  { id: "demo-caddebostan", name: "Caddebostan", strip: 4, half: "coast", band: "insufficient_data" },
  { id: "demo-goztepe", name: "Göztepe", strip: 4, half: "inland", band: "insufficient_data" },
];

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Geçen pazartesiden pazara uzanan tam hafta. */
function lastFullWeek(now = new Date()): { start: string; end: string } {
  const daysSinceMonday = (now.getUTCDay() + 6) % 7;
  const thisMonday = new Date(now.getTime() - daysSinceMonday * 86_400_000);
  const start = new Date(thisMonday.getTime() - 7 * 86_400_000);
  const end = new Date(start.getTime() + 6 * 86_400_000);
  return { start: isoDay(start), end: isoDay(end) };
}

export function getDemoMap(): Promise<ApiResult<MapResponse>> {
  const data: MapResponse = {
    period: lastFullWeek(),
    areas: DEMO_AREAS.map(({ id, name, strip: i, half, band }) => ({ id, name, boundary: strip(i, half), band })),
  };
  // sample: true. Harita ekranı "Örnek veri gösteriliyor" notunu kendisi gösterir.
  return Promise.resolve({ data, status: 200, durationMs: 0, sample: true });
}

/**
 * Harita ve Bildir'deki bölge listesi bunu kullanır. Bağlantı ekranı gerçek `getMap` ile kalır.
 * - Bayrak açıksa doğrudan mock.
 * - Bayrak kapalıysa gerçek yanıt alınır. Yanıttaki tüm bölgeler "Yetersiz veri" ise (jüri demosunda
 *   veri yoksa boş görünmesin diye) mock'a düşülür. Sunucu ulaşılamazsa hata olduğu gibi gösterilir.
 *   Mock her zaman `sample: true` taşır, ekranda "Örnek veri gösteriliyor" notu görünür.
 */
export async function loadMap(): Promise<ApiResult<MapResponse>> {
  if (demoMapEnabled) return getDemoMap();
  const real = await getMap();
  const { areas } = real.data;
  if (areas.length > 0 && areas.every((area) => area.band === "insufficient_data")) {
    return getDemoMap();
  }
  return real;
}
