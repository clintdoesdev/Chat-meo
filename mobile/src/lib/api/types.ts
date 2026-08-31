/** Mirrors src/app/api/v1/**\/route.ts's JSON shapes exactly (same contract the Kotlin native app
 * uses — see mobile's Android sibling under android/app/.../data/api/dto/Dto.kt). Extra fields the
 * backend adds later are simply ignored by TypeScript's structural typing — no ignoreUnknownKeys
 * flag needed like on the Kotlin side. */

import type { FlowGraph } from "@/lib/flow/types";

export type UserDto = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
};

export type LoginResponse = {
  token?: string;
  user?: UserDto;
  requiresTwoFactor?: boolean;
  method?: string;
  error?: string;
};

export type ErrorResponse = {
  error?: string;
};

export type BotDto = {
  id: string;
  name: string;
  slug: string;
  status: string;
  avatarUrl?: string | null;
  primaryColor?: string | null;
  conversationCount: number;
};

export type BotsResponse = {
  bots: BotDto[];
};

export type ConversationDto = {
  id: string;
  botName: string;
  botSlug: string;
  status: "OPEN" | "RESOLVED" | "HANDOFF";
  visitorId: string;
  messageCount: number;
  lastMessageAt: string;
  lastMessagePreview: string;
  lastMessageRole: "BOT" | "USER" | "AGENT" | null;
  archived: boolean;
  blocked: boolean;
  folderId?: string | null;
  channel: "WHATSAPP" | "WEB";
};

export type ConversationsResponse = {
  conversations: ConversationDto[];
};

export type MessageContentTypeDto = "TEXT" | "IMAGE" | "DOCUMENT" | "VIDEO" | "AUDIO";

export type QuotedMessageDto = {
  id: string;
  role: "BOT" | "USER" | "AGENT";
  content: string;
  contentType: MessageContentTypeDto;
  caption?: string | null;
  fileName?: string | null;
};

export type MessageDto = {
  id: string;
  role: "BOT" | "USER" | "AGENT";
  content: string;
  contentType: MessageContentTypeDto;
  caption?: string | null;
  // Only ever set for a DOCUMENT message — see Message.fileName's schema doc comment (web repo).
  fileName?: string | null;
  createdAt: string;
  starred: boolean;
  replyToId?: string | null;
  // A snapshot of the quoted message, for rendering the quote inline — null unless this message
  // is a reply to another one still around (see ConversationDetail["messages"][number].replyTo's
  // doc comment on the web side).
  replyTo?: QuotedMessageDto | null;
  customerReaction?: string | null;
  agentReaction?: string | null;
  deliveryStatus?: string | null;
  forwarded: boolean;
};

export type ConversationDetailDto = {
  id: string;
  status: "OPEN" | "RESOLVED" | "HANDOFF";
  visitorId: string;
  createdAt: string;
  archived: boolean;
  blocked: boolean;
  folderId?: string | null;
  channel: "WHATSAPP" | "WEB";
  botName: string;
  botSlug: string;
  messages: MessageDto[];
};

export type ConversationDetailResponse = {
  conversation: ConversationDetailDto;
};

export type WebPushDiagnostics =
  | { configured: false; configError: string | null }
  | { configured: true; subscriptionCount: number; sent: number; failed: { statusCode?: number; message: string }[] };

export type FcmDiagnostics =
  | { configured: false; configError: string | null }
  | { configured: true; tokenCount: number; sent: number; failed: { code?: string; message: string }[] };

export type PushTestResponse = {
  webPush: WebPushDiagnostics;
  fcm: FcmDiagnostics;
};

export type FlowResponse = {
  flowId: string;
  graph: FlowGraph;
};

export type Trend = { percent: number; direction: "up" | "down" };

export type ChatsStartedBuckets = { today: number; yesterday: number; last7Days: number; last30Days: number };

export type OverviewStatsResponse = {
  botsCount: number;
  conversationsCount: number;
  conversationsTrend: Trend | null;
  conversationsSpark: number[];
  resolutionRate: number | null;
  resolutionTrend: Trend | null;
  messagesCount: number;
  messagesThisMonth: number;
  messagesTrend: Trend | null;
  messagesSpark: number[];
  chatsStarted: ChatsStartedBuckets;
};

export type WhatsAppConnectionDto = {
  status: "CONNECTED" | "DISCONNECTED" | "TOKEN_EXPIRED" | "BANNED";
  isActive: boolean;
  displayPhoneNumber: string;
  connectedAt: string;
};

export type WhatsAppConnectConfigResponse = {
  configured: boolean;
  connection: WhatsAppConnectionDto | null;
};
