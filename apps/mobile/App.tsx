import React, { useEffect, useMemo, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { ApiClient } from "./src/api/client";
import { SecureTokenStore } from "./src/storage/secureTokenStore";
import { LoginScreen } from "./src/screens/LoginScreen";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { colors } from "./src/theme/colors";

// Set this to your machine's LAN IP (not localhost) when testing on a
// physical phone via Expo Go — the phone can't reach your computer's
// "localhost". e.g. "http://192.168.1.23:3000"
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export default function App() {
  const client = useMemo(
    () => new ApiClient({ baseUrl: API_BASE_URL, tokenStore: new SecureTokenStore() }),
    [],
  );
  const [checkingSession, setCheckingSession] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  // On launch, if a token is already stored from a previous session,
  // skip straight to the dashboard instead of asking to log in again.
  useEffect(() => {
    (async () => {
      const token = await client.tokenStore.getToken();
      setLoggedIn(!!token);
      setCheckingSession(false);
    })();
  }, [client]);

  if (checkingSession) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.navy }}>
        <ActivityIndicator color={colors.mint} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      {loggedIn ? (
        <DashboardScreen client={client} onLoggedOut={() => setLoggedIn(false)} />
      ) : (
        <LoginScreen client={client} onLoggedIn={() => setLoggedIn(true)} />
      )}
    </>
  );
}