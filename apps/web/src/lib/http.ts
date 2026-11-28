import { NextResponse } from "next/server";
import type { ApiError } from "./contract";

export function apiError(
  status: number,
  code: ApiError["error"]["code"],
  message: string,
  headers: Record<string, string> = {},
) {
  return NextResponse.json<ApiError>(
    { error: { code, message } },
    { status, headers: { "Cache-Control": "no-store", ...headers } },
  );
}
