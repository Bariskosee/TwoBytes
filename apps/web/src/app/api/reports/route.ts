import { NextResponse, type NextRequest } from "next/server";
import type { CreateReportRequest, CreateReportResponse } from "@/lib/contract";
import { apiError } from "@/lib/http";
import { encodeReportPhoto, MAX_REPORT_PHOTO_BYTES } from "@/lib/report-photo-processing";
import { removeUnreferencedReportPhoto, uploadReportPhoto } from "@/lib/report-photos";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { deriveTrackingCode, hashTrackingCode, mask } from "@/lib/tracking";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
const FUTURE_SKEW_MS = 5 * 60 * 1000;
const MAX_MULTIPART_BYTES = MAX_REPORT_PHOTO_BYTES + 64 * 1024;
const MAX_JSON_BYTES = 32 * 1024;
const FORM_FIELDS = new Set(["submissionId", "latitude", "longitude", "occurredAt", "description", "photo"]);

type Parsed = { ok: true; value: CreateReportRequest } | { ok: false; message: string };
type RequestInput = { body: unknown; photo: File | null };

class RequestBodyTooLarge extends Error {}

async function readBody(request: NextRequest, limit: number): Promise<ArrayBuffer> {
  if (Number(request.headers.get("content-length")) > limit) throw new RequestBodyTooLarge();
  if (!request.body) return new ArrayBuffer(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        void reader.cancel().catch(() => undefined);
        throw new RequestBodyTooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body.buffer;
}

function formCoordinate(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return NaN;
  const decimal = value.trim();
  return /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(decimal) ? Number(decimal) : NaN;
}

function parseForm(form: FormData): RequestInput | NextResponse {
  const fields = new Set<string>();
  for (const name of form.keys()) {
    if (!FORM_FIELDS.has(name) || fields.has(name)) {
      return apiError(400, "invalid_request", "Form alanlarını kontrol edin ve en fazla bir fotoğraf seçin.");
    }
    fields.add(name);
  }

  const photo = form.get("photo");
  if (typeof photo === "string" || photo?.size === 0) {
    return apiError(400, "invalid_request", "Fotoğraf alanında bir görsel dosyası gönderin.");
  }
  if (photo && photo.size > MAX_REPORT_PHOTO_BYTES) {
    return apiError(413, "invalid_request", "Fotoğraf en fazla 4 MiB olabilir.");
  }

  return {
    body: {
      submissionId: form.get("submissionId"),
      location: {
        latitude: formCoordinate(form.get("latitude")),
        longitude: formCoordinate(form.get("longitude")),
      },
      occurredAt: form.get("occurredAt"),
      description: form.get("description"),
    },
    photo,
  };
}

async function readInput(request: NextRequest): Promise<RequestInput | NextResponse> {
  const contentType = request.headers.get("content-type") ?? "";
  const mediaType = contentType.split(";")[0].trim().toLowerCase();
  if (mediaType !== "application/json" && mediaType !== "multipart/form-data") {
    return apiError(415, "invalid_request", "Content-Type must be application/json or multipart/form-data.");
  }

  const multipart = mediaType === "multipart/form-data";
  try {
    const bytes = await readBody(request, multipart ? MAX_MULTIPART_BYTES : MAX_JSON_BYTES);
    const body = new Response(bytes, { headers: { "Content-Type": contentType } });
    return multipart ? parseForm(await body.formData()) : { body: await body.json(), photo: null };
  } catch (error) {
    if (error instanceof RequestBodyTooLarge) {
      return apiError(413, "invalid_request", "Gönderim izin verilen boyutu aşıyor.");
    }
    return apiError(400, "invalid_request", multipart ? "Bildirim formu okunamadı." : "Body is not valid JSON.");
  }
}

function parse(body: unknown): Parsed {
  if (typeof body !== "object" || body === null) {
    return { ok: false, message: "Body must be a JSON object." };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.submissionId !== "string" || !UUID_RE.test(b.submissionId)) {
    return { ok: false, message: "submissionId must be a UUID." };
  }

  const loc = b.location as Record<string, unknown> | undefined;
  const lat = loc?.latitude;
  const lng = loc?.longitude;
  if (
    typeof lat !== "number" || typeof lng !== "number" ||
    !Number.isFinite(lat) || !Number.isFinite(lng) ||
    lat < -90 || lat > 90 || lng < -180 || lng > 180
  ) {
    return { ok: false, message: "location.latitude and location.longitude are required." };
  }

  if (typeof b.occurredAt !== "string") {
    return { ok: false, message: "occurredAt must be an ISO 8601 string." };
  }
  const occurred = Date.parse(b.occurredAt);
  const now = Date.now();
  if (Number.isNaN(occurred) || occurred > now + FUTURE_SKEW_MS || occurred < now - MAX_AGE_MS) {
    return { ok: false, message: "occurredAt must be a valid time within the last year." };
  }

  if (b.description !== undefined && b.description !== null) {
    if (typeof b.description !== "string" || b.description.length > 2000 || b.description.includes("\0")) {
      return { ok: false, message: "description must be a string of at most 2000 characters." };
    }
  }

  return {
    ok: true,
    value: {
      submissionId: b.submissionId.toLowerCase(),
      location: { latitude: lat, longitude: lng },
      occurredAt: new Date(occurred).toISOString(),
      description: (b.description as string | undefined) ?? undefined,
    },
  };
}

function reportSaved(trackingCode: string, created: boolean) {
  return NextResponse.json<CreateReportResponse>(
    { trackingCode, created },
    { status: created ? 201 : 200, headers: { "Cache-Control": "no-store" } },
  );
}

function findSubmission(client: ReturnType<typeof supabaseAdmin>, submissionId: string) {
  return client.from("reports")
    .select("photo_key")
    .eq("submission_id", submissionId)
    .maybeSingle<{ photo_key: string | null }>();
}

function reportSaveFailed() {
  return apiError(500, "server_error", "Bildirim kaydedilemedi. Lütfen tekrar deneyin.");
}

export async function POST(request: NextRequest) {
  const decoded = await readInput(request);
  if (decoded instanceof NextResponse) return decoded;

  const parsed = parse(decoded.body);
  if (!parsed.ok) return apiError(400, "invalid_request", parsed.message);
  const input = parsed.value;

  const photo = decoded.photo ? await encodeReportPhoto(decoded.photo) : null;
  if (decoded.photo && !photo) {
    return apiError(400, "invalid_request", "24 milyon pikseli aşmayan, geçerli bir JPEG, PNG veya WebP fotoğrafı seçin.");
  }

  try {
    const trackingCode = deriveTrackingCode(input.submissionId);
    const client = supabaseAdmin();
    let photoKey: string | null = null;
    if (photo) {
      const existing = await findSubmission(client, input.submissionId);
      if (existing.error) return reportSaveFailed();
      if (existing.data) return reportSaved(trackingCode, false);

      photoKey = await uploadReportPhoto(client, photo);
      if (!photoKey) {
        return apiError(503, "server_error", "Fotoğraf yüklenemedi. Bildirimi tekrar gönderebilirsiniz.");
      }
    }

    const { data, error } = await client
      .rpc("submit_report", {
        p_submission_id: input.submissionId,
        p_code_hash: hashTrackingCode(trackingCode),
        p_lng: input.location.longitude,
        p_lat: input.location.latitude,
        p_occurred_at: input.occurredAt,
        p_description: input.description ?? null,
        p_photo_key: photoKey,
      })
      .single<{ created: boolean }>();
    if (data && !error) {
      if (!data.created && photoKey) await removeUnreferencedReportPhoto(client, photoKey);
      return reportSaved(trackingCode, data.created);
    }

    if (photoKey) {
      if (error?.code && /^(?:22|23|42)[0-9A-Z]{3}$|^P0002$/.test(error.code)) {
        await removeUnreferencedReportPhoto(client, photoKey);
      } else {
        // A lost response does not establish a rollback. The first committed
        // submission owns its immutable photo; only an extra upload is removed.
        const existing = await findSubmission(client, input.submissionId);
        if (existing.data) {
          const created = existing.data.photo_key === photoKey;
          if (!created) await removeUnreferencedReportPhoto(client, photoKey);
          return reportSaved(trackingCode, created);
        }
      }
    }
    console.error("submit_report failed", {
      submission: mask(input.submissionId),
      code: error?.code,
    });
    return reportSaveFailed();
  } catch {
    console.error("report submission unavailable", { submission: mask(input.submissionId) });
    return reportSaveFailed();
  }
}
