package app.chatmeo.mobile.ui.conversation

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.chatmeo.mobile.data.ApiResult
import app.chatmeo.mobile.data.ChatmeoRepository
import app.chatmeo.mobile.data.api.dto.ConversationDetailDto
import kotlinx.coroutines.launch

class ConversationViewModel(
    private val repository: ChatmeoRepository,
    private val conversationId: String,
) : ViewModel() {
    var conversation by mutableStateOf<ConversationDetailDto?>(null)
        private set
    var loading by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set
    var draft by mutableStateOf("")
    var sending by mutableStateOf(false)
        private set
    var sendError by mutableStateOf<String?>(null)
        private set

    init {
        refresh()
    }

    fun refresh() {
        loading = true
        error = null
        viewModelScope.launch {
            when (val result = repository.getMessages(conversationId)) {
                is ApiResult.Success -> conversation = result.data
                is ApiResult.Failure -> error = result.message
            }
            loading = false
        }
    }

    fun send() {
        val content = draft.trim()
        if (content.isEmpty() || sending) return
        sending = true
        sendError = null
        viewModelScope.launch {
            when (val result = repository.sendMessage(conversationId, content)) {
                is ApiResult.Success -> {
                    draft = ""
                    refresh()
                }
                is ApiResult.Failure -> sendError = result.message
            }
            sending = false
        }
    }
}
