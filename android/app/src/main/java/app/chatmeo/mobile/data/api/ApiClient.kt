package app.chatmeo.mobile.data.api

import app.chatmeo.mobile.BuildConfig
import app.chatmeo.mobile.data.TokenStore
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory

object ApiClient {
    private val json = Json {
        // The server's DTOs (src/app/api/v1/**) will keep growing fields (message.replyTo,
        // token usage, etc.) that this app doesn't model yet — without this, any new field the
        // backend adds breaks every existing native install until it's updated.
        ignoreUnknownKeys = true
    }

    fun create(tokenStore: TokenStore): ChatmeoApi {
        val authInterceptor = Interceptor { chain ->
            // OkHttp interceptors run on their own background dispatcher, never the main thread
            // — blocking here for a local DataStore read (an on-disk preferences file, not a
            // network call) is the standard, safe way to bridge a suspend-based token store into
            // OkHttp's synchronous interceptor chain.
            val token = runBlocking { tokenStore.token.first() }
            val request = chain.request().newBuilder()
                .apply { if (token != null) addHeader("Authorization", "Bearer $token") }
                .build()
            chain.proceed(request)
        }

        val loggingInterceptor = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BASIC else HttpLoggingInterceptor.Level.NONE
        }

        val client = OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(loggingInterceptor)
            .build()

        return Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
            .create(ChatmeoApi::class.java)
    }
}
