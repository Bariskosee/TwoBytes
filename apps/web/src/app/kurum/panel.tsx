"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import type { ReportStatus } from "@/lib/contract";
import type {
  InstitutionInboxResponse,
  InstitutionKind,
  InstitutionProfileResponse,
} from "@/lib/institution-contract";
import { ReportDetail } from "./report-detail";
import { areaLabel, formatDateTime, statusLabels } from "./report-labels";
import { useInstitutionResource } from "./requests";
import styles from "./panel.module.css";

let nextInboxChannel = 0;

const kindLabels: Record<InstitutionKind, string> = {
  metropolitan: "Büyükşehir",
  district: "İlçe",
};

const STATUS_ORDER: ReportStatus[] = ["in_review", "measure_planned", "completed"];
type StatusFilter = ReportStatus | "all";

function getBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  try {
    return createBrowserClient(url, key);
  } catch {
    return null;
  }
}

export function InstitutionPanel() {
  const [client] = useState(getBrowserClient);
  const [userId, setUserId] = useState<string | null>();
  const activeUserId = useRef<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    if (!client) return;
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user.id ?? null;
      activeUserId.current = nextUserId;
      setUserId(nextUserId);
      if (event === "SIGNED_IN") setSessionExpired(false);
    });
    return () => subscription.unsubscribe();
  }, [client]);

  const expireSession = useCallback((expectedUserId: string) => {
    if (activeUserId.current !== expectedUserId) return;
    activeUserId.current = null;
    setSessionExpired(true);
    setUserId(null);
    void client?.auth.signOut({ scope: "local" }).catch(() => undefined);
  }, [client]);

  if (client && userId) {
    return (
      <Inbox key={userId} client={client} userId={userId} expireSession={expireSession} />
    );
  }

  return (
    <div className={styles.panel} lang="tr">
      <PanelHeader />
      <main className={styles.authMain}>
        <section className={styles.authCard} aria-labelledby="institution-login-title">
          <div className={styles.authIntro}>
            <h1 id="institution-login-title">Kurum girişi</h1>
            <p className={styles.muted}>
              Kurumunuza yönlendirilen bildirimleri incelemek ve önlem kaydetmek için görevli hesabınızla giriş yapın.
            </p>
          </div>
          {!client && <p role="alert" className={styles.error}>Kurum oturumu yapılandırılmamış.</p>}
          {client && userId === undefined && (
            <p role="status" className={styles.muted}>Oturum denetleniyor…</p>
          )}
          {client && userId === null && <LoginForm client={client} sessionExpired={sessionExpired} />}
        </section>
      </main>
    </div>
  );
}

function LoginForm({
  client,
  sessionExpired,
}: {
  client: SupabaseClient;
  sessionExpired: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const { error } = await client.auth.signInWithPassword({
        email: String(form.get("email")).trim(),
        password: String(form.get("password")),
      });
      if (error) {
        setError(error.code === "invalid_credentials"
          ? "E-posta adresi veya parola hatalı."
          : "Giriş yapılamadı. Lütfen tekrar deneyin.");
      }
    } catch {
      setError("Giriş yapılamadı. Lütfen tekrar deneyin.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={signIn}>
      {sessionExpired && !error && (
        <p className={styles.muted} role="status">Oturumunuz sona erdi. Yeniden giriş yapın.</p>
      )}
      <label>
        Kurum e-posta adresi
        <input name="email" type="email" autoComplete="username" required />
      </label>
      <label>
        Parola
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button type="submit" className={styles.primary} disabled={pending}>
        {pending ? "Giriş yapılıyor…" : "Giriş yap"}
      </button>
    </form>
  );
}

function PanelHeader({
  profile,
  children,
}: {
  profile?: InstitutionProfileResponse | null;
  children?: React.ReactNode;
}) {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true" />
          <span className={styles.brandText}>
            <strong>Güvenlik Haritası</strong>
            <span>Kurum paneli</span>
          </span>
        </div>
        {(profile || children) && (
          <div className={styles.headerActions}>
            {profile && (
              <div className={styles.identity} aria-label="Oturumdaki kurum">
                <span className={styles.kindBadge}>{kindLabels[profile.institution.kind]}</span>
                <span className={styles.identityText}>
                  <strong>{profile.institution.name}</strong>
                  {profile.email && <span>{profile.email}</span>}
                </span>
              </div>
            )}
            {children}
          </div>
        )}
      </div>
    </header>
  );
}

