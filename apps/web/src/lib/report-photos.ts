import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const REPORT_PHOTOS_BUCKET = "report-photos";

export async function uploadReportPhoto(client: SupabaseClient, photo: Buffer) {
  const key = `reports/${randomUUID()}.jpg`;
  try {
    const { error } = await client.storage.from(REPORT_PHOTOS_BUCKET).upload(key, photo, {
      contentType: "image/jpeg",
      cacheControl: "0",
      upsert: false,
    });
    if (!error) return key;
    if (error.status !== undefined && error.status < 500) return null;
  } catch {
    // Storage may have accepted the object before the response was lost.
  }
  await removeUnreferencedReportPhoto(client, key);
  return null;
}

export async function removeUnreferencedReportPhoto(client: SupabaseClient, key: string) {
  try {
    const { error } = await client.storage.from(REPORT_PHOTOS_BUCKET).remove([key]);
    if (error) console.error("report photo cleanup failed");
  } catch {
    console.error("report photo cleanup failed");
  }
}
