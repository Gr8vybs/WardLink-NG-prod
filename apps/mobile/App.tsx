import React, { useEffect, useMemo, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { ApiClient } from "./src/api/client";
import { SecureTokenStore } from "./src/storage/secureTokenStore";
import { LoginScreen } from "./src/screens/LoginScreen";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { PatientDetailScreen } from "./src/screens/PatientDetailScreen";
import { ConflictListScreen } from "./src/screens/ConflictListScreen";
import { ConflictDetailScreen } from "./src/screens/ConflictDetailScreen";
import { colors } from "./src/theme/colors";
import type { Patient, Conflict } from "@wardlink/shared";

// Set this to your machine's LAN IP (not localhost) when testing on a
// physical phone via Expo Go — the phone can't reach your computer's
// "localhost". e.g. "http://192.168.1.23:3000"
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

type Screen = "dashboard" | "patientDetail" | "conflictList" | "conflictDetail";

export default function App() {
  const client = useMemo(
    () => new ApiClient({ baseUrl: API_BASE_URL, tokenStore: new SecureTokenStore() }),
    [],
  );
  const [checkingSession, setCheckingSession] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedConflict, setSelectedConflict] = useState<Conflict | null>(null);

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

  if (screen === "patientDetail" && selectedPatient) {
    return (
      <>
        <StatusBar style="dark" />
        <PatientDetailScreen
          client={client}
          patient={selectedPatient}
          onBack={() => setScreen("dashboard")}
        />
      </>
    );
  }

  if (screen === "conflictList") {
    return (
      <>
        <StatusBar style="dark" />
        <ConflictListScreen
          client={client}
          onBack={() => setScreen("dashboard")}
          onSelectConflict={(conflict) => {
            setSelectedConflict(conflict);
            setScreen("conflictDetail");
          }}
        />
      </>
    );
  }

  if (screen === "conflictDetail" && selectedConflict) {
    return (
      <>
        <StatusBar style="dark" />
        <ConflictDetailScreen
          client={client}
          conflict={selectedConflict}
          onBack={() => setScreen("conflictList")}
          onResolved={() => setScreen("conflictList")}
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
        onSelectPatient={(patient) => {
          setSelectedPatient(patient);
          setScreen("patientDetail");
        }}
        onOpenConflicts={() => setScreen("conflictList")}
      />
    </>
  );
}