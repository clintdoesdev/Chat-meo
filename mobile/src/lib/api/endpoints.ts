import { apiFetch, API_BASE_URL } from "@/lib/api/client";
import { useAuthStore } from "@/store/auth";
import type {
  BotsResponse,
  ConversationDetailResponse,
  ConversationsResponse,
  ErrorResponse,
  LoginResponse,
  PushTestResponse,
} from "@/lib/api/types";

export function login(email: string, password: string, code?: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, code }),
  });
}

export function getBots(): Promise<BotsResponse> {
  return apiFetch<BotsResponse>("/api/v1/bots");
}

export function getConversations(): Promise<ConversationsResponse> {
  return apiFetch<ConversationsResponse>("/api/v1/conversations");
}

export function getMessages(conversationId: string): Promise<ConversationDetailResponse> {
  return apiFetch<ConversationDetailResponse>(`/api/v1/conversations/${conversationId}/messages`);
}

export function sendMessage(
  conversationId: string,
  content: string,
  replyToId?: string,
): Promise<ErrorResponse> {
  return apiFetch<ErrorResponse>(`/api/v1/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content, replyToId }),
  });
}

export function setConversationArchived(conversationId: string, archived: boolean): Promise<ErrorResponse> {
  return apiFetch<ErrorResponse>(`/api/v1/conversations/${conversationId}`, {
    method: "PATCH",
    body: JSON.stringify({ archived }),
  });
}

export function registerPushToken(token: string): Promise<ErrorResponse> {
  return apiFetch<ErrorResponse>("/api/v1/push/register", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function unregisterPushToken(token: string): Promise<ErrorResponse> {
  return apiFetch<ErrorResponse>("/api/v1/push/register", {
    method: "DELETE",
    body: JSON.stringify({ token }),
  });
}

export type PushTestResult =
  | { ok: true; result: PushTestResponse }
  | { ok: false; status: number; bodyText: string };

/** Bypasses apiFetch's throw-on-non-2xx + JSON-only parsing on purpose — this is a debug tool, so
 * it needs the raw status and raw body text (an HTML 404/500 page included) rather than apiFetch's
 * normal "Something went wrong" fallback, to actually tell a route-not-deployed-yet 404 apart from
 * a route-deployed-but-crashed 500. */
export async function sendTestPush(): Promise<PushTestResult> {
  const token = useAuthStore.getState().token;
  const response = await fetch(`${API_BASE_URL}/api/v1/push/test`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const bodyText = await response.text();
  if (!response.ok) return { ok: false, status: response.status, bodyText };
  try {
    return { ok: true, result: JSON.parse(bodyText) as PushTestResponse };
  } catch {
    return { ok: false, status: response.status, bodyText };
  }
}
