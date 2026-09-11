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

export function postWithProgress<T>(
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

// ─── Many files at once (changes-13 PR 6) ────────────────────

export interface QueuedUpload<T> {
  /** Stable across the queue's life — the File object itself is the identity, but React needs a key. */
  id: string;
  fileName: string;
  status: UploadStatus;
  progress: number;
  error: string | null;
  result: T | null;
}

/**
 * Uploading a folder of images used to mean picking one file, waiting,
 * picking the next. This queues them.
 *
 * Concurrency is 2, not "all of them": each upload holds its whole body in
 * the server's memory (`file.arrayBuffer()` in the route handler), so a
 * ten-wide fan-out is a self-inflicted memory spike on the exact operation
 * that already handles the largest payloads in the product. Two keeps a
 * slow connection busy without that.
 *
 * One failure does not cancel the batch — the failed row keeps its message
 * and its own Retry, and the rest carry on. A queue that abandons nine good
 * uploads because the tenth was a .docx would be worse than no queue.
 */
export function useUploadQueue<T>(url: string, options?: { concurrency?: number }) {
  const concurrency = options?.concurrency ?? 2;
  const [items, setItems] = useState<QueuedUpload<T>[]>([]);
  const nextId = useRef(0);

  const patch = useCallback((id: string, changes: Partial<QueuedUpload<T>>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }, []);

  const send = useCallback(
    async (id: string, file: File, fields?: Record<string, string>): Promise<T | undefined> => {
      const formData = new FormData();
      formData.set("file", file);
      for (const [key, value] of Object.entries(fields ?? {})) formData.set(key, value);
      patch(id, { status: "uploading", progress: 0, error: null });
      try {
        const result = await postWithProgress<T>(url, formData, (progress) =>
          patch(id, { progress }),
        );
        patch(id, { status: "success", progress: 100, result });
        return result;
      } catch (error: unknown) {
        patch(id, {
          status: "error",
          progress: 0,
          error: error instanceof Error ? error.message : String(error),
        });
        return undefined;
      }
    },
    [patch, url],
  );

  const enqueue = useCallback(
    async (files: File[], fields?: Record<string, string>): Promise<T[]> => {
      const queued = files.map((file) => ({
        id: `upload-${(nextId.current += 1)}`,
        file,
        fileName: file.name,
      }));
      setItems((current) => [
        ...current,
        ...queued.map(({ id, fileName }) => ({
          id,
          fileName,
          status: "idle" as UploadStatus,
          progress: 0,
          error: null,
          result: null,
        })),
      ]);

      const results: T[] = [];
      const pending = [...queued];
      // `concurrency` workers pulling from one list — a shared cursor, not a
      // chunked split, so a slow file never idles the other lane.
      const workers = Array.from({ length: Math.min(concurrency, pending.length) }, async () => {
        for (;;) {
          const next = pending.shift();
          if (!next) return;
          const result = await send(next.id, next.file, fields);
          if (result !== undefined) results.push(result);
        }
      });
      await Promise.all(workers);
      return results;
    },
    [concurrency, send],
  );

  const clearFinished = useCallback(() => {
    setItems((current) => current.filter((item) => item.status !== "success"));
  }, []);

  return { items, enqueue, clearFinished, active: items.some((i) => i.status === "uploading") };
}
