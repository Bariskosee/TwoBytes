"use client";

import { useEffect, useRef, useState } from "react";
import type { InstitutionReportPhotoResponse } from "@/lib/institution-contract";
import { institutionRequest, InstitutionRequestError } from "./requests";
import styles from "./panel.module.css";

type PhotoView =
  | { status: "closed" | "loading" }
  | { status: "open"; url: string }
  | { status: "error"; message: string };

const PHOTO_LOAD_ERROR = "Fotoğraf açılamadı. Lütfen tekrar deneyin.";

export function ReportPhoto({
  path,
  onSessionExpired,
}: {
  path: string;
  onSessionExpired: () => void;
}) {
  const [view, setView] = useState<PhotoView>({ status: "closed" });
  const request = useRef<AbortController | null>(null);
  const objectUrl = useRef<string | null>(null);

  useEffect(() => () => {
    request.current?.abort();
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
  }, []);

  function releasePhoto() {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
  }

  async function openPhoto() {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setView({ status: "loading" });

    try {
      const { signedUrl } = await institutionRequest<InstitutionReportPhotoResponse>(path, {
        signal: controller.signal,
      });
      const response = await fetch(signedUrl, {
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(PHOTO_LOAD_ERROR);
      const photo = await response.blob();
      if (controller.signal.aborted) return;
      if (photo.type !== "image/jpeg") throw new Error(PHOTO_LOAD_ERROR);

      const url = URL.createObjectURL(photo);
      objectUrl.current = url;
      setView({ status: "open", url });
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof InstitutionRequestError && error.status === 401) {
        onSessionExpired();
        return;
      }
      setView({
        status: "error",
        message: error instanceof InstitutionRequestError ? error.message : PHOTO_LOAD_ERROR,
      });
    } finally {
      request.current = null;
    }
  }

  function closePhoto() {
    releasePhoto();
    setView({ status: "closed" });
  }

  return (
    <div className={styles.reportPhoto}>
      <button
        type="button"
        className={styles.secondary}
        aria-controls="report-photo-preview"
        aria-expanded={view.status === "open"}
        disabled={view.status === "loading"}
        onClick={view.status === "open" ? closePhoto : openPhoto}
      >
        {view.status === "open" ? "Fotoğrafı kapat" : "Fotoğrafı aç"}
      </button>
      {view.status === "loading" && <p className={styles.muted} role="status">Fotoğraf yükleniyor…</p>}
      {view.status === "error" && <p className={styles.error} role="alert">{view.message}</p>}
      <div id="report-photo-preview" hidden={view.status !== "open"}>
        {view.status === "open" && (
          // eslint-disable-next-line @next/next/no-img-element -- The private preview uses an in-memory blob URL.
          <img
            src={view.url}
            alt="Bildirime eklenen fotoğraf"
            decoding="async"
            onError={() => {
              releasePhoto();
              setView({ status: "error", message: PHOTO_LOAD_ERROR });
            }}
          />
        )}
      </div>
    </div>
  );
}
