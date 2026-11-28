// TwoBytes API sözleşmesi. Mobil uygulama bu tipleri birebir kullanır.
// Alan adları değişirse README'deki API tablosunu da güncelleyin.

export type ReportStatus = "in_review" | "measure_planned" | "completed";

export type DensityBand = "5-9" | "10-19" | "20+" | "insufficient_data";

/** Hata yanıtlarının ortak biçimi. */
export interface ApiError {
  error: {
    code:
      | "invalid_request"
      | "invalid_code"
      | "rate_limited"
      | "unauthorized"
      | "forbidden"
      | "not_found"
      | "conflict"
      | "server_error";
    message: string;
  };
}

// POST /api/reports ---------------------------------------------------------

/** Fotoğrafsız bildirim için JSON gövdesi. */
export interface CreateReportRequest {
  /** Telefonun ürettiği rastgele UUID. Ağ tekrarlarında aynı değer gönderilir. */
  submissionId: string;
  location: { latitude: number; longitude: number };
  /** ISO 8601, saat dilimi bilgisiyle. */
  occurredAt: string;
  description?: string;
}

/** multipart/form-data alanları. Fotoğraf bölümü tek bir dosya içerir. */
export interface CreateReportMultipartFields {
  submissionId: string;
  latitude: string;
  longitude: string;
  occurredAt: string;
  description?: string;
  photo?: Blob;
}

export interface CreateReportResponse {
  trackingCode: string;
  /** Aynı gönderim daha önce kaydedildiyse false. */
  created: boolean;
}

// GET /api/map --------------------------------------------------------------

export interface MapArea {
  id: string;
  name: string;
  /** GeoJSON Polygon, [boylam, enlem] sırasıyla. */
  boundary: { type: "Polygon"; coordinates: number[][][] };
  band: DensityBand;
}

export interface MapResponse {
  /** Yayımlanan haftanın başlangıcı ve bitişi (İstanbul saatiyle, YYYY-MM-DD). */
  period: { start: string; end: string } | null;
  areas: MapArea[];
}

// POST /api/track -----------------------------------------------------------

export interface TrackRequest {
  trackingCode: string;
}

export interface TrackResponse {
  institutionName: string;
  status: ReportStatus;
  measure: {
    title: string;
    responsibleUnit: string;
    targetDate: string;
    completedAt: string | null;
    outcomeSummary: string | null;
  } | null;
}

// GET /api/scorecard --------------------------------------------------------

export interface ScorecardEntry {
  institutionId: string;
  institutionName: string;
  completedMeasures: number;
  totalMeasures: number;
  /** 0–1 arası; payda sıfırsa null ("Bu dönemde önlem kaydı yok"). */
  completionRate: number | null;
}

export interface ScorecardResponse {
  /** Son 30 gün, İstanbul saatiyle YYYY-MM-DD. */
  period: { start: string; end: string };
  institutions: ScorecardEntry[];
}
