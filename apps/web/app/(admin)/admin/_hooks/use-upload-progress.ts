"use client";

// Real-time upload percentage needs a transport the browser can observe
// bytes leaving on — `fetch` exposes no request-body progress for a
// FormData POST, which is why every upload surface used to call its
// server action directly with no progress at all. XMLHttpRequest's
// `upload.onprogress` is the one API that gives us this, so these hooks
// POST to a thin route handler under `admin/api/uploads/*` that calls the
// exact same @repo/core function the equivalent server action calls.
import { useCallback, useEffect, useRef, useState } from "react";

export type UploadStatus = "idle" | "uploading" | "success" | "error";

export interface UseUploadProgressState<T> {
  status: UploadStatus;
  /** 0-100, meaningful only while `status === "uploading"`. */
  progress: number;
  error: string | null;
  result: T | null;
  fileName: string | null;
}

const IDLE_STATE = {
  status: "idle",
  progress: 0,
  error: null,
  result: null,
  fileName: null,
} as const;

function postWithProgress<T>(
  url: string,
  formData: FormData,
  onProgress: (percent: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response as T);
        return;
      }
      const message =
        (xhr.response as { error?: string } | null)?.error ?? `Upload failed (${xhr.status})`;
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error("Upload failed — check your connection and try again."));
    xhr.send(formData);
  });
}

/**
 * `url` is one of the `admin/api/uploads/*` route handlers. `T` is that
 * route's JSON success shape (`StoredImage` / `StoredMediaAsset`).
 * `autoResetMs`, if given, returns the state to idle that long after a
 * successful upload — long enough for the success state to register as
 * "clearly shown" without leaving a stale panel around indefinitely.
 */
export function useUploadProgress<T>(url: string, options?: { autoResetMs?: number }) {
  const [state, setState] = useState<UseUploadProgressState<T>>(IDLE_STATE);
  const pendingRef = useRef<{ file: File; fields?: Record<string, string> } | null>(null);
  const autoResetMs = options?.autoResetMs;

  const upload = useCallback(
    (file: File, fields?: Record<string, string>): Promise<T | undefined> => {
      pendingRef.current = { file, fields };
      const formData = new FormData();
      formData.set("file", file);
      if (fields) {
        for (const [key, value] of Object.entries(fields)) formData.set(key, value);
      }

      setState({
        status: "uploading",
        progress: 0,
        error: null,
        result: null,
        fileName: file.name,
      });
      return postWithProgress<T>(url, formData, (progress) =>
        setState((s) => (s.status === "uploading" ? { ...s, progress } : s)),
      )
        .then((result) => {
          setState({ status: "success", progress: 100, error: null, result, fileName: file.name });
          return result;
        })
        .catch((error: unknown) => {
          setState({
            status: "error",
            progress: 0,
            error: error instanceof Error ? error.message : String(error),
            result: null,
            fileName: file.name,
          });
          return undefined;
        });
    },
    [url],
  );

  const retry = useCallback((): Promise<T | undefined> => {
    const pending = pendingRef.current;
    return pending ? upload(pending.file, pending.fields) : Promise.resolve(undefined);
  }, [upload]);

  const reset = useCallback(() => setState(IDLE_STATE), []);

  useEffect(() => {
    if (state.status !== "success" || !autoResetMs) return;
    const timer = setTimeout(() => setState(IDLE_STATE), autoResetMs);
    return () => clearTimeout(timer);
  }, [state.status, autoResetMs]);

  return { ...state, upload, retry, reset };
}
