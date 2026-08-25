package app.chatmeo.mobile.data.api

import app.chatmeo.mobile.data.api.dto.BotsResponse
import app.chatmeo.mobile.data.api.dto.ConversationDetailResponse
import app.chatmeo.mobile.data.api.dto.ConversationsResponse
import app.chatmeo.mobile.data.api.dto.ErrorResponse
import app.chatmeo.mobile.data.api.dto.LoginRequest
import app.chatmeo.mobile.data.api.dto.LoginResponse
import app.chatmeo.mobile.data.api.dto.RegisterPushTokenRequest
import app.chatmeo.mobile.data.api.dto.SendMessageRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/** Thin 1:1 mirror of src/app/api/v1/**/route.ts. */
interface ChatmeoApi {
    @POST("api/v1/auth/login")
    suspend fun login(@Body body: LoginRequest): Response<LoginResponse>

    @GET("api/v1/bots")
    suspend fun getBots(): Response<BotsResponse>

    @GET("api/v1/conversations")
    suspend fun getConversations(): Response<ConversationsResponse>

    @GET("api/v1/conversations/{id}/messages")
    suspend fun getMessages(@Path("id") conversationId: String): Response<ConversationDetailResponse>

    @POST("api/v1/conversations/{id}/messages")
    suspend fun sendMessage(@Path("id") conversationId: String, @Body body: SendMessageRequest): Response<ErrorResponse>

    @POST("api/v1/push/register")
    suspend fun registerPushToken(@Body body: RegisterPushTokenRequest): Response<ErrorResponse>
}
