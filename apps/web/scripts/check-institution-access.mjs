import { randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const INBOX = "/api/institution/reports";
const PROFILE = "/api/institution/me";
const DEMO_TENANTS = [
  { key: "metropolitan", areaId: "iskele", latitude: 40.992, longitude: 29.025 },
  { key: "district", areaId: "moda", latitude: 40.982, longitude: 29.025 },
];

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  check(value, `${name} is required.`);
  return value;
}

function loopbackOrigin(name) {
  const value = requiredEnv(name);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a local HTTP origin.`);
  }
  check(
    url.protocol === "http:" && ["127.0.0.1", "[::1]"].includes(url.hostname) &&
      !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash,
    `${name} must be an explicit loopback HTTP origin, such as http://127.0.0.1:3191.`,
  );
  return url.origin;
}

function localFetch(origin) {
  return (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : input, origin);
    check(url.origin === origin && !url.username && !url.password, "Unexpected HTTP origin.");
    return fetch(input instanceof Request ? input : url, {
      ...init,
      redirect: "error",
      signal: init.signal ?? AbortSignal.timeout(15_000),
    });
  };
}

function exactFields(value, fields, label) {
  check(
    value && typeof value === "object" && !Array.isArray(value) &&
      Object.keys(value).sort().join(",") === [...fields].sort().join(","),
    `${label} returned fields outside its contract.`,
  );
}