function useInboxUpdates(client: SupabaseClient) {
  const [revision, setRevision] = useState(0);
  const [connected, setConnected] = useState(false);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    let subscribed = false;
    let active = true;
    let invalidate: number | undefined;

    function queueRefresh() {
      if (!active || invalidate !== undefined) return;
      invalidate = window.setTimeout(() => {
        invalidate = undefined;
        refresh();
      }, 100);
    }

    const channel = client.channel(`kurum-gelen-kutusu-${++nextInboxChannel}`, {
      config: { postgres_changes_options: { wait: true } },
    })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "report_inbox_events" }, queueRefresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "report_inbox_events" }, queueRefresh)
      .subscribe((status) => {
        if (!active) return;
        subscribed = status === "SUBSCRIBED";
        setConnected(subscribed);
        queueRefresh();
      });

    const fallback = window.setInterval(() => {
      if (!client.realtime.isConnected()) subscribed = false;
      if (!subscribed) {
        setConnected(false);
        queueRefresh();
      }
    }, 5000);

    function onVisibilityChange() {
      if (document.visibilityState === "visible") queueRefresh();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", queueRefresh);

    return () => {
      active = false;
      window.clearTimeout(invalidate);
      window.clearInterval(fallback);
      window.removeEventListener("online", queueRefresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void client.removeChannel(channel).catch(() => undefined);
    };
  }, [client, refresh]);

  return { revision, connected, refresh };
}

