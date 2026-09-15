import React, { useEffect, useMemo, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { ApiClient } from "./src/api/client";
import { SecureTokenStore } from "./src/storage/secureTokenStore";
import { LoginScreen } from "./src/screens/LoginScreen";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { PatientDetailScreen } from "./src/screens/PatientDetailScreen";
import { colors } from "./src/theme/colors";
import type { Patient } from "@wardlink/shared";

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
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

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

  if (!loggedIn) {
    return (
      <>
        <StatusBar style="light" />
        <LoginScreen client={client} onLoggedIn={() => setLoggedIn(true)} />
      </>
    );
  }

  if (selectedPatient) {
    return (
      <>
        <StatusBar style="dark" />
        <PatientDetailScreen
          client={client}
          patient={selectedPatient}
          onBack={() => setSelectedPatient(null)}
        />
      </>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <DashboardScreen
        client={client}
        onLoggedOut={() => setLoggedIn(false)}
        onSelectPatient={setSelectedPatient}
      />
    </>
  );
}