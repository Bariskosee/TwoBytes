import type { ReactNode } from "react";
import styles from "./panel.module.css";

type NoticeKind = "info" | "error" | "success";

const labels: Record<NoticeKind, string> = {
  info: "Bilgi",
  error: "Hata",
  success: "Başarılı",
};

/** Mobildeki Notice ile aynı: renge ek olarak "Hata", "Başarılı" veya "Bilgi" etiketi taşır. */
export function Notice({ kind, children }: { kind: NoticeKind; children: ReactNode }) {
  return (
    <p className={styles[kind]} role={kind === "error" ? "alert" : "status"}>
      <span className={styles.noticeLabel}>
        {labels[kind]}
        <span className={styles.visuallyHidden}>: </span>
      </span>
      <span>{children}</span>
    </p>
  );
}
