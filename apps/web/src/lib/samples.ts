// Örnek API yanıtları. Mobil ekranlar gerçek hesaplar gelene kadar bunlarla
// geliştirilir. Yanıtlarda `X-HatGuven-Sample: 1` başlığı bulunur.
// Gerçek harita özeti ve karne hesapları saat 10–14 arasında eklenecek.

import type { MapResponse, ScorecardResponse } from "./contract";

export const SAMPLE_HEADERS = { "X-HatGuven-Sample": "1" };

export const sampleMap: MapResponse = {
  period: { start: "2026-11-16", end: "2026-11-22" },
  areas: [
    {
      id: "iskele",
      name: "İskele ve Çarşı",
      boundary: {
        type: "Polygon",
        coordinates: [[[29.02, 40.988], [29.03, 40.988], [29.03, 40.996], [29.02, 40.996], [29.02, 40.988]]],
      },
      band: "10-19",
    },
    {
      id: "moda",
      name: "Moda",
      boundary: {
        type: "Polygon",
        coordinates: [[[29.02, 40.978], [29.032, 40.978], [29.032, 40.988], [29.02, 40.988], [29.02, 40.978]]],
      },
      band: "5-9",
    },
    {
      id: "fenerbahce",
      name: "Fenerbahçe",
      boundary: {
        type: "Polygon",
        coordinates: [[[29.032, 40.968], [29.045, 40.968], [29.045, 40.982], [29.032, 40.982], [29.032, 40.968]]],
      },
      band: "insufficient_data",
    },
  ],
};

export const sampleScorecard: ScorecardResponse = {
  period: { start: "2026-10-28", end: "2026-11-27" },
  institutions: [
    {
      institutionId: "22222222-2222-4222-8222-222222222222",
      institutionName: "Örnek Ulaşım İşletmesi Yolcu Güvenliği Birimi",
      completedMeasures: 1,
      totalMeasures: 2,
      completionRate: 0.5,
    },
    {
      institutionId: "11111111-1111-4111-8111-111111111111",
      institutionName: "Örnek İlçe Belediyesi Kadın Güvenliği Birimi",
      completedMeasures: 0,
      totalMeasures: 0,
      completionRate: null,
    },
  ],
};
