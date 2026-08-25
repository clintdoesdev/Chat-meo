package app.chatmeo.mobile.data.api.dto

import kotlinx.serialization.Serializable

// Mirrors src/app/api/v1/**/route.ts's JSON shapes exactly — see each route for the
// authoritative definition. ignoreUnknownKeys is on (ApiClient.kt) so a field this file doesn't
// model (e.g. a message's `replyTo` snapshot) is just dropped rather than crashing parsing.

@Serializable
data class LoginRequest(val email: String, val password: String, val code: String? = null)

@Serializable
data class LoginResponse(
    val token: String? = null,
    val user: UserDto? = null,
    val requiresTwoFactor: Boolean? = null,
    val method: String? = null,
    val error: String? = null,
)

@Serializable
data class UserDto(val id: String, val name: String, val email: String, val image: String? = null)

@Serializable
data class BotDto(
    val id: String,
    val name: String,
    val slug: String,
    val status: String,
    val avatarUrl: String? = null,
    val primaryColor: String? = null,
)

@Serializable
data class BotsResponse(val bots: List<BotDto>)

@Serializable
data class ConversationDto(
    val id: String,
    val botName: String,
    val botSlug: String,
    val status: String,
    val visitorId: String,
    val messageCount: Int,
    val lastMessageAt: String,
    val lastMessagePreview: String,
    val lastMessageRole: String? = null,
    val archived: Boolean,
    val blocked: Boolean,
    val folderId: String? = null,
    val channel: String,
)

@Serializable
data class ConversationsResponse(val conversations: List<ConversationDto>)

@Serializable
data class MessageDto(
    val id: String,
    val role: String,
    val content: String,
    val contentType: String,
    val caption: String? = null,
    val createdAt: String,
    val starred: Boolean,
    val replyToId: String? = null,
    val customerReaction: String? = null,
    val agentReaction: String? = null,
    val deliveryStatus: String? = null,
    val forwarded: Boolean,
)

@Serializable
data class ConversationDetailDto(
    val id: String,
    val status: String,
    val visitorId: String,
    val createdAt: String,
    val archived: Boolean,
    val blocked: Boolean,
    val folderId: String? = null,
    val channel: String,
    val botName: String,
    val botSlug: String,
    val messages: List<MessageDto>,
)

@Serializable
data class ConversationDetailResponse(val conversation: ConversationDetailDto)

@Serializable
data class SendMessageRequest(val content: String, val replyToId: String? = null)

@Serializable
data class ErrorResponse(val error: String? = null)

@Serializable
data class RegisterPushTokenRequest(val token: String)
