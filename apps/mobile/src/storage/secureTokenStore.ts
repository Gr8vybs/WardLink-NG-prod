import * as SecureStore from "expo-secure-store";
import type { TokenStore } from "../api/client";

const TOKEN_KEY = "wardlink_access_token";

/**
 * The real app's token storage. Uses expo-secure-store (iOS Keychain /
 * Android Keystore), NOT AsyncStorage — AsyncStorage is unencrypted
 * plain-text storage, which is not where a JWT carrying facility and
 * role claims belongs, even for a portfolio build.
 */
export class SecureTokenStore implements TokenStore {
  async getToken(): Promise<string | null> {
    return SecureStore.getItemAsync(TOKEN_KEY);
  }

  async setToken(token: string | null): Promise<void> {
    if (token) {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  }
}