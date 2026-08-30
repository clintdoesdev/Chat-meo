package app.chatmeo.mobile.push

import app.chatmeo.mobile.data.ChatmeoRepository
import com.google.firebase.messaging.FirebaseMessaging
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine

/** Registers the device's current FCM token with the backend. Called right after a successful
 * login and on app startup for an already-signed-in user — a token may already exist from before
 * either of those (FCM issues one at install time), and ChatmeoMessagingService.onNewToken only
 * fires again on a genuine refresh, so this covers the gap without waiting on that. */
suspend fun registerCurrentFcmToken(repository: ChatmeoRepository) {
    val token = suspendCancellableCoroutine { continuation ->
        FirebaseMessaging.getInstance().token
            .addOnSuccessListener { continuation.resume(it) }
            .addOnFailureListener { continuation.resume(null) }
    }
    token?.let { repository.registerPushToken(it) }
}
