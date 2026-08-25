package app.chatmeo.mobile.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import app.chatmeo.mobile.ui.bots.BotsScreen
import app.chatmeo.mobile.ui.inbox.InboxScreen

private enum class HomeTab { INBOX, BOTS }

/** The signed-in landing screen — a bottom-nav shell over Inbox (the reason someone would reach
 * for this on their phone: replying to a customer, checking a "Needs a human" alert) and Bots
 * (a lighter-weight list; anything beyond viewing bot names/status still happens on the web app
 * for now — see the "Follow-up" tasks for Flow Studio/Settings/WhatsApp connect/Python Bot). */
@Composable
fun HomeScreen(onOpenConversation: (String) -> Unit) {
    var tab by remember { mutableStateOf(HomeTab.INBOX) }

    Scaffold(
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = tab == HomeTab.INBOX,
                    onClick = { tab = HomeTab.INBOX },
                    icon = { Icon(Icons.Filled.Chat, contentDescription = null) },
                    label = { Text("Inbox") },
                )
                NavigationBarItem(
                    selected = tab == HomeTab.BOTS,
                    onClick = { tab = HomeTab.BOTS },
                    icon = { Icon(Icons.Filled.Person, contentDescription = null) },
                    label = { Text("Bots") },
                )
            }
        },
    ) { padding ->
        val content = @Composable {
            when (tab) {
                HomeTab.INBOX -> InboxScreen(onOpenConversation = onOpenConversation)
                HomeTab.BOTS -> BotsScreen()
            }
        }
        Box(modifier = Modifier.padding(padding)) {
            content()
        }
    }
}
