package app.chatmeo.mobile.ui.bots

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import app.chatmeo.mobile.data.api.dto.BotDto
import app.chatmeo.mobile.ui.botsViewModelFactory
import app.chatmeo.mobile.ui.theme.ChatmeoBad
import app.chatmeo.mobile.ui.theme.ChatmeoMuted
import app.chatmeo.mobile.ui.theme.ChatmeoOk

@Composable
fun BotsScreen() {
    val context = LocalContext.current
    val viewModel: BotsViewModel = viewModel(factory = botsViewModelFactory(context))

    Column(modifier = Modifier.fillMaxSize()) {
        Text(
            "Your bots",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.fillMaxWidth().padding(16.dp, 12.dp),
        )

        when {
            viewModel.loading && viewModel.bots.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
            viewModel.error != null && viewModel.bots.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(viewModel.error ?: "", color = ChatmeoBad, modifier = Modifier.padding(24.dp))
            }
            viewModel.bots.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No bots yet — create one on chatmeo.app.", color = ChatmeoMuted)
            }
            else -> LazyColumn(contentPadding = PaddingValues(bottom = 24.dp)) {
                items(viewModel.bots, key = { it.id }) { bot ->
                    BotRow(bot)
                    HorizontalDivider(color = MaterialTheme.colorScheme.outline)
                }
            }
        }
    }
}

@Composable
private fun BotRow(bot: BotDto) {
    Surface(color = MaterialTheme.colorScheme.background) {
        Column(modifier = Modifier.fillMaxWidth().padding(16.dp, 12.dp)) {
            Text(bot.name, style = MaterialTheme.typography.titleMedium)
            Text(
                if (bot.status == "LIVE") "Live" else "Draft",
                style = MaterialTheme.typography.labelMedium,
                color = if (bot.status == "LIVE") ChatmeoOk else ChatmeoMuted,
            )
        }
    }
}
