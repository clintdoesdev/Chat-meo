package app.chatmeo.mobile.ui.login

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.chatmeo.mobile.data.ChatmeoRepository
import app.chatmeo.mobile.data.LoginOutcome
import kotlinx.coroutines.launch

enum class LoginStep { CREDENTIALS, TWO_FACTOR }

class LoginViewModel(private val repository: ChatmeoRepository) : ViewModel() {
    var step by mutableStateOf(LoginStep.CREDENTIALS)
        private set
    var email by mutableStateOf("")
    var password by mutableStateOf("")
    var code by mutableStateOf("")
    var twoFactorMethod by mutableStateOf<String?>(null)
        private set
    var loading by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set
    var loggedIn by mutableStateOf(false)
        private set

    fun submit() {
        if (loading) return
        loading = true
        error = null
        viewModelScope.launch {
            val outcome = repository.login(
                email.trim(),
                password,
                if (step == LoginStep.TWO_FACTOR) code.trim() else null,
            )
            loading = false
            when (outcome) {
                is LoginOutcome.Success -> loggedIn = true
                is LoginOutcome.TwoFactorRequired -> {
                    step = LoginStep.TWO_FACTOR
                    twoFactorMethod = outcome.method
                }
                is LoginOutcome.Error -> error = outcome.message
            }
        }
    }
}
