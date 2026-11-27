import { NextResponse } from "next/server";
import type { ApiError } from "./contract";

export function apiError(
  status: number,
  code: ApiError["error"]["code"],
  message: string,
) {
  return NextResponse.json<ApiError>({ error: { code, message } }, { status });
}
