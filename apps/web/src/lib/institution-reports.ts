import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlaceType, ReportStatus } from "@/lib/contract";
import { apiError } from "@/lib/http";
import type {
  InstitutionMeasure,
  InstitutionMeasureAction,
  InstitutionReportSummary,
} from "@/lib/institution-contract";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const INBOX_COLUMNS =
  "id,institution_id,institution_name,area_id,place_type,occurred_at,submitted_at,measure_id,measure_completed_at";

export interface InboxRow {
  id: string;
  institution_id: string;
  institution_name: string;
  area_id: string | null;
  place_type: PlaceType;
  occurred_at: string;
  submitted_at: string;
  measure_id: string | null;
  measure_completed_at: string | null;
}

export function reportSummary(row: InboxRow): InstitutionReportSummary {
  const status: ReportStatus = row.measure_completed_at
    ? "completed"
    : row.measure_id ? "measure_planned" : "in_review";

  return {
    id: row.id,
    institutionId: row.institution_id,
    institutionName: row.institution_name,
    areaId: row.area_id,
    placeType: row.place_type,
    occurredAt: row.occurred_at,
    submittedAt: row.submitted_at,
    status,
  };
}

interface DetailRow extends InboxRow {
  latitude: number;
  longitude: number;
  description: string | null;
  measure_title: string;
  measure_responsible_unit: string;
  measure_target_date: string;
  measure_opened_at: string;
  measure_outcome_summary: string | null;
}

export function reportNotFound() {
  return apiError(404, "not_found", "Bildirim veya önlem bulunamadı.");
}

export async function readInstitutionReport(client: SupabaseClient, id: string) {
  const { data: row, error } = await client
    .from("institution_reports")
    .select(`${INBOX_COLUMNS},latitude,longitude,description,measure_title,measure_responsible_unit,measure_target_date,measure_opened_at,measure_outcome_summary`)
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<DetailRow, { merge: false }>();

  if (error) return { error: apiError(503, "server_error", "Bildirim ayrıntısı yüklenemedi.") };
  if (!row) return { error: reportNotFound() };

  let availableMeasures: InstitutionMeasure[] = [];
  if (!row.measure_id) {
    const { data, error } = await client
      .from("measures")
      .select("id,title,responsibleUnit:responsible_unit,targetDate:target_date,openedAt:opened_at,completedAt:completed_at,outcomeSummary:outcome_summary")
      .eq("institution_id", row.institution_id)
      .order("completed_at", { nullsFirst: true, ascending: false })
      .order("opened_at", { ascending: false })
      .overrideTypes<InstitutionMeasure[], { merge: false }>();
    if (error) return { error: apiError(503, "server_error", "Mevcut önlemler yüklenemedi.") };
    availableMeasures = data;
  }

  return {
    report: {
      ...reportSummary(row),
      location: { latitude: row.latitude, longitude: row.longitude },
      description: row.description,
      measure: row.measure_id ? {
        id: row.measure_id,
        title: row.measure_title,
        responsibleUnit: row.measure_responsible_unit,
        targetDate: row.measure_target_date,
        openedAt: row.measure_opened_at,
        completedAt: row.measure_completed_at,
        outcomeSummary: row.measure_outcome_summary,
      } : null,
    },
    availableMeasures,
  };
}

function boundedText(value: unknown, limit: number) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 && text.length <= limit && !text.includes("\0") ? text : null;
}

export function parseMeasureAction(body: unknown): InstitutionMeasureAction | null {
  if (!body || typeof body !== "object") return null;
  const input = body as Record<string, unknown>;

  switch (input.action) {
    case "open": {
      const title = boundedText(input.title, 200);
      const responsibleUnit = boundedText(input.responsibleUnit, 200);
      const targetDate = input.targetDate;
      if (!title || !responsibleUnit || typeof targetDate !== "string" ||
        !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(targetDate)) return null;
      const date = new Date(targetDate);
      if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== targetDate) return null;
      return { action: "open", title, responsibleUnit, targetDate };
    }
    case "link":
      if (typeof input.measureId !== "string" || !UUID_RE.test(input.measureId)) return null;
      return { action: "link", measureId: input.measureId };
    case "complete": {
      const outcomeSummary = boundedText(input.outcomeSummary, 1000);
      return outcomeSummary ? { action: "complete", outcomeSummary } : null;
    }
    default:
      return null;
  }
}

export async function updateInstitutionMeasure(
  client: SupabaseClient,
  id: string,
  input: InstitutionMeasureAction,
) {
  switch (input.action) {
    case "open":
      return client.rpc("open_report_measure", {
        p_report_id: id,
        p_title: input.title,
        p_responsible_unit: input.responsibleUnit,
        p_target_date: input.targetDate,
      });
    case "link":
      return client.rpc("link_report_measure", { p_report_id: id, p_measure_id: input.measureId });
    case "complete":
      return client.rpc("complete_report_measure", { p_report_id: id, p_outcome_summary: input.outcomeSummary });
  }
}
