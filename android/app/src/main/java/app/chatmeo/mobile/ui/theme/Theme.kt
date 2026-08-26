package app.chatmeo.mobile.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// The Meo brand gradient's two stops (src/components/shared-defs.tsx) and the dark canvas the
// web app itself uses (see Studio's #0C0C0C canvas background) — Chatmeo's native shell is
// deliberately dark-only for now rather than following system light/dark, same reasoning as
// themes.xml's Theme.Chatmeo.
val ChatmeoOrange = Color(0xFFFF5C16)
val ChatmeoOrangeLight = Color(0xFFFF7A2F)
val ChatmeoBackground = Color(0xFF0C0C0C)
val ChatmeoSurface = Color(0xFF161616)
val ChatmeoBorder = Color(0xFF2A2A2A)
val ChatmeoMuted = Color(0xFF9A9A9A)
val ChatmeoBad = Color(0xFFE5484D)
val ChatmeoOk = Color(0xFF3DD68C)

private val ChatmeoColorScheme = darkColorScheme(
    primary = ChatmeoOrange,
    onPrimary = Color.White,
    secondary = ChatmeoOrangeLight,
    background = ChatmeoBackground,
    onBackground = Color.White,
    surface = ChatmeoSurface,
    onSurface = Color.White,
    surfaceVariant = ChatmeoSurface,
    onSurfaceVariant = ChatmeoMuted,
    outline = ChatmeoBorder,
    error = ChatmeoBad,
)

@Composable
fun ChatmeoTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = ChatmeoColorScheme,
        typography = ChatmeoTypography,
    ) {
        // Without this Surface, LocalContentColor never gets set from the color scheme (it
        // defaults to plain black regardless of theme) — every Text() without an explicit color
        // was rendering black-on-near-black, unreadable. Surface(color = background) is what
        // actually wires background/onBackground into text's default color, same as the
        // Scaffold-based screens already got for free from Scaffold's own internal Surface.
        Surface(color = MaterialTheme.colorScheme.background, content = content)
    }
}
