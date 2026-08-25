package app.chatmeo.mobile.ui.conversation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import app.chatmeo.mobile.data.api.dto.MessageDto
import app.chatmeo.mobile.ui.conversationViewModelFactory
import app.chatmeo.mobile.ui.theme.ChatmeoBad
import app.chatmeo.mobile.ui.theme.ChatmeoMuted
import app.chatmeo.mobile.ui.theme.ChatmeoOrange
import app.chatmeo.mobile.ui.theme.ChatmeoSurface

@Composable
fun ConversationScreen(conversationId: String, onBack: () -> Unit) {
    val context = LocalContext.current
    val viewModel: ConversationViewModel = viewModel(
        key = conversationId,
        factory = conversationViewModelFactory(context, conversationId),
    )
    val listState = rememberLazyListState()

    LaunchedEffect(viewModel.conversation?.messages?.size) {
        val count = viewModel.conversation?.messages?.size ?: 0
        if (count > 0) listState.animateScrollToItem(count - 1)
    }

    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth().padding(4.dp, 4.dp),
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.Filled.ArrowBack, contentDescription = "Back")
            }
            Column(modifier = Modifier.padding(start = 4.dp)) {
                Text(
                    viewModel.conversation?.botName ?: "Conversation",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    viewModel.conversation?.visitorId ?: "",
                    style = MaterialTheme.typography.labelMedium,
                    color = ChatmeoMuted,
                )
            }
        }

        when {
            viewModel.loading && viewModel.conversation == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
            viewModel.error != null && viewModel.conversation == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(viewModel.error ?: "", color = ChatmeoBad, modifier = Modifier.padding(24.dp))
            }
            else -> LazyColumn(
                state = listState,
                modifier = Modifier.weight(1f).fillMaxWidth(),
                contentPadding = PaddingValues(12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(viewModel.conversation?.messages.orEmpty(), key = { it.id }) { message ->
                    MessageBubble(message)
                }
            }
        }

        if (viewModel.conversation != null) {
            ReplyBar(
                draft = viewModel.draft,
                onDraftChange = { viewModel.draft = it },
                sending = viewModel.sending,
                error = viewModel.sendError,
                onSend = viewModel::send,
            )
        }
    }
}

@Composable
private fun MessageBubble(message: MessageDto) {
    val fromCustomer = message.role == "USER"
    Box(modifier = Modifier.fillMaxWidth()) {
        Surface(
            color = if (fromCustomer) ChatmeoSurface else ChatmeoOrange,
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier
                .align(if (fromCustomer) Alignment.CenterStart else Alignment.CenterEnd)
                .widthIn(max = 280.dp),
        ) {
            Text(
                text = if (message.contentType == "IMAGE") (message.caption ?: "📷 Photo") else message.content,
                color = if (fromCustomer) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onPrimary,
                style = MaterialTheme.typography.bodyLarge,
                modifier = Modifier.padding(12.dp, 8.dp),
            )
        }
    }
}

@Composable
private fun ReplyBar(
    draft: String,
    onDraftChange: (String) -> Unit,
    sending: Boolean,
    error: String?,
    onSend: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().imePadding().padding(8.dp)) {
        error?.let { Text(it, color = ChatmeoBad, style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(bottom = 4.dp)) }
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            OutlinedTextField(
                value = draft,
                onValueChange = onDraftChange,
                placeholder = { Text("Type a message…") },
                modifier = Modifier.weight(1f),
                maxLines = 4,
            )
            IconButton(onClick = onSend, enabled = !sending && draft.isNotBlank()) {
                if (sending) {
                    CircularProgressIndicator(modifier = Modifier.padding(4.dp))
                } else {
                    Icon(Icons.Filled.Send, contentDescription = "Send", tint = ChatmeoOrange)
                }
            }
        }
    }
}
