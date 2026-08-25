package app.chatmeo.mobile.ui.inbox

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.chatmeo.mobile.data.ApiResult
import app.chatmeo.mobile.data.ChatmeoRepository
import app.chatmeo.mobile.data.api.dto.ConversationDto
import kotlinx.coroutines.launch

class InboxViewModel(private val repository: ChatmeoRepository) : ViewModel() {
    var conversations by mutableStateOf<List<ConversationDto>>(emptyList())
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
            when (val result = repository.getConversations()) {
                is ApiResult.Success -> conversations = result.data
                is ApiResult.Failure -> error = result.message
            }
            loading = false
        }
    }
}
