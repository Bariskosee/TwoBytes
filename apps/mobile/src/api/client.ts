import type {
  ApiError,
  CreateReportRequest,
  CreateReportResponse,
  MapResponse,
  ScorecardResponse,
  TrackRequest,
  TrackResponse,
} from "./contract";

export type ApiErrorCode = ApiError["error"]["code"];
export type FailureKind = "config" | "network" | "timeout" | "api" | "invalid_response";

export class ApiRequestError extends Error {
  kind: FailureKind;
  status?: number;
  code?: ApiErrorCode;
  /** Örn. "GET /api/map". İstek gövdesi veya sorgu değeri içermez. */
  endpoint?: string;
  /** İstek fotoğraf içeriyordu. Hata metni buna göre seçilir. */
  photo: boolean;

  constructor(
    kind: FailureKind,
    message: string,
    details: { status?: number; code?: ApiErrorCode; endpoint?: string; photo?: boolean } = {},
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.kind = kind;
    this.status = details.status;
    this.code = details.code;
    this.endpoint = details.endpoint;
    this.photo = details.photo ?? false;
  }
}

export interface ApiResult<T> {
  data: T;
  status: number;
  durationMs: number;
  /** Sunucu örnek veri döndürdüğünde true (X-TwoBytes-Sample başlığı). Güncel sunucu bu başlığı artık göndermiyor. */
  sample: boolean;
}

const TIMEOUT_MS = 10_000;
// Fotoğraf yüklemesi yavaş ağda daha uzun sürebilir.
const PHOTO_TIMEOUT_MS = 45_000;

/** Metro, `process.env.EXPO_PUBLIC_*` ifadesini derleme sırasında değerle değiştirir. */
export function apiBaseUrl(): string | null {
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
  return raw ? raw.replace(/\/+$/, "") : null;
}

interface RequestOptions {
  json?: unknown;
  form?: FormData;
  timeoutMs?: number;
}

// Gönderim kimliği ve takip kodu hassastır. İstek gövdelerini ve yanıtları günlüğe yazmıyoruz.
async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const { json, form, timeoutMs = TIMEOUT_MS } = options;
  const isPost = json !== undefined || form !== undefined;
  const photo = form !== undefined;
  const endpoint = `${isPost ? "POST" : "GET"} ${path}`;
  const base = apiBaseUrl();
  if (!base) {
    throw new ApiRequestError("config", "API adresi ayarlanmamış.", { endpoint, photo });
  }

  // FormData gönderirken Content-Type başlığı yazılmaz. Sınır değerini fetch kendisi üretir.
  const headers: Record<string, string> =
    json !== undefined
      ? { Accept: "application/json", "Content-Type": "application/json" }
      : { Accept: "application/json" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();

  let response: Response;
  try {
    response = await fetch(base + path, {
      method: isPost ? "POST" : "GET",
      headers,
      body: form ?? (json !== undefined ? JSON.stringify(json) : undefined),
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) {
      throw new ApiRequestError("timeout", "Sunucu zamanında yanıt vermedi.", { endpoint, photo });
    }
    throw new ApiRequestError("network", "Sunucuya ulaşılamadı.", { endpoint, photo });
  } finally {
    clearTimeout(timer);
  }

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    parsed = undefined;
  }

  if (!response.ok) {
    const apiError = (parsed as Partial<ApiError> | undefined)?.error;
    throw new ApiRequestError("api", apiError?.message ?? "Sunucu hatası.", {
      status: response.status,
      code: apiError?.code ?? "server_error",
      endpoint,
      photo,
    });
  }
  if (parsed === undefined) {
    throw new ApiRequestError("invalid_response", "Beklenmeyen yanıt.", {
      status: response.status,
      endpoint,
      photo,
    });
  }

  return {
    data: parsed as T,
    status: response.status,
    durationMs: Date.now() - started,
    sample: response.headers.get("x-twobytes-sample") === "1",
  };
}

