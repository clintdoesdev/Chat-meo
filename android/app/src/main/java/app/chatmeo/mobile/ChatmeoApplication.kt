package app.chatmeo.mobile

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import app.chatmeo.mobile.data.ChatmeoRepository
import app.chatmeo.mobile.data.TokenStore
import app.chatmeo.mobile.data.api.ApiClient

class ChatmeoApplication : Application() {
    // Simple hand-rolled singletons rather than a DI framework (Hilt/Koin) — the object graph
    // here is small (one token store, one API client, one repository) and static for the app's
    // whole lifetime, so a DI framework would add build complexity without buying much.
    lateinit var tokenStore: TokenStore
        private set
    lateinit var repository: ChatmeoRepository
        private set

    override fun onCreate() {
        super.onCreate()
        tokenStore = TokenStore(this)
        repository = ChatmeoRepository(ApiClient.create(tokenStore), tokenStore)
        createNotificationChannel()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val channel = NotificationChannel(
            NOTIFICATION_CHANNEL_ID,
            "Messages",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "New customer messages and \"needs a human\" alerts"
            enableVibration(true)
            // Uses the system default notification sound rather than a bundled custom one —
            // simplest correct choice until there's an actual branded sound asset to ship.
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    companion object {
        const val NOTIFICATION_CHANNEL_ID = "chatmeo_messages"
    }
}
