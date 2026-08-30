import { useAuthStore } from "@/store/auth";

// Baked in at build time rather than read from a runtime config service — a native app has no
// server-rendered page to read an env var from, so this is the same reasoning as the Android
// sibling app's BuildConfig.API_BASE_URL (android/app/build.gradle.kts): public by definition
// once it ships in an installed app, so there's nothing gained by indirecting through an env var.
export const API_BASE_URL = "https://chatmeo.app";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** The one place every screen's data layer goes through — attaches the Bearer token, parses JSON,
 * and normalizes a non-2xx response into a thrown ApiError with whatever message the server sent
 * (see src/app/api/v1/**\/route.ts's { error } shape). A 401 always means this token is dead
 * (expired/invalid/rotated MOBILE_API_JWT_SECRET) — clearing it here means the UI's own "is there
 * a session?" check naturally routes back to login, instead of the same request just failing
 * forever with a stale token. Mirrors ChatmeoRepository's role in the Kotlin app. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = useAuthStore.getState().token;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(0, "Can't reach Chatmeo — check your connection.");
  }

  if (response.status === 401) {
    useAuthStore.getState().logout();
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, body?.error ?? "Something went wrong — try again.");
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
