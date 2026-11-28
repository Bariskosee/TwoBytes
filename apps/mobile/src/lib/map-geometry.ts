// Harita katmanı için saf yardımcılar. Bileşenden bağımsız olduğu için Node'da test edilebilir.

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface Region extends LatLng {
  latitudeDelta: number;
  longitudeDelta: number;
}

interface PolygonGeometry {
  coordinates: number[][][];
}

/** GeoJSON [boylam, enlem] sırasını react-native-maps için {latitude, longitude}'a çevirir. İlk halka (dış sınır) kullanılır. */
export function toPolygonCoordinates(boundary: PolygonGeometry): LatLng[] {
  const ring = boundary.coordinates[0] ?? [];
  return ring.map(([longitude, latitude]) => ({ latitude, longitude }));
}

/** Bütün bölgeleri kapsayan başlangıç bölgesi. Bölge yoksa verilen yedek değer döner. */
export function regionFor(boundaries: PolygonGeometry[], fallback: Region): Region {
  const points = boundaries.flatMap((boundary) => toPolygonCoordinates(boundary));
  if (points.length === 0) return fallback;

  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);

  // Kenarlarda pay bırakmak için sınırları %40 genişletir. Çok küçük alanlarda en az 0.01 derece.
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.4, 0.01),
    longitudeDelta: Math.max((maxLng - minLng) * 1.4, 0.01),
  };
}

/** "#RRGGBB" rengini verilen saydamlıkla "rgba(r, g, b, a)" metnine çevirir. */
export function withAlpha(hex: string, alpha: number): string {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`Geçersiz renk: ${hex}`);
  const [r, g, b] = [match[1], match[2], match[3]].map((part) => parseInt(part, 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
