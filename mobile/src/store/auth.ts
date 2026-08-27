import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import type { UserDto } from "@/lib/api/types";

const TOKEN_KEY = "chatmeo_auth_token";
const USER_KEY = "chatmeo_auth_user";

type AuthState = {
  token: string | null;
  user: UserDto | null;
  /** False until hydrate() has run once — the root layout holds the splash screen up on this so
   * it never flashes the login screen for an already-signed-in user before SecureStore has had a
   * chance to answer. */
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  setSession: (token: string, user: UserDto) => Promise<void>;
  logout: () => void;
};

/** Persists the mobile API's Bearer token (see src/lib/mobile-auth/token.ts on the server side)
 * across app restarts via expo-secure-store (Keychain/Keystore-backed), same role TokenStore
 * plays in the Kotlin sibling app. Kept as a Zustand store — not React Context — so apiFetch
 * (client.ts) can read the current token synchronously outside of any component via
 * useAuthStore.getState(), the same way every screen's data layer needs to. */
export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isHydrated: false,

  hydrate: async () => {
    const [token, userJson] = await Promise.all([
      SecureStore.getItemAsync(TOKEN_KEY),
      SecureStore.getItemAsync(USER_KEY),
    ]);
    set({
      token,
      user: userJson ? (JSON.parse(userJson) as UserDto) : null,
      isHydrated: true,
    });
  },

  setSession: async (token, user) => {
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, token),
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
    ]);
    set({ token, user });
  },

  logout: () => {
    set({ token: null, user: null });
    SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    SecureStore.deleteItemAsync(USER_KEY).catch(() => {});
  },
}));
