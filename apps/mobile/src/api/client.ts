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

  constructor(
    kind: FailureKind,
    message: string,
    details: { status?: number; code?: ApiErrorCode; endpoint?: string } = {},
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.kind = kind;
    this.status = details.status;
    this.code = details.code;
    this.endpoint = details.endpoint;
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

/** Metro, `process.env.EXPO_PUBLIC_*` ifadesini derleme sırasında değerle değiştirir. */
export function apiBaseUrl(): string | null {
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
  return raw ? raw.replace(/\/+$/, "") : null;
}

// Gönderim kimliği ve takip kodu hassastır. İstek gövdelerini ve yanıtları günlüğe yazmıyoruz.
async function request<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
  const endpoint = `${body === undefined ? "GET" : "POST"} ${path}`;
  const base = apiBaseUrl();
  if (!base) {
    throw new ApiRequestError("config", "API adresi ayarlanmamış.", { endpoint });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();

  let response: Response;
  try {
    response = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers:
        body === undefined
          ? { Accept: "application/json" }
          : { Accept: "application/json", "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) {
      throw new ApiRequestError("timeout", "Sunucu zamanında yanıt vermedi.", { endpoint });
    }
    throw new ApiRequestError("network", "Sunucuya ulaşılamadı.", { endpoint });
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
    });
  }
  if (parsed === undefined) {
    throw new ApiRequestError("invalid_response", "Beklenmeyen yanıt.", {
      status: response.status,
      endpoint,
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
  request<TrackResponse>("/api/track", { trackingCode } satisfies TrackRequest);
export const createReport = (report: CreateReportRequest) =>
  request<CreateReportResponse>("/api/reports", report);

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
      return "Sunucu zamanında yanıt vermedi. Tekrar deneyin.";
    case "invalid_response":
      return "Sunucudan beklenmeyen bir yanıt geldi. Tekrar deneyin.";
    case "api":
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
