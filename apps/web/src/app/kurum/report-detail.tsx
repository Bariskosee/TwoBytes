"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import type { InstitutionMeasureAction, InstitutionReportResponse } from "@/lib/institution-contract";
import { formatDate, formatDateTime, statusLabels } from "./report-labels";
import {
  institutionRequest,
  InstitutionRequestError,
  REQUEST_ERROR,
  useInstitutionResource,
} from "./requests";
import styles from "./panel.module.css";

type DetailProps = {
  id: string;
  revision: number;
  onChange: () => void;
  onClose: () => void;
  onSessionExpired: () => void;
};

export function ReportDetail({ id, revision, onChange, onClose, onSessionExpired }: DetailProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const mutation = useRef<AbortController | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const [measureMode, setMeasureMode] = useState<"open" | "link">("open");
  const path = `/api/institution/reports/${id}`;
  const reportResource = useInstitutionResource<InstitutionReportResponse>(
    path,
    revision,
    onSessionExpired,
    saving,
  );
  const data = reportResource.data;

  useEffect(() => {
    heading.current?.focus();
    return () => mutation.current?.abort();
  }, []);

  async function submitMeasure(event: FormEvent<HTMLFormElement>, kind: InstitutionMeasureAction["action"]) {
    event.preventDefault();
    if (mutation.current) return;

    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "").trim();
    let action: InstitutionMeasureAction;
    switch (kind) {
      case "open":
        action = {
          action: kind,
          title: value("title"),
          responsibleUnit: value("responsibleUnit"),
          targetDate: value("targetDate"),
        };
        break;
      case "link":
        action = { action: kind, measureId: value("measureId") };
        break;
      case "complete":
        action = { action: kind, outcomeSummary: value("outcomeSummary") };
        break;
    }

    const controller = new AbortController();
    mutation.current = controller;
    reportResource.cancel();
    setSaving(true);
    setMessage(null);

    try {
      const updated = await institutionRequest<InstitutionReportResponse>(`${path}/measure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      reportResource.apply(updated);
      setMessage({
        error: false,
        text: kind === "complete" ? "Önlem tamamlandı." : "Bildirim önleme bağlandı.",
      });
      onChange();
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof InstitutionRequestError && error.status === 401) {
        onSessionExpired();
      } else {
        setMessage({
          error: true,
          text: error instanceof InstitutionRequestError ? error.message : REQUEST_ERROR,
        });
        onChange();
      }
    } finally {
      mutation.current = null;
      if (!controller.signal.aborted) setSaving(false);
    }
  }

  const report = data?.report;
  const measure = report?.measure;

  return (
    <section className={styles.detail} aria-labelledby="report-detail-title">
      <div className={styles.detailHeader}>
        <h2 id="report-detail-title" ref={heading} tabIndex={-1}>Bildirim detayı</h2>
        <button type="button" className={styles.secondary} onClick={onClose}>Listeye dön</button>
      </div>
      {reportResource.error && (
        <div className={styles.detailNotice}>
          <p className={styles.error} role="alert">{reportResource.error}</p>
          <button type="button" className={styles.secondary} onClick={onChange}>Tekrar dene</button>
        </div>
      )}
      {!data && !reportResource.error && <p className={styles.detailNotice} role="status">Bildirim yükleniyor…</p>}
      {report && data && (
        <>
          <div className={styles.detailSection}>
            <div className={styles.detailTitle}>
              <h3>Güvenlik bildirimi</h3>
              <span className={styles.status} data-status={report.status}>{statusLabels[report.status]}</span>
            </div>
            <p className={styles.muted}>{report.institutionName}</p>
            <dl className={styles.facts}>
              <div>
                <dt>Olay zamanı</dt>
                <dd><time dateTime={report.occurredAt}>{formatDateTime(report.occurredAt)}</time></dd>
              </div>
              <div>
                <dt>Bildirim zamanı</dt>
                <dd><time dateTime={report.submittedAt}>{formatDateTime(report.submittedAt)}</time></dd>
              </div>
              <div>
                <dt>Enlem</dt>
                <dd>{String(report.location.latitude).replace(".", ",")}</dd>
              </div>
              <div>
                <dt>Boylam</dt>
                <dd>{String(report.location.longitude).replace(".", ",")}</dd>
              </div>
            </dl>
            {report.areaId === null && <p className={styles.muted}>Pilot bölge dışında</p>}
            {report.description && (
              <div className={styles.description}>
                <h4>Açıklama</h4>
                <p>{report.description}</p>
              </div>
            )}
          </div>
          <div className={styles.detailSection}>
            <h3>Önlem</h3>
            {message && (
              <p className={message.error ? styles.error : styles.success} role={message.error ? "alert" : "status"}>
                {message.text}
              </p>
            )}
            {measure ? (
              <>
                <p className={styles.measureTitle}>{measure.title}</p>
                <dl className={styles.facts}>
                  <div>
                    <dt>Sorumlu birim</dt>
                    <dd>{measure.responsibleUnit}</dd>
                  </div>
                  <div>
                    <dt>Hedef tarih</dt>
                    <dd><time dateTime={measure.targetDate}>{formatDate(measure.targetDate)}</time></dd>
                  </div>
                  {measure.completedAt && (
                    <div>
                      <dt>Tamamlanma zamanı</dt>
                      <dd><time dateTime={measure.completedAt}>{formatDateTime(measure.completedAt)}</time></dd>
                    </div>
                  )}
                </dl>
                {measure.completedAt ? (
                  measure.outcomeSummary && (
                    <div className={styles.description}>
                      <h4>Paylaşılan sonuç</h4>
                      <p>{measure.outcomeSummary}</p>
                    </div>
                  )
                ) : (
                  <form className={styles.form} onSubmit={(event) => submitMeasure(event, "complete")}>
                    <fieldset disabled={saving}>
                      <label>
                        Paylaşılabilir sonuç
                        <textarea
                          name="outcomeSummary"
                          rows={3}
                          maxLength={1000}
                          aria-describedby="outcome-summary-help"
                          required
                        />
                      </label>
                      <p className={styles.muted} id="outcome-summary-help">Bu metin takip kodu ekranında görünür.</p>
                      <button type="submit" className={styles.primary}>
                        {saving ? "Kaydediliyor…" : "Önlemi tamamla"}
                      </button>
                    </fieldset>
                  </form>
                )}
              </>
            ) : (
              <>
                <div className={styles.measureModes} role="group" aria-label="Önlem işlemi">
                  <button
                    type="button"
                    className={styles.secondary}
                    aria-pressed={measureMode === "open"}
                    disabled={saving}
                    onClick={() => setMeasureMode("open")}
                  >
                    Yeni önlem
                  </button>
                  <button
                    type="button"
                    className={styles.secondary}
                    aria-pressed={measureMode === "link"}
                    disabled={saving}
                    onClick={() => setMeasureMode("link")}
                  >
                    Mevcut önlem
                  </button>
                </div>
                {measureMode === "open" ? (
                  <form className={styles.form} onSubmit={(event) => submitMeasure(event, "open")}>
                    <fieldset disabled={saving}>
                      <label>
                        Başlık
                        <input name="title" maxLength={200} required />
                      </label>
                      <label>
                        Sorumlu birim
                        <input name="responsibleUnit" maxLength={200} required />
                      </label>
                      <label>
                        Hedef tarih
                        <input name="targetDate" type="date" required />
                      </label>
                      <button type="submit" className={styles.primary}>
                        {saving ? "Kaydediliyor…" : "Önlemi aç ve bağla"}
                      </button>
                    </fieldset>
                  </form>
                ) : data.availableMeasures.length > 0 ? (
                  <form className={styles.form} onSubmit={(event) => submitMeasure(event, "link")}>
                    <fieldset disabled={saving}>
                      <div className={styles.field}>
                        <label htmlFor="measure-picker">Bağlanacak önlem</label>
                        <select id="measure-picker" name="measureId" defaultValue="" required>
                          <option value="" disabled>Önlem seçin</option>
                          {data.availableMeasures.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.title} · {option.responsibleUnit} · {option.completedAt ? "Tamamlandı" : "Planlandı"} · {formatDate(option.targetDate)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button type="submit" className={styles.primary}>
                        {saving ? "Kaydediliyor…" : "Önleme bağla"}
                      </button>
                    </fieldset>
                  </form>
                ) : (
                  <p className={styles.muted}>Kurumunuzda bağlanabilecek bir önlem yok.</p>
                )}
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
