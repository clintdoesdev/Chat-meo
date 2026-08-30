package app.chatmeo.mobile

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.lifecycleScope
import app.chatmeo.mobile.push.registerCurrentFcmToken
import app.chatmeo.mobile.ui.navigation.ChatmeoNavHost
import app.chatmeo.mobile.ui.navigation.ROUTE_HOME
import app.chatmeo.mobile.ui.navigation.ROUTE_LOGIN
import app.chatmeo.mobile.ui.theme.ChatmeoTheme
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private val notificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { /* no-op either way — a
            declined permission just means no push notifications, not a broken app. */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        val splashScreen = installSplashScreen()
        super.onCreate(savedInstanceState)

        var startDestination by mutableStateOf<String?>(null)
        splashScreen.setKeepOnScreenCondition { startDestination == null }

        lifecycleScope.launch {
            val app = application as ChatmeoApplication
            val existingToken = app.tokenStore.token.first()
            startDestination = if (existingToken != null) ROUTE_HOME else ROUTE_LOGIN
            // Covers a device token issued (or refreshed) while the app had no active session to
            // register it against — cheap no-op registration otherwise.
            if (existingToken != null) registerCurrentFcmToken(app.repository)
        }

        requestNotificationPermissionIfNeeded()

        setContent {
            ChatmeoTheme {
                startDestination?.let { destination ->
                    ChatmeoNavHost(startDestination = destination)
                }
            }
        }
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        val alreadyGranted = ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
        if (!alreadyGranted) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }
}
