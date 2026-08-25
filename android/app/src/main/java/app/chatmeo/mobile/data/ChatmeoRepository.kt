package app.chatmeo.mobile.data

import app.chatmeo.mobile.data.api.ChatmeoApi
import app.chatmeo.mobile.data.api.dto.BotDto
import app.chatmeo.mobile.data.api.dto.ConversationDetailDto
import app.chatmeo.mobile.data.api.dto.ConversationDto
import app.chatmeo.mobile.data.api.dto.ErrorResponse
import app.chatmeo.mobile.data.api.dto.LoginRequest
import app.chatmeo.mobile.data.api.dto.RegisterPushTokenRequest
import app.chatmeo.mobile.data.api.dto.SendMessageRequest
import app.chatmeo.mobile.data.api.dto.UserDto
import java.io.IOException
import kotlinx.serialization.json.Json
import retrofit2.Response

sealed interface LoginOutcome {
    data class Success(val user: UserDto) : LoginOutcome
    data class TwoFactorRequired(val method: String) : LoginOutcome
    data class Error(val message: String) : LoginOutcome
}

private const val NETWORK_ERROR_MESSAGE = "Can't reach Chatmeo — check your connection."

/** The single place every screen goes through to talk to the backend — wraps ChatmeoApi
 * (Retrofit) with consistent error handling (network failure, non-2xx, malformed body) and owns
 * writing/clearing the session token, so no ViewModel has to know about HTTP status codes or
 * Retrofit's Response<T> directly. */
class ChatmeoRepository(
    private val api: ChatmeoApi,
    private val tokenStore: TokenStore,
) {
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun login(email: String, password: String, code: String? = null): LoginOutcome {
        return try {
            val response = api.login(LoginRequest(email, password, code))
            val body = response.body()
            when {
                response.isSuccessful && body?.token != null && body.user != null -> {
                    tokenStore.save(body.token)
                    LoginOutcome.Success(body.user)
                }
                response.isSuccessful && body?.requiresTwoFactor == true -> {
                    LoginOutcome.TwoFactorRequired(body.method ?: "EMAIL")
                }
                else -> LoginOutcome.Error(extractError(response) ?: body?.error ?: "Something went wrong — try again.")
            }
        } catch (error: IOException) {
            LoginOutcome.Error(NETWORK_ERROR_MESSAGE)
        }
    }

    suspend fun getBots(): ApiResult<List<BotDto>> =
        safeCall { api.getBots().let { it to it.body()?.bots } }

    suspend fun getConversations(): ApiResult<List<ConversationDto>> =
        safeCall { api.getConversations().let { it to it.body()?.conversations } }

    suspend fun getMessages(conversationId: String): ApiResult<ConversationDetailDto> =
        safeCall { api.getMessages(conversationId).let { it to it.body()?.conversation } }

    suspend fun sendMessage(conversationId: String, content: String, replyToId: String? = null): ApiResult<Unit> {
        return try {
            val response = api.sendMessage(conversationId, SendMessageRequest(content, replyToId))
            val body = response.body()
            if (response.isSuccessful && body?.error == null) {
                ApiResult.Success(Unit)
            } else {
                handleUnauthorized(response)
                ApiResult.Failure(extractError(response) ?: body?.error ?: "Couldn't send — try again.")
            }
        } catch (error: IOException) {
            ApiResult.Failure(NETWORK_ERROR_MESSAGE)
        }
    }

    suspend fun registerPushToken(token: String): ApiResult<Unit> {
        return try {
            val response = api.registerPushToken(RegisterPushTokenRequest(token))
            if (response.isSuccessful) {
                ApiResult.Success(Unit)
            } else {
                handleUnauthorized(response)
                ApiResult.Failure(extractError(response) ?: "Couldn't register for notifications.")
            }
        } catch (error: IOException) {
            ApiResult.Failure(NETWORK_ERROR_MESSAGE)
        }
    }

    suspend fun logout() = tokenStore.clear()

    private suspend fun <T> safeCall(block: suspend () -> Pair<Response<*>, T?>): ApiResult<T> {
        return try {
            val (response, data) = block()
            if (response.isSuccessful && data != null) {
                ApiResult.Success(data)
            } else {
                handleUnauthorized(response)
                ApiResult.Failure(extractError(response) ?: "Something went wrong — try again.")
            }
        } catch (error: IOException) {
            ApiResult.Failure(NETWORK_ERROR_MESSAGE)
        }
    }

    /** A 401 always means this token is dead (expired/invalid/rotated MOBILE_API_JWT_SECRET) —
     * clearing it here means the UI's own "is there a token?" check naturally routes back to the
     * login screen, instead of the same request just failing forever with a stale token. */
    private suspend fun handleUnauthorized(response: Response<*>) {
        if (response.code() == 401) tokenStore.clear()
    }

    private fun extractError(response: Response<*>): String? {
        val raw = response.errorBody()?.string() ?: return null
        return try {
            json.decodeFromString(ErrorResponse.serializer(), raw).error
        } catch (error: Exception) {
            null
        }
    }
}
