package app.chatmeo.mobile.ui.bots

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.chatmeo.mobile.data.ApiResult
import app.chatmeo.mobile.data.ChatmeoRepository
import app.chatmeo.mobile.data.api.dto.BotDto
import kotlinx.coroutines.launch

class BotsViewModel(private val repository: ChatmeoRepository) : ViewModel() {
    var bots by mutableStateOf<List<BotDto>>(emptyList())
        private set
    var loading by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set

    init {
        refresh()
    }

    fun refresh() {
        loading = true
        error = null
        viewModelScope.launch {
            when (val result = repository.getBots()) {
                is ApiResult.Success -> bots = result.data
                is ApiResult.Failure -> error = result.message
            }
            loading = false
        }
    }
}