function Inbox({
  client,
  userId,
  expireSession,
}: {
  client: SupabaseClient;
  userId: string;
  expireSession: (userId: string) => void;
}) {
  const { revision, connected, refresh } = useInboxUpdates(client);
  const onSessionExpired = useCallback(() => expireSession(userId), [expireSession, userId]);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const cursor = cursorHistory.at(-1);
  const path = cursor ? `/api/institution/reports?cursor=${encodeURIComponent(cursor)}` : "/api/institution/reports";
  const { data, error } = useInstitutionResource<InstitutionInboxResponse>(
    path,
    revision,
    onSessionExpired,
  );
  const { data: profile } = useInstitutionResource<InstitutionProfileResponse>(
    "/api/institution/me",
    0,
    onSessionExpired,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [knownIds, setKnownIds] = useState<Set<string> | null>(null);
  const [freshIds, setFreshIds] = useState<Set<string>>(() => new Set());
  const [seenReports, setSeenReports] = useState<InstitutionInboxResponse["reports"]>();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const inboxTitle = useRef<HTMLHeadingElement | null>(null);
  const selectedButton = useRef<HTMLButtonElement | null>(null);

  const reports = data?.reports;

  // İlk yüklemeden sonra canlı gelen bildirimleri "Yeni" olarak işaretle.
  if (reports !== seenReports) {
    setSeenReports(reports);
    if (reports && !cursor) {
      const ids = reports.map((report) => report.id);
      if (!knownIds) {
        setKnownIds(new Set(ids));
      } else {
        const added = ids.filter((id) => !knownIds.has(id));
        if (added.length > 0) {
          setKnownIds(new Set([...knownIds, ...added]));
          setFreshIds((previous) => new Set([...previous, ...added]));
        }
      }
    }
  }

  const counts = STATUS_ORDER.reduce(
    (result, status) => ({ ...result, [status]: reports?.filter((r) => r.status === status).length ?? 0 }),
    {} as Record<ReportStatus, number>,
  );
  const visibleReports = filter === "all" ? reports : reports?.filter((report) => report.status === filter);
  const areaNames = new Map(profile?.areas.map((area) => [area.id, area.name]));
  const showDetail = Boolean(reports && selectedId);

  useEffect(() => {
    if (!profile) return;
    const previous = document.title;
    document.title = `${profile.institution.name} | Kurum paneli`;
    return () => { document.title = previous; };
  }, [profile]);

  function selectReport(id: string, button: HTMLButtonElement) {
    selectedButton.current = button;
    setSelectedId(id);
    setFreshIds((previous) => {
      if (!previous.has(id)) return previous;
      const next = new Set(previous);
      next.delete(id);
      return next;
    });
  }

  function closeDetail() {
    setSelectedId(null);
    window.requestAnimationFrame(() => selectedButton.current?.focus());
  }

  function changePage(nextCursor?: string) {
    setSelectedId(null);
    setCursorHistory((history) => nextCursor ? [...history, nextCursor] : history.slice(0, -1));
    inboxTitle.current?.focus();
  }

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError(false);
    try {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) setSignOutError(true);
    } catch {
      setSignOutError(true);
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className={styles.panel} lang="tr" data-institution={profile?.institution.kind}>
      <PanelHeader profile={profile}>
        <button className={styles.signOut} onClick={signOut} disabled={signingOut}>
          {signingOut ? "Çıkış yapılıyor…" : "Çıkış yap"}
        </button>
      </PanelHeader>
      <main className={styles.inboxMain}>
        {signOutError && <p className={styles.error} role="alert">Çıkış yapılamadı. Tekrar deneyin.</p>}
        <div className={styles.inboxHeading}>
          <div>
            <h1 ref={inboxTitle} tabIndex={-1}>Gelen kutusu</h1>
            <p className={styles.muted}>
              {profile ? `${profile.institution.name} kurumuna yönlendirilen bildirimler` : "Kurum bildirimleri"}
            </p>
          </div>
          {reports && (
            <p className={styles.connection} data-connected={connected} role="status">
              {connected ? "Canlı bağlantı" : "5 saniyede bir güncelleniyor"}
            </p>
          )}
        </div>
        {reports && (
          <div className={styles.filters} role="group" aria-label="Duruma göre filtrele">
            <button
              type="button"
              className={styles.filter}
              aria-pressed={filter === "all"}
              onClick={() => setFilter("all")}
            >
              Tümü <span className={styles.count}>{reports.length}</span>
            </button>
            {STATUS_ORDER.map((status) => (
              <button
                key={status}
                type="button"
                className={styles.filter}
                data-status={status}
                aria-pressed={filter === status}
                onClick={() => setFilter(status)}
              >
                {statusLabels[status]} <span className={styles.count}>{counts[status]}</span>
              </button>
            ))}
          </div>
        )}
        <div className={styles.workspace} data-detail-open={showDetail}>
          <section className={styles.inbox} aria-label="Kurum bildirimleri">
            {error && (
              <div className={styles.inboxNotice}>
                <p className={styles.error} role="alert">{error}</p>
                <button className={styles.secondary} onClick={refresh}>Tekrar dene</button>
              </div>
            )}
            {!reports && !error && <p className={styles.inboxNotice} role="status">Bildirimler yükleniyor…</p>}
            {reports?.length === 0 && (
              <p className={styles.inboxNotice}>
                {cursor ? "Bu sayfada bildirim yok." : "Kurumunuza atanmış henüz bir bildirim yok."}
              </p>
            )}
            {reports && reports.length > 0 && visibleReports?.length === 0 && (
              <p className={styles.inboxNotice}>Bu durumda bildirim yok.</p>
            )}
            {visibleReports && visibleReports.length > 0 && (
              <ul className={styles.reportList}>
                {visibleReports.map((report) => (
                  <li key={report.id}>
                    <button
                      type="button"
                      className={styles.reportRow}
                      data-status={report.status}
                      aria-current={report.id === selectedId ? "true" : undefined}
                      onClick={(event) => selectReport(report.id, event.currentTarget)}
                    >
                      <span className={styles.rowTitle}>
                        <strong>{areaLabel(report.areaId, areaNames)}</strong>
                        <span className={styles.rowBadges}>
                          {freshIds.has(report.id) && <span className={styles.fresh}>Yeni</span>}
                          <span className={styles.status} data-status={report.status}>
                            {statusLabels[report.status]}
                          </span>
                        </span>
                      </span>
                      <span className={styles.rowMetadata}>
                        <span>
                          Olay: <time dateTime={report.occurredAt}>{formatDateTime(report.occurredAt)}</time>
                        </span>
                        <span>
                          Bildirim: <time dateTime={report.submittedAt}>{formatDateTime(report.submittedAt)}</time>
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {(cursor || data?.nextCursor) && (
              <nav aria-label="Bildirim sayfaları" className={styles.pagination}>
                <button type="button" className={styles.secondary} disabled={!cursor} onClick={() => changePage()}>
                  Önceki
                </button>
                <span className={styles.muted}>Sayfa {cursorHistory.length + 1}</span>
                <button
                  type="button"
                  className={styles.secondary}
                  disabled={!data?.nextCursor}
                  onClick={() => {
                    if (data?.nextCursor) changePage(data.nextCursor);
                  }}
                >
                  Sonraki
                </button>
              </nav>
            )}
          </section>
          {reports && selectedId ? (
            <ReportDetail
              key={selectedId}
              id={selectedId}
              areaNames={areaNames}
              revision={revision}
              onChange={refresh}
              onClose={closeDetail}
              onSessionExpired={onSessionExpired}
            />
          ) : reports && reports.length > 0 ? (
            <p className={styles.emptyDetail}>Detayları ve önlem işlemlerini açmak için bir bildirim seçin.</p>
          ) : null}
        </div>
      </main>
    </div>
  );
}