export const getMap = () => request<MapResponse>("/api/map");
export const getScorecard = () => request<ScorecardResponse>("/api/scorecard");
export const trackCode = (trackingCode: string) =>
  request<TrackResponse>("/api/track", { json: { trackingCode } satisfies TrackRequest });
export const createReport = (report: CreateReportRequest) =>
  request<CreateReportResponse>("/api/reports", { json: report });

/**
 * Fotoğraflı bildirim (multipart/form-data). Alan adları sunucudaki listeyle aynıdır
 * (submissionId, latitude, longitude, occurredAt, description, photo). Her alan bir kez gönderilir.
 * `photo.uri` yerel bir JPEG dosyasıdır.
 */
export const createReportWithPhoto = (report: CreateReportRequest, photo: { uri: string }) => {
  const form = new FormData();
  form.append("submissionId", report.submissionId);
  form.append("latitude", String(report.location.latitude));
  form.append("longitude", String(report.location.longitude));
  form.append("occurredAt", report.occurredAt);
  if (report.description) form.append("description", report.description);
  // React Native, dosyayı {uri, name, type} nesnesiyle FormData'ya ekler.
  form.append("photo", { uri: photo.uri, name: "photo.jpg", type: "image/jpeg" } as unknown as Blob);
  return request<CreateReportResponse>("/api/reports", { form, timeoutMs: PHOTO_TIMEOUT_MS });
};

/** Kullanıcıya gösterilecek Türkçe hata metni. */
export function describeError(error: unknown): string {
  if (!(error instanceof ApiRequestError)) {
    return "Beklenmeyen bir sorun oluştu. Tekrar deneyin.";
  }
  switch (error.kind) {
    case "config":
      return "API adresi ayarlanmamış. apps/mobile/.env.local dosyasında EXPO_PUBLIC_API_URL değerini ayarlayın.";
    case "network":
      return "Sunucuya ulaşılamadı. Telefonun geliştirme sunucusuyla aynı ağda olduğunu kontrol edin.";
    case "timeout":
      return error.photo
        ? "Fotoğraf zamanında yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin."
        : "Sunucu zamanında yanıt vermedi. Tekrar deneyin.";
    case "invalid_response":
      return "Sunucudan beklenmeyen bir yanıt geldi. Tekrar deneyin.";
    case "api":
      if (error.photo) {
        // Fotoğraflı isteklerde sunucunun İngilizce doğrulama mesajları kullanıcıya gösterilmez.
        if (error.status === 413) return "Fotoğraf çok büyük. Daha küçük bir fotoğraf seçin.";
        if (error.status === 400) {
          return "Fotoğraf veya bilgiler kabul edilmedi. Başka bir fotoğraf seçin ya da fotoğrafı kaldırıp tekrar deneyin.";
        }
        if (error.status === 503) return "Fotoğraf yüklenemedi. Aynı bildirimi tekrar gönderebilirsiniz.";
      }
      switch (error.code) {
        case "invalid_code":
          return "Takip kodu bulunamadı. Kodu kontrol edin.";
        case "rate_limited":
          return "Çok fazla deneme yapıldı. Biraz bekleyip tekrar deneyin.";
        case "invalid_request":
          return "Girilen bilgiler geçersiz. Kontrol edip tekrar deneyin.";
        default:
          return "Sunucuda bir sorun oluştu. Tekrar deneyin.";
      }
  }
}

/**
 * Hata ayıklamak için kısa teknik ayrıntı. Örnek: "GET /api/map · HTTP 503 · server_error".
 * Yalnızca yöntem, yol, durum kodu ve hata kodunu içerir. Kod veya gönderim kimliği içermez.
 */
export function describeDetail(error: unknown): string | undefined {
  if (!(error instanceof ApiRequestError)) return undefined;
  const parts = [error.endpoint];
  if (error.status !== undefined) parts.push(`HTTP ${error.status}`);
  if (error.code) parts.push(error.code);
  if (error.status === undefined) parts.push(error.kind);
  return parts.filter(Boolean).join(" · ");
}
