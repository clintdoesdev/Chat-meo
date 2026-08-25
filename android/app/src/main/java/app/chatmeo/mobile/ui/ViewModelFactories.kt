package app.chatmeo.mobile.ui

import android.content.Context
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import app.chatmeo.mobile.ChatmeoApplication
import app.chatmeo.mobile.ui.bots.BotsViewModel
import app.chatmeo.mobile.ui.conversation.ConversationViewModel
import app.chatmeo.mobile.ui.inbox.InboxViewModel
import app.chatmeo.mobile.ui.login.LoginViewModel

fun Context.chatmeoApp(): ChatmeoApplication = applicationContext as ChatmeoApplication

// Hand-rolled factories rather than a DI framework — see ChatmeoApplication's doc comment for
// why. ConversationViewModel takes its own factory function (below) since it needs a
// conversationId only known at the call site, not something a single shared factory can supply.

fun loginViewModelFactory(context: Context): ViewModelProvider.Factory = viewModelFactory {
    initializer { LoginViewModel(context.chatmeoApp().repository) }
}

fun inboxViewModelFactory(context: Context): ViewModelProvider.Factory = viewModelFactory {
    initializer { InboxViewModel(context.chatmeoApp().repository) }
}

fun botsViewModelFactory(context: Context): ViewModelProvider.Factory = viewModelFactory {
    initializer { BotsViewModel(context.chatmeoApp().repository) }
}

fun conversationViewModelFactory(context: Context, conversationId: String): ViewModelProvider.Factory = viewModelFactory {
    initializer { ConversationViewModel(context.chatmeoApp().repository, conversationId) }
}
