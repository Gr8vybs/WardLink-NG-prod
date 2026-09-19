import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, FlatList } from "react-native";
import { ApiClient, ApiError } from "../api/client";
import { listFacilityDirectory, FacilityDirectoryEntry } from "../api/facility";
import { sendReferral } from "../api/referral";
import type { Patient } from "@wardlink/shared";
import { colors } from "../theme/colors";

interface Props {
  client: ApiClient;
  patient: Patient;
  onBack: () => void;
  onSent: () => void;
}

export function SendReferralScreen({ client, patient, onBack, onSent }: Props) {
  const [directory, setDirectory] = useState<FacilityDirectoryEntry[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<FacilityDirectoryEntry | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const result = await listFacilityDirectory(client);
        setDirectory(result);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load facility directory.");
      } finally {
        setLoading(false);
      }
    })();
  }, [client]);

  const handleSend = async () => {
    if (!selectedFacility || !reason.trim()) return;
    setSending(true);
    setError(null);
    try {
      await sendReferral(client, patient.id, selectedFacility.id, reason.trim());
      onSent();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send referral.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Refer {patient.demographics.name}</Text>
      </View>

      <View style={{ flex: 1, padding: 16 }}>
        {error && <Text style={styles.error}>{error}</Text>}

        <Text style={styles.sectionLabel}>DESTINATION FACILITY</Text>
        <FlatList
          data={directory}
          keyExtractor={(f) => f.id}
          style={{ maxHeight: 200 }}
          ListEmptyComponent={<Text style={styles.empty}>No other facilities found.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.facilityRow, selectedFacility?.id === item.id && styles.facilityRowSelected]}
              onPress={() => setSelectedFacility(item)}
            >
              <Text style={styles.facilityName}>{item.name}</Text>
              <Text style={styles.facilityType}>{item.type}</Text>
            </TouchableOpacity>
          )}
        />

        <Text style={[styles.sectionLabel, { marginTop: 16 }]}>REASON FOR REFERRAL</Text>
        <TextInput
          style={styles.reasonInput}
          placeholder="e.g. Suspected appendicitis, needs surgical review"
          placeholderTextColor={colors.inkFaint}
          multiline
          value={reason}
          onChangeText={setReason}
        />

        <TouchableOpacity
          style={[styles.button, !(selectedFacility && reason.trim()) && styles.buttonDisabled]}
          onPress={handleSend}
          disabled={sending || !(selectedFacility && reason.trim())}
        >
          {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send referral</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" },
  header: { backgroundColor: colors.navy, padding: 16, paddingTop: 48 },
  back: { color: "#8FE0C4", fontSize: 13, marginBottom: 8 },
  title: { color: "#fff", fontSize: 18, fontWeight: "700" },
  error: { color: colors.red, marginBottom: 10 },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: colors.inkFaint, letterSpacing: 0.5, marginBottom: 8 },
  empty: { color: colors.inkFaint, fontSize: 13 },
  facilityRow: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  facilityRowSelected: { borderColor: colors.teal, borderWidth: 2 },
  facilityName: { fontSize: 13, color: colors.ink, fontWeight: "600" },
  facilityType: { fontSize: 11, color: colors.inkFaint },
  reasonInput: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.ink,
    marginBottom: 16,
  },
  button: { backgroundColor: colors.teal, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  buttonDisabled: { backgroundColor: colors.border },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});