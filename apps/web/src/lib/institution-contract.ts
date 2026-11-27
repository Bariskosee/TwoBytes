import type { ReportStatus } from "./contract";

export interface InstitutionReportSummary {
  id: string;
  institutionId: string;
  institutionName: string;
  occurredAt: string;
  submittedAt: string;
  areaId: string | null;
  status: ReportStatus;
}

export interface InstitutionMeasure {
  id: string;
  title: string;
  responsibleUnit: string;
  targetDate: string;
  openedAt: string;
  completedAt: string | null;
  outcomeSummary: string | null;
}

export interface InstitutionReportDetail extends InstitutionReportSummary {
  location: { latitude: number; longitude: number };
  description: string | null;
  measure: InstitutionMeasure | null;
}

export interface InstitutionInboxResponse {
  reports: InstitutionReportSummary[];
  nextCursor: string | null;
}

export interface InstitutionReportResponse {
  report: InstitutionReportDetail;
  availableMeasures: InstitutionMeasure[];
}

export type InstitutionMeasureAction =
  | { action: "open"; title: string; responsibleUnit: string; targetDate: string }
  | { action: "link"; measureId: string }
  | { action: "complete"; outcomeSummary: string };