async function request(api, path, status, { session, body } = {}) {
  const headers = new Headers();
  if (session) headers.set("Cookie", session.cookieHeader());
  if (body !== undefined && !(body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const response = await api(path, {
    headers,
    method: body === undefined ? "GET" : "POST",
    body: body instanceof FormData || body === undefined ? body : JSON.stringify(body),
  });
  check(
    response.status === status,
    `${body === undefined ? "GET" : "POST"} ${path} expected ${status}, got ${response.status}.`,
  );
  const data = await response.json().catch(() => {
    throw new Error(`${path} did not return JSON.`);
  });
  return { data, headers: response.headers };
}

async function authUser(admin, localSupabase, supabaseUrl, publishableKey, authIds, email, institutionId) {
  const password = `${randomUUID()}-Aa1!`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  check(!created.error && created.data.user, "Could not create a local fixture user.");
  const userId = created.data.user.id;
  authIds.push(userId);
  if (institutionId) {
    const assigned = await admin.from("institution_members").insert({
      user_id: userId,
      institution_id: institutionId,
    });
    check(!assigned.error, "Could not assign a local fixture user to its institution.");
  }

  const cookies = new Map();
  const client = createServerClient(supabaseUrl, publishableKey, {
    global: { fetch: localSupabase },
    cookies: {
      getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
      setAll: (items) => {
        for (const { name, value } of items) {
          if (value) cookies.set(name, value);
          else cookies.delete(name);
        }
      },
    },
  });
  const login = await client.auth.signInWithPassword({ email, password });
  check(!login.error && login.data.user?.id === userId && cookies.size > 0, "Local cookie sign-in failed.");
  return {
    cookieHeader: () => [...cookies].map(([name, value]) => `${name}=${value}`).join("; "),
  };
}

async function submitFixture(api, admin, tenant, marker, submissionIds, image) {
  const submissionId = randomUUID();
  const occurredAt = new Date().toISOString();
  const location = { latitude: tenant.latitude, longitude: tenant.longitude };
  const description = `${marker} ${tenant.key} ${image ? "photo" : "plain"}`;
  let body = { submissionId, location, occurredAt, description };
  if (image) {
    const form = new FormData();
    form.set("submissionId", submissionId);
    form.set("latitude", String(location.latitude));
    form.set("longitude", String(location.longitude));
    form.set("occurredAt", occurredAt);
    form.set("description", description);
    form.set("photo", new Blob([image], { type: "image/png" }), "fixture.png");
    body = form;
  }
  submissionIds.push(submissionId);
  const { data } = await request(api, "/api/reports", 201, { body });
  exactFields(data, ["trackingCode", "created"], "Public report creation");
  check(data.created === true && typeof data.trackingCode === "string", "Public report receipt is invalid.");

  const stored = await admin.from("reports")
    .select("id,institution_id,area_id")
    .eq("submission_id", submissionId)
    .single();
  check(
    !stored.error && stored.data?.institution_id === tenant.id && stored.data?.area_id === tenant.areaId,
    `${tenant.key} fixture was not routed to its expected institution and area.`,
  );
  return { id: stored.data.id, trackingCode: data.trackingCode, location, description };
}

async function sameNotFound(api, session, existing, unknown, body) {
  const actual = await request(api, existing, 404, { session, body });
  const baseline = await request(api, unknown, 404, { session, body });
  exactFields(actual.data, ["error"], "Authorization error");
  exactFields(actual.data.error, ["code", "message"], "Authorization error details");
  check(
    actual.data.error.code === "not_found" && JSON.stringify(actual.data) === JSON.stringify(baseline.data),
    "Authorization denial differed from the missing resource response.",
  );
}

async function checkSignedPhoto(api, localSupabase, supabaseUrl, session, reportId) {
  const { data, headers } = await request(api, `${INBOX}/${reportId}/photo`, 200, { session });
  exactFields(data, ["signedUrl"], "Photo signing");
  check(headers.get("cache-control")?.includes("no-store"), "Photo signing response can be cached.");
  const url = new URL(data.signedUrl);
  check(
    url.origin === supabaseUrl && url.pathname.startsWith("/storage/v1/object/sign/report-photos/"),
    "Signed photo did not point to the isolated private bucket.",
  );
  const token = url.searchParams.get("token");
  check(token, "Signed photo has no time-limited token.");
  let exp;
  try {
    ({ exp } = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")));
  } catch {
    throw new Error("Could not read signed photo expiry.");
  }
  const remaining = exp - Math.floor(Date.now() / 1000);
  check(remaining > 0 && remaining <= 60, "Signed photo is not limited to 60 seconds.");
  const image = await localSupabase(url);
  check(image.ok && /^image\/jpeg\b/.test(image.headers.get("content-type") ?? ""), "Private photo is not readable as JPEG.");
  check((await image.arrayBuffer()).byteLength > 0, "Signed photo is empty.");
  const publicUrl = new URL(url);
  publicUrl.pathname = url.pathname.replace("/object/sign/", "/object/public/");
  publicUrl.search = "";
  const publicImage = await localSupabase(publicUrl);
  check(!publicImage.ok, "The private photo was accessible through the public Storage path.");
  await publicImage.body?.cancel();
}

function checkPublicMap(map) {
  exactFields(map, ["period", "areas"], "Public map");
  if (map.period !== null) exactFields(map.period, ["start", "end"], "Map period");
  check(Array.isArray(map.areas) && map.areas.length > 0, "Seeded public map areas are missing.");
  for (const area of map.areas) {
    exactFields(area, ["id", "name", "boundary", "band"], "Public map area");
    exactFields(area.boundary, ["type", "coordinates"], "Public boundary");
    check(area.boundary.type === "Polygon", "The map lost its public polygon geometry.");
  }
}

async function getScorecard(api) {
  const { data } = await request(api, "/api/scorecard", 200);
  exactFields(data, ["period", "institutions"], "Public scorecard");
  exactFields(data.period, ["start", "end"], "Scorecard period");
  for (const entry of data.institutions) {
    exactFields(entry, [
      "institutionId", "institutionName", "completedMeasures", "totalMeasures", "completionRate",
    ], "Public scorecard entry");
  }
  return new Map(data.institutions.map(entry => [entry.institutionId, entry]));
}

function checkTrack(data, tenant, completed) {
  exactFields(data, ["institutionName", "status", "measure"], "Public tracking");
  check(data.institutionName === tenant.name, "Public tracking returned the wrong institution.");
  if (!completed) {
    check(data.status === "in_review" && data.measure === null, "A fresh report did not start in review.");
    return;
  }
  exactFields(data.measure, ["title", "responsibleUnit", "targetDate", "completedAt", "outcomeSummary"], "Public tracking measure");
  check(
    data.status === "completed" && data.measure.title === tenant.open.title &&
      data.measure.targetDate === tenant.open.targetDate && data.measure.completedAt &&
      data.measure.outcomeSummary === tenant.complete.outcomeSummary,
    "Public tracking did not reflect the fixture's completed measure.",
  );
}

async function cleanup(admin, submissionIds, measureTitles, authIds) {
  const failures = [];
  if (submissionIds.length > 0) {
    try {
      const deleted = await admin.from("reports").delete().in("submission_id", submissionIds).select("photo_key");
      check(!deleted.error, "Could not delete fixture reports.");
      const keys = deleted.data.map(row => row.photo_key).filter(Boolean);
      if (keys.length > 0) {
        const removed = await admin.storage.from("report-photos").remove(keys);
        check(!removed.error, "Could not delete fixture photos.");
      }
    } catch {
      failures.push("reports or photos");
    }
    try {
      const deleted = await admin.from("measures").delete().in("title", measureTitles);
      check(!deleted.error, "Could not delete fixture measures.");
    } catch {
      failures.push("measures");
    }
  }
  const users = await Promise.allSettled(authIds.map(id => admin.auth.admin.deleteUser(id)));
  if (users.some(result => result.status === "rejected" || result.value.error)) failures.push("fixture accounts");
  return failures;
}

async function main() {
  const apiUrl = loopbackOrigin("TWOBYTES_TEST_API_URL");
  const supabaseUrl = loopbackOrigin("NEXT_PUBLIC_SUPABASE_URL");
  check(apiUrl !== supabaseUrl, "Use distinct origins for the isolated web and Supabase servers.");
  const publishableKey = requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const secret = requiredEnv("SUPABASE_SECRET_KEY");
  const api = localFetch(apiUrl);
  const localSupabase = localFetch(supabaseUrl);
  const admin = createClient(supabaseUrl, secret, {
    global: { fetch: localSupabase },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const marker = `TwoBytes acceptance ${randomUUID()}`;
  const emailMarker = randomUUID();
  const unknownReport = `${INBOX}/${randomUUID()}`;
  const unknownMeasure = randomUUID();
  const targetDate = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const authIds = [];
  const submissionIds = [];
  const measureTitles = [];
  let baseline;
  let testError;

  try {
    const seeded = await admin.from("institutions").select("id,name,routing_key")
      .in("routing_key", DEMO_TENANTS.map(tenant => tenant.key));
    check(!seeded.error, "Could not read seeded institutions from local Supabase.");
    const tenants = [];
    for (const tenant of DEMO_TENANTS) {
      const row = seeded.data.find(institution => institution.routing_key === tenant.key);
      check(row, `Seed the isolated ${tenant.key} institution before testing.`);
      const email = `${tenant.key}-${emailMarker}@example.com`;
      const session = await authUser(
        admin, localSupabase, supabaseUrl, publishableKey, authIds, email, row.id,
      );
      const open = {
        action: "open", title: `${marker} ${tenant.key}`, responsibleUnit: "Test Birimi", targetDate,
      };
      measureTitles.push(open.title);
      tenants.push({
        ...tenant, id: row.id, name: row.name, email, session, open,
        complete: { action: "complete", outcomeSummary: `${marker} ${tenant.key} tamamlandı.` },
      });
    }

    // A fresh user is only provisioned in the supplied local Supabase. Both
    // cookie-authenticated reads must work before exercising any write route.
    for (const tenant of tenants) {
      await request(api, INBOX, 200, { session: tenant.session });
      const { data: profile } = await request(api, PROFILE, 200, { session: tenant.session });
      exactFields(profile, ["email", "institution", "areas"], "Institution profile");
      exactFields(profile.institution, ["id", "name", "kind"], "Institution profile institution");
      check(
        profile.email === tenant.email && profile.institution.id === tenant.id &&
          profile.institution.name === tenant.name && profile.institution.kind === tenant.key,
        `${tenant.key} profile did not describe the signed-in officer's own institution.`,
      );
      check(
        Array.isArray(profile.areas) && profile.areas.some(area => area.id === tenant.areaId) &&
          profile.areas.every(area => Object.keys(area).sort().join(",") === "id,name"),
        "Institution profile area labels are missing or expose extra fields.",
      );
    }
    const nonMember = await authUser(
      admin, localSupabase, supabaseUrl, publishableKey, authIds, `nonmember-${emailMarker}@example.com`,
    );
    checkPublicMap((await request(api, "/api/map", 200)).data);
    baseline = await getScorecard(api);

    const image = await sharp({
      create: { width: 24, height: 18, channels: 3, background: "#593772" },
    }).png().toBuffer();
    for (const tenant of tenants) {
      tenant.photo = await submitFixture(api, admin, tenant, marker, submissionIds, image);
      tenant.plain = await submitFixture(api, admin, tenant, marker, submissionIds);
    }

    for (const [index, tenant] of tenants.entries()) {
      const rival = tenants[1 - index];
      const { session, photo, plain } = tenant;
      const { data: inbox } = await request(api, INBOX, 200, { session });
      const ids = new Set(inbox.reports.map(report => report.id));
      check(ids.has(photo.id) && ids.has(plain.id), `${tenant.key} inbox omitted its own fixture.`);
      check(!ids.has(rival.photo.id) && !ids.has(rival.plain.id), `${tenant.key} inbox included another institution's fixture.`);
      check(inbox.reports.every(report => report.institutionId === tenant.id), "Inbox exposed another institution.");
      for (const report of inbox.reports) {
        exactFields(report, [
          "id", "institutionId", "institutionName", "occurredAt", "submittedAt", "areaId", "status",
        ], "Institution inbox summary");
      }
      for (const fixture of [photo, plain]) {
        const { data: { report, availableMeasures } } = await request(api, `${INBOX}/${fixture.id}`, 200, { session });
        check(
          report.id === fixture.id && report.institutionId === tenant.id && report.areaId === tenant.areaId &&
            report.location.latitude === fixture.location.latitude && report.location.longitude === fixture.location.longitude &&
            report.description === fixture.description && report.hasPhoto === (fixture === photo) &&
            report.status === "in_review" && report.measure === null &&
            !("photoKey" in report) && !("photo_key" in report) && !("signedUrl" in report),
          "Authorized detail did not contain the expected tenant-scoped report fields.",
        );
        check(Array.isArray(availableMeasures), "The available measures list is missing.");
      }
      await checkSignedPhoto(api, localSupabase, supabaseUrl, session, photo.id);
      await sameNotFound(api, session, `${INBOX}/${rival.photo.id}`, unknownReport);
      await sameNotFound(api, session, `${INBOX}/${rival.photo.id}/photo`, `${unknownReport}/photo`);
      await sameNotFound(api, session, `${INBOX}/${plain.id}/photo`, `${unknownReport}/photo`);
      await sameNotFound(api, session, `${INBOX}/${rival.photo.id}/measure`, `${unknownReport}/measure`, rival.open);
      const tracking = await request(api, "/api/track", 200, { body: { trackingCode: photo.trackingCode } });
      checkTrack(tracking.data, tenant, false);
    }

    const photoPath = `${INBOX}/${tenants[0].photo.id}`;
    for (const [path, body] of [[PROFILE], [INBOX], [photoPath], [`${photoPath}/photo`], [`${photoPath}/measure`, tenants[0].open]]) {
      const anonymous = await request(api, path, 401, { body });
      const forbidden = await request(api, path, 403, { session: nonMember, body });
      check(anonymous.data.error?.code === "unauthorized" && forbidden.data.error?.code === "forbidden", "Anonymous and unassigned accounts were not rejected.");
    }
    console.log("PASS — both institution inboxes, report details, private photos, and session boundaries.");

    for (const tenant of tenants) {
      const { data: { report } } = await request(api, `${INBOX}/${tenant.photo.id}/measure`, 200, {
        session: tenant.session, body: tenant.open,
      });
      check(
        report.status === "measure_planned" && report.measure?.title === tenant.open.title &&
          report.measure.targetDate === tenant.open.targetDate && report.measure.responsibleUnit === tenant.open.responsibleUnit,
        "Authorized officer could not open a measure.",
      );
      tenant.measureId = report.measure.id;
    }
    for (const [index, tenant] of tenants.entries()) {
      const rival = tenants[1 - index];
      const { session, plain, measureId } = tenant;
      const path = `${INBOX}/${plain.id}/measure`;
      const link = { action: "link", measureId };
      await sameNotFound(api, session, `${INBOX}/${rival.plain.id}/measure`, `${unknownReport}/measure`, link);
      const foreign = await request(api, path, 404, { session, body: { action: "link", measureId: rival.measureId } });
      const missing = await request(api, path, 404, { session, body: { action: "link", measureId: unknownMeasure } });
      check(JSON.stringify(foreign.data) === JSON.stringify(missing.data), "A foreign measure was distinguishable from an unknown one.");
      const { data: { report } } = await request(api, path, 200, { session, body: link });
      check(report.status === "measure_planned" && report.measure?.id === measureId, "Officer could not link to its own existing measure.");
      await sameNotFound(
        api, session, `${INBOX}/${rival.photo.id}/measure`, `${unknownReport}/measure`, rival.complete,
      );
    }
    for (const tenant of tenants) {
      const { data: { report } } = await request(api, `${INBOX}/${tenant.photo.id}/measure`, 200, {
        session: tenant.session, body: tenant.complete,
      });
      check(
        report.status === "completed" && report.measure?.id === tenant.measureId &&
          report.measure.completedAt && report.measure.outcomeSummary === tenant.complete.outcomeSummary,
        "Authorized officer could not complete its measure.",
      );
      const tracking = await request(api, "/api/track", 200, { body: { trackingCode: tenant.plain.trackingCode } });
      checkTrack(tracking.data, tenant, true);
    }
    const updated = await getScorecard(api);
    for (const tenant of tenants) {
      const before = baseline.get(tenant.id);
      const after = updated.get(tenant.id);
      check(
        before && after && after.totalMeasures === before.totalMeasures + 1 &&
          after.completedMeasures === before.completedMeasures + 1,
        "Public scorecard did not count the shared measure exactly once.",
      );
    }
    console.log("PASS — foreign open/link/complete match missing records, own measure flow and public responses.");
  } catch (error) {
    testError = error;
  }

  const failures = await cleanup(admin, submissionIds, measureTitles, authIds);
  if (failures.length) throw new Error(`Fixture cleanup incomplete: ${failures.join(", ")}.`, { cause: testError });
  if (testError) throw testError;
  const restored = await getScorecard(api);
  for (const [id, before] of baseline) {
    const after = restored.get(id);
    check(
      after?.totalMeasures === before.totalMeasures && after?.completedMeasures === before.completedMeasures,
      "Fixture cleanup did not restore the prior public scorecard totals.",
    );
  }
  console.log("PASS — temporary fixture reports, photos, measures, and accounts removed.");
}

main().catch(error => {
  console.error(`FAIL — ${error.message}`);
  if (error.cause instanceof Error) console.error(`Earlier acceptance failure — ${error.cause.message}`);
  process.exitCode = 1;
});
