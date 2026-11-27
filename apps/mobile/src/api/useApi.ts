import { useCallback, useEffect, useState } from "react";
import { type ApiResult, describeError } from "./client";

export type LoadState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: T; sample: boolean };

/** `load` modül düzeyinde sabit bir fonksiyon olmalı (ör. getMap). */
export function useApi<T>(load: () => Promise<ApiResult<T>>) {
  const [state, setState] = useState<LoadState<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    load()
      .then((result) => {
        if (active) setState({ status: "success", data: result.data, sample: result.sample });
      })
      .catch((error: unknown) => {
        if (active) setState({ status: "error", message: describeError(error) });
      });
    return () => {
      active = false;
    };
  }, [load, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { state, reload };
}
