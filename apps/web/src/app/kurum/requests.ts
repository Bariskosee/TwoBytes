"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiError } from "@/lib/contract";

export const REQUEST_ERROR = "İşlem tamamlanamadı. Lütfen tekrar deneyin.";

export class InstitutionRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function institutionRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, { ...options, cache: "no-store" });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiError | null;
    throw new InstitutionRequestError(response.status, body?.error?.message ?? REQUEST_ERROR);
  }
  return response.json() as Promise<T>;
}

type Resource<T> = {
  path: string;
  data: T | null;
  error: string | null;
};

export function useInstitutionResource<T>(
  path: string,
  revision: number,
  onSessionExpired: () => void,
  paused = false,
) {
  const [resource, setResource] = useState<Resource<T>>({ path, data: null, error: null });
  const inFlight = useRef<AbortController | null>(null);

  const cancel = useCallback(() => inFlight.current?.abort(), []);
  const apply = useCallback((data: T) => setResource({ path, data, error: null }), [path]);

  useEffect(() => {
    if (paused) return;
    const request = new AbortController();
    inFlight.current = request;
    institutionRequest<T>(path, { signal: request.signal })
      .then((data) => {
        if (!request.signal.aborted) apply(data);
      })
      .catch((error: unknown) => {
        if (request.signal.aborted) return;
        if (error instanceof InstitutionRequestError) {
          if (error.status === 401) {
            onSessionExpired();
            return;
          }
          setResource((previous) => ({
            path,
            data: previous.path !== path || error.status === 403 || error.status === 404 ? null : previous.data,
            error: error.message,
          }));
        } else {
          setResource((previous) => ({
            path,
            data: previous.path === path ? previous.data : null,
            error: REQUEST_ERROR,
          }));
        }
      });
    return () => request.abort();
  }, [apply, onSessionExpired, path, paused, revision]);

  const current = resource.path === path ? resource : { data: null, error: null };
  return { data: current.data, error: current.error, apply, cancel };
}
