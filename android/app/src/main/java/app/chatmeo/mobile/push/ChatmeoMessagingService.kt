package app.chatmeo.mobile.push

import android.app.PendingIntent
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import app.chatmeo.mobile.ChatmeoApplication
import app.chatmeo.mobile.MainActivity
import app.chatmeo.mobile.R
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlin.random.Random
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

/** Receives FCM token refreshes and incoming push messages. Registered as the default
 * FirebaseMessagingService via AndroidManifest.xml's <service> entry (no intent-filter override
 * needed — Firebase discovers it that way). */
class ChatmeoMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // onNewToken can fire before the user has ever logged in (a token is generated at
        // install time) — registerIfLoggedIn silently no-ops in that case; MainActivity registers
        // the then-current token again right after a successful login to cover that gap.
        // No goAsync() here — that's a BroadcastReceiver API, not available on Service (which
        // FirebaseMessagingService extends); FCM already keeps the process alive around this
        // callback long enough for a short suspend call like this one.
        CoroutineScope(Dispatchers.IO).launch {
            registerIfLoggedIn(token)
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        // Supports both a `notification` payload (sendable straight from the Firebase console,
        // useful for testing before the server-side sender exists) and a data-only payload (what
        // the backend will send once wired, since that's the only form delivered to
        // onMessageReceived while the app is in the foreground).
        val title = message.notification?.title ?: message.data["title"] ?: "Chatmeo"
        val body = message.notification?.body ?: message.data["body"] ?: return

        val openAppIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val contentIntent = PendingIntent.getActivity(
            this,
            0,
            openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(this, ChatmeoApplication.NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setColor(getColor(R.color.chatmeo_orange))
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(contentIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        NotificationManagerCompat.from(this).notify(Random.nextInt(), notification)
    }

    private suspend fun registerIfLoggedIn(fcmToken: String) {
        val app = application as ChatmeoApplication
        if (app.tokenStore.token.first() == null) return
        app.repository.registerPushToken(fcmToken)
    }
}
