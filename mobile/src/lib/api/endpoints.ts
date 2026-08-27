import { apiFetch } from "@/lib/api/client";
import type {
  BotsResponse,
  ConversationDetailResponse,
  ConversationsResponse,
  ErrorResponse,
  LoginResponse,
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
