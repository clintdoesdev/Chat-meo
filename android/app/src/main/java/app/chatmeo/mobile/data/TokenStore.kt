package app.chatmeo.mobile.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "chatmeo_session")

private val TOKEN_KEY = stringPreferencesKey("auth_token")

/** Persists the mobile API's Bearer token (see src/lib/mobile-auth/token.ts on the server side)
 * across app restarts. DataStore rather than SharedPreferences — same durability, but backed by
 * Kotlin Flow/coroutines instead of a synchronous, main-thread-unsafe API. */
class TokenStore(private val context: Context) {
    val token: Flow<String?> = context.dataStore.data.map { it[TOKEN_KEY] }

    suspend fun save(token: String) {
        context.dataStore.edit { it[TOKEN_KEY] = token }
    }

    suspend fun clear() {
        context.dataStore.edit { it.remove(TOKEN_KEY) }
    }
}
