import { api } from "@/convex/api";

export interface UploadResult {
  storageId: string;
  /** Full URL usable in <img>/<a>/<video> — set when self-hosted storage is used. */
  url?: string;
  name: string;
  mimeType: string;
  size: number;
  kind: string;
}

/**
 * Base for the self-hosted API. Same origin in production (Caddy proxies
 * /api/* to the NestJS API → MinIO). Override in dev with VITE_API_URL.
 */
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api";

/**
 * Prepare a profile picture before upload: decode it client-side and, when
 * needed, downscale + re-encode to WebP/JPEG. This fixes the classic avatar
 * failures: HEIC photos from phones (browsers can't render them in <img>),
 * and multi-megapixel images that are slow or exceed size limits.
 */
export async function prepareAvatarImage(file: File, maxDim = 1024): Promise<File> {
  const type = file.type.toLowerCase();
  const isDecodable = type === "image/jpeg" || type === "image/png" || type === "image/webp";

  if (isDecodable && file.size <= 5 * 1024 * 1024) {
    // Still check dimensions so gigantic-but-small PNGs get tamed.
    try {
      const dims = await imageDimensions(file);
      if (dims.width <= maxDim && dims.height <= maxDim) {
        return file;
      }
    } catch {
      return file;
    }
  }

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    // Browser can't decode this image at all (e.g. HEIC).
    throw new Error(
      "This photo format isn't supported by your browser — please use JPG, PNG or WebP.",
    );
  }

  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not process this image");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob =
    (await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.88),
    )) ??
    (await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9),
    ));
  if (!blob) throw new Error("Could not process this image");

  const baseName = file.name.replace(/\.[^.]+$/, "") || "avatar";
  return new File([blob], `${baseName}.webp`, {
    type: "image/webp",
    lastModified: Date.now(),
  });
}

function imageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Not an image"));
    };
    img.src = url;
  });
}

function kindFor(mime: string, name: string): string {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "pdf";
  if (mime.includes("sheet") || mime.includes("excel")) return "sheet";
  if (mime.includes("word") || mime.includes("document")) return "doc";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "slides";
  if (mime.includes("zip") || mime.includes("compressed")) return "archive";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["txt", "md", "json", "csv"].includes(ext)) return "text";
  return "file";
}

function selfHostedUploadUrl(file: { name: string; type: string }): string {
  const q = new URLSearchParams({
    name: file.name,
    mime: file.type || "application/octet-stream",
  });
  return `${API_BASE}/storage/upload?${q.toString()}`;
}

/**
 * Fail-fast liveness probe for the self-hosted storage API. Uses a short
 * timeout and an AbortController so a dead / misconfigured backend is
 * detected in milliseconds instead of hanging the whole upload. Returns null
 * when the API is unreachable so callers can fall back to Convex storage.
 */
export async function probeSelfHostedStorage(timeoutMs = 2500): Promise<{
  ok: boolean;
  detail: string;
  latencyMs: number | null;
} | null> {
  const startedAt = performance.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${API_BASE}/storage/ping`, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);
    const body = await res.json().catch(() => ({}));
    return {
      ok: res.ok && body.ok !== false,
      detail: body.detail ?? (res.ok ? "reachable" : `HTTP ${res.status}`),
      latencyMs: Math.round(performance.now() - startedAt),
    };
  } catch {
    return null;
  }
}

/** Upload to the self-hosted API (NestJS → MinIO). Returns null when the API
 *  is unreachable so callers can fall back to Convex storage. */
async function uploadSelfHosted(
  body: Blob,
  name: string,
  mimeType: string,
  onProgress?: (pct: number) => void,
): Promise<UploadResult | null> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", selfHostedUploadUrl({ name, type: mimeType }));
    xhr.setRequestHeader("Content-Type", mimeType || "application/octet-stream");
    xhr.timeout = 120_000; // hard cap so a hung backend can't stall the chat
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const body = JSON.parse(xhr.responseText);
          resolve({
            storageId: body.storageId ?? body.id ?? "",
            url: body.url ?? "",
            name: body.name ?? name,
            mimeType: body.mimeType ?? mimeType,
            size: body.size ?? body.blobSize ?? 0,
            kind: kindFor(body.mimeType ?? mimeType, body.name ?? name),
          });
        } catch {
          resolve(null);
        }
      } else {
        resolve(null);
      }
    };
    xhr.onerror = () => resolve(null);
    xhr.onabort = () => resolve(null);
    xhr.ontimeout = () => resolve(null);
    xhr.send(body);
  });
}

export async function uploadFile(
  file: File,
  generateUploadUrl: () => Promise<string>,
  onProgress?: (pct: number) => void,
): Promise<UploadResult> {
  // 1) Self-hosted MinIO (via the API) — primary in production. Probe first so
  // a dead backend fails fast instead of swallowing a long request timeout.
  const probe = await probeSelfHostedStorage();
  if (probe && probe.ok) {
    const selfHosted = await uploadSelfHosted(file, file.name, file.type, onProgress);
    if (selfHosted && selfHosted.storageId) return selfHosted;
  }

  // 2) Fallback: Convex cloud storage (protocol: POST with raw body).
  const uploadUrl = await generateUploadUrl();
  const storageId = await new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.timeout = 120_000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const body = xhr.responseText ? JSON.parse(xhr.responseText) : {};
        resolve(body.storageId ?? body.id ?? xhr.responseText);
      } else {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.ontimeout = () => reject(new Error("Upload timed out — the storage backend is unreachable"));
    xhr.send(file);
  });
  return {
    storageId,
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    kind: kindFor(file.type, file.name),
  };
}

/** Voice recording → upload helper. */
export async function uploadBlob(
  blob: Blob,
  name: string,
  mimeType: string,
  generateUploadUrl: () => Promise<string>,
): Promise<UploadResult> {
  const selfHosted = await uploadSelfHosted(blob, name, mimeType);
  if (selfHosted && selfHosted.storageId) return selfHosted;

  const uploadUrl = await generateUploadUrl();
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": mimeType || "audio/webm" },
    body: blob,
  });
  if (!res.ok) throw new Error("Upload failed");
  const body = await res.json().catch(() => ({}));
  return {
    storageId: body.storageId ?? body.id ?? "",
    name,
    mimeType: mimeType || "audio/webm",
    size: blob.size,
    kind: "audio",
  };
}
