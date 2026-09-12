import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { ApiClient, ApiError } from "../api/client";
import { login, startDeviceSession } from "../api/auth";
import { colors } from "../theme/colors";

interface Props {
  client: ApiClient;
  onLoggedIn: () => void;
}

export function LoginScreen({ client, onLoggedIn }: Props) {
  const [mode, setMode] = useState<"individual" | "shared">("individual");
  const [staffId, setStaffId] = useState("");
  const [password, setPassword] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleIndividualLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await login(client, staffId.trim(), password);
      onLoggedIn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeviceStart = async () => {
    setError(null);
    setLoading(true);
    try {
      await startDeviceSession(client, deviceId.trim());
      onLoggedIn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start a session on this device.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Ward Link <Text style={{ color: colors.mint }}>NG</Text>
      </Text>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, mode === "individual" && styles.tabActive]}
          onPress={() => setMode("individual")}
        >
          <Text style={[styles.tabText, mode === "individual" && styles.tabTextActive]}>Personal login</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, mode === "shared" && styles.tabActive]}
          onPress={() => setMode("shared")}
        >
          <Text style={[styles.tabText, mode === "shared" && styles.tabTextActive]}>Shared device</Text>
        </TouchableOpacity>
      </View>

      {mode === "individual" ? (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Staff ID"
            placeholderTextColor={colors.inkFaint}
            autoCapitalize="none"
            value={staffId}
            onChangeText={setStaffId}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.inkFaint}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity style={styles.button} onPress={handleIndividualLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Device ID"
            placeholderTextColor={colors.inkFaint}
            autoCapitalize="none"
            value={deviceId}
            onChangeText={setDeviceId}
          />
          <Text style={styles.hint}>
            You'll confirm your own PIN before saving any handoff, note, or resolution on this device.
          </Text>
          {error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity style={styles.button} onPress={handleDeviceStart} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Start shift on this device</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy, justifyContent: "center", padding: 24 },
  title: { color: "#fff", fontSize: 22, fontWeight: "800", marginBottom: 24 },
  tabs: { flexDirection: "row", backgroundColor: "#0F3546", borderRadius: 12, padding: 4, marginBottom: 20 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  tabActive: { backgroundColor: colors.teal },
  tabText: { color: "#9FB4BF", fontSize: 12, fontWeight: "600" },
  tabTextActive: { color: "#fff" },
  form: { gap: 12 },
  input: {
    backgroundColor: "#0F3546",
    color: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  hint: { color: "#7E97A2", fontSize: 12, lineHeight: 18 },
  error: { color: "#FF9B8A", fontSize: 12 },
  button: {
    backgroundColor: colors.teal,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});