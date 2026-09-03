import { apiFetch, API_BASE_URL } from "@/lib/api/client";
import { useAuthStore } from "@/store/auth";
import type {
  BotsResponse,
  ConversationDetailResponse,
  ConversationsResponse,
  ErrorResponse,
  FlowResponse,
  LoginResponse,
  OverviewStatsResponse,
  PushTestResponse,
  WhatsAppConnectConfigResponse,
} from "@/lib/api/types";
import type { FlowGraph } from "@/lib/flow/types";

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

/** Permanent — the API route (and the confirmation dialog in front of this call) is the only
 * safety net, same as the web Inbox's own delete action. */
export function deleteConversation(conversationId: string): Promise<ErrorResponse> {
  return apiFetch<ErrorResponse>(`/api/v1/conversations/${conversationId}`, { method: "DELETE" });
}

export function getFlow(botId: string): Promise<FlowResponse> {
  return apiFetch<FlowResponse>(`/api/v1/bots/${botId}/flow`);
}

export function saveFlow(botId: string, flowId: string, graph: FlowGraph): Promise<ErrorResponse> {
  return apiFetch<ErrorResponse>(`/api/v1/bots/${botId}/flow`, {
    method: "PATCH",
    body: JSON.stringify({ flowId, graph }),
  });
}

export function getOverviewStats(): Promise<OverviewStatsResponse> {
  // The device's own IANA timezone (e.g. "Africa/Lagos") — so "Today"/"Yesterday" and the daily
  // sparklines line up with this phone's own midnight, not the server's. Falls back to whatever
  // the server itself defaults to (UTC) if Hermes can't resolve one, which normalizeTimeZone on
  // the server side already handles for an empty/missing param.
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const query = timeZone ? `?tz=${encodeURIComponent(timeZone)}` : "";
  return apiFetch<OverviewStatsResponse>(`/api/v1/stats/overview${query}`);
}

export function getWhatsAppConnection(botId: string): Promise<WhatsAppConnectConfigResponse> {
  return apiFetch<WhatsAppConnectConfigResponse>(`/api/v1/bots/${botId}/whatsapp`);
}

export function setWhatsAppActive(botId: string, isActive: boolean): Promise<ErrorResponse> {
  return apiFetch<ErrorResponse>(`/api/v1/bots/${botId}/whatsapp`, {
    method: "PATCH",
    body: JSON.stringify({ isActive }),
  });
}

export function disconnectWhatsApp(botId: string): Promise<ErrorResponse> {
  return apiFetch<ErrorResponse>(`/api/v1/bots/${botId}/whatsapp`, {
    method: "PATCH",
    body: JSON.stringify({ disconnect: true }),
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
