/**
 * SHINE — self-hosted React hooks.
 *
 * Provides `useQuery`, `useMutation`, `useAction` that work exactly like
 * their Convex counterparts but route through the self-hosted NestJS API.
 *
 * - `useQuery` fetches on mount/args-change and re-fetches on a configurable
 *   poll interval (default 10s) to approximate reactive data.
 * - `useMutation`/`useAction` send POST/PUT/DELETE requests.
 * - Auth tokens are attached automatically by the ShineAPI client.
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { api as shineApi } from "@/hooks/use-api";
import type { ApiFn } from "./api";

export { api } from "./api";

interface NotifyFn {
  _notify?: (data: any) => void;
}

function toQueryString(args: Record<string, any> | undefined, keys?: string[]): string {
  if (!args || !keys || keys.length === 0) return "";
  const parts: string[] = [];
  for (const k of keys) {
    const v = args[k];
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      v.forEach((item) => parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(item))}`));
    } else {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

function toPath(url: string, args: Record<string, any> | undefined, pathParams?: string[]): string {
  if (!args || !pathParams) return url;
  let resolved = url;
  for (const p of pathParams) {
    const value = args[p];
    if (value !== undefined && value !== null) {
      resolved = resolved.replace(`:${p}`, encodeURIComponent(String(value)));
    }
  }
  return resolved;
}

export type QueryArgs = Record<string, any> | "skip" | null | undefined;

/**
 * useQuery — mirrors Convex's reactive query hook.
 * Fetches data on mount and when args change; re-fetches every pollMs.
 * Returns `undefined` while first loading, `null` on error. Passing `"skip"`
 * (Convex convention) disables the query and returns `undefined`.
 */
export function useQuery(fn: ApiFn, args?: QueryArgs, opts?: { pollMs?: number }): any {
  const [data, setData] = useState<any>(undefined);
  const pollMs = opts?.pollMs ?? 10000;

  const run = useCallback(async () => {
    try {
      if (args === "skip" || args === null || args === undefined) {
        setData(undefined);
        return undefined;
      }
      const url = toPath(fn._url, args, fn._pathParams) + toQueryString(args, fn._queryParams);
      const result = await shineApi.request(url);
      setData(result);
      return result;
    } catch (err: any) {
      console.warn("[SHINE] useQuery error:", err?.message);
      setData(null);
      return null;
    }
  }, [fn, JSON.stringify(args ?? {})]);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    const doFetch = async () => {
      if (cancelled) return;
      await run();
    };

    doFetch();
    if (pollMs > 0) {
      interval = setInterval(() => {
        if (!cancelled) run();
      }, pollMs);
    }

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [run, pollMs]);

  // Allow external "notifyDataChanged" pushes from the Socket.IO layer.
  useEffect(() => {
    (fn as NotifyFn)._notify = (d: any) => setData(d);
    return () => {
      delete (fn as NotifyFn)._notify;
    };
  }, [fn]);

  return data;
}

/** Raw fetch helper for imperative data reads. */
export function query(fn: ApiFn, args?: Record<string, any>): Promise<any> {
  const url = toPath(fn._url, args, fn._pathParams) + toQueryString(args, fn._queryParams);
  return shineApi.request(url);
}

/**
 * useMutation — mirrors Convex's mutation hook.
 * Returns an async function that sends the request to the API.
 */
export function useMutation<T extends (...args: any[]) => any>(fn: ApiFn) {
  const mutate = useCallback(
    async (...callArgs: any[]) => {
      const arg = callArgs[0] ?? {};
      const url = toPath(fn._url, arg, fn._pathParams);
      const method = fn._method;
      const sendBody = fn._body !== false;

      if (method === "DELETE") {
        return shineApi.request(url, { method: "DELETE" });
      }
      if (method === "PUT") {
        return shineApi.request(url, { method: "PUT", body: sendBody ? arg : undefined });
      }
      if (method === "PATCH") {
        return shineApi.request(url, { method: "PATCH", body: sendBody ? arg : undefined });
      }
      // POST
      return shineApi.request(url, { method: "POST", body: sendBody ? arg : undefined });
    },
    [fn],
  );
  return mutate as T;
}

/**
 * useAction — same as useMutation for our REST-backed app.
 */
export function useAction<T extends (...args: any[]) => any>(fn: ApiFn) {
  return useMutation<T>(fn);
}

/**
 * Minimal ConvexReactClient stub (auth providers elsewhere).
 */
export class ConvexReactClient {
  constructor(_url: string) {}
}

/** Re-export helper for imperative query calls. */
export const queryHelper = query;