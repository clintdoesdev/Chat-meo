package app.chatmeo.mobile.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import app.chatmeo.mobile.ui.HomeScreen
import app.chatmeo.mobile.ui.conversation.ConversationScreen
import app.chatmeo.mobile.ui.login.LoginScreen

const val ROUTE_LOGIN = "login"
const val ROUTE_HOME = "home"
private const val ROUTE_CONVERSATION = "conversation/{conversationId}"

@Composable
fun ChatmeoNavHost(startDestination: String, navController: NavHostController = rememberNavController()) {
    NavHost(navController = navController, startDestination = startDestination) {
        composable(ROUTE_LOGIN) {
            LoginScreen(
                onLoggedIn = {
                    navController.navigate(ROUTE_HOME) {
                        popUpTo(ROUTE_LOGIN) { inclusive = true }
                    }
                },
            )
        }
        composable(ROUTE_HOME) {
            HomeScreen(onOpenConversation = { id -> navController.navigate("conversation/$id") })
        }
        composable(
            ROUTE_CONVERSATION,
            arguments = listOf(navArgument("conversationId") { type = NavType.StringType }),
        ) { backStackEntry ->
            val id = backStackEntry.arguments?.getString("conversationId") ?: return@composable
            ConversationScreen(conversationId = id, onBack = { navController.popBackStack() })
        }
    }
}
