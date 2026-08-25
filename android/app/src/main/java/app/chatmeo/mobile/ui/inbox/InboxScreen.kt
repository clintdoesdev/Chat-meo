package app.chatmeo.mobile.ui.inbox

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import app.chatmeo.mobile.data.api.dto.ConversationDto
import app.chatmeo.mobile.ui.inboxViewModelFactory
import app.chatmeo.mobile.ui.theme.ChatmeoBad
import app.chatmeo.mobile.ui.theme.ChatmeoMuted
import app.chatmeo.mobile.ui.theme.ChatmeoOk
import app.chatmeo.mobile.ui.theme.ChatmeoOrangeLight

@Composable
fun InboxScreen(onOpenConversation: (String) -> Unit) {
    val context = LocalContext.current
    val viewModel: InboxViewModel = viewModel(factory = inboxViewModelFactory(context))

    Column(modifier = Modifier.fillMaxSize()) {
        Box(modifier = Modifier.fillMaxWidth().padding(16.dp, 12.dp)) {
            Text("Inbox", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            IconButton(onClick = viewModel::refresh, modifier = Modifier.align(Alignment.CenterEnd)) {
                Icon(Icons.Filled.Refresh, contentDescription = "Refresh")
            }
        }

        when {
            viewModel.loading && viewModel.conversations.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
            viewModel.error != null && viewModel.conversations.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(viewModel.error ?: "", color = ChatmeoBad, modifier = Modifier.padding(24.dp))
            }
            viewModel.conversations.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No conversations yet.", color = ChatmeoMuted)
            }
            else -> LazyColumn(contentPadding = PaddingValues(bottom = 24.dp)) {
                items(viewModel.conversations, key = { it.id }) { conversation ->
                    ConversationRow(conversation, onClick = { onOpenConversation(conversation.id) })
                    HorizontalDivider(color = MaterialTheme.colorScheme.outline)
                }
            }
        }
    }
}

@Composable
private fun ConversationRow(conversation: ConversationDto, onClick: () -> Unit) {
    Surface(onClick = onClick, color = MaterialTheme.colorScheme.background) {
        Column(modifier = Modifier.fillMaxWidth().padding(16.dp, 12.dp)) {
            Box(modifier = Modifier.fillMaxWidth()) {
                Text(
                    conversation.botName,
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.align(Alignment.CenterStart),
                )
                if (conversation.status == "HANDOFF") {
                    Text(
                        "Needs a human",
                        style = MaterialTheme.typography.labelMedium,
                        color = ChatmeoOrangeLight,
                        modifier = Modifier.align(Alignment.CenterEnd),
                    )
                } else if (conversation.status == "RESOLVED") {
                    Text(
                        "Resolved",
                        style = MaterialTheme.typography.labelMedium,
                        color = ChatmeoOk,
                        modifier = Modifier.align(Alignment.CenterEnd),
                    )
                }
            }
            Text(
                conversation.visitorId,
                style = MaterialTheme.typography.labelMedium,
                color = ChatmeoMuted,
            )
            Text(
                conversation.lastMessagePreview,
                style = MaterialTheme.typography.bodyMedium,
                color = ChatmeoMuted,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
    }
}
