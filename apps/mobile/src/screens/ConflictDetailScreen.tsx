import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, ScrollView } from "react-native";
import { ApiClient, ApiError } from "../api/client";
import { getConflictDetail, resolveConflict, ConflictDetail } from "../api/conflict";
import type { Conflict } from "@wardlink/shared";
import { colors } from "../theme/colors";

interface Props {
  client: ApiClient;
  conflict: Conflict;
  onResolved: () => void;
  onBack: () => void;
}

export function ConflictDetailScreen({ client, conflict, onResolved, onBack }: Props) {
  const [detail, setDetail] = useState<ConflictDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedValue, setSelectedValue] = useState<string | null>(null);
  const [customValue, setCustomValue] = useState("");
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const result = await getConflictDetail(client, conflict.id);
        setDetail(result);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load conflict.");
      } finally {
        setLoading(false);
      }
    })();
  }, [client, conflict.id]);

  const handleResolve = async () => {
    const value = customValue.trim() || selectedValue;
    if (!value) return;
    setResolving(true);
    setError(null);
    try {
      await resolveConflict(client, conflict.id, value);
      onResolved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to resolve conflict.");
    } finally {
      setResolving(false);
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
        <Text style={styles.title}>Resolve conflict</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Two edits were made to this field without either device seeing the other's update. Pick the correct
            value or enter a merged reading.
          </Text>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        {detail?.competingOps.map((op) => (
          <TouchableOpacity
            key={op.id}
            style={[styles.optionCard, selectedValue === op.value && styles.optionCardSelected]}
            onPress={() => {
              setSelectedValue(op.value);
              setCustomValue("");
            }}
          >
            <Text style={styles.optionValue}>{op.value}</Text>
            <Text style={styles.optionMeta}>
              Device {op.hlc.deviceId.slice(0, 8)}… · {new Date(op.createdAt).toLocaleTimeString()}
            </Text>
          </TouchableOpacity>
        ))}

        <Text style={styles.orLabel}>— or —</Text>

        <TextInput
          style={styles.input}
          placeholder="Enter a merged / corrected value..."
          placeholderTextColor={colors.inkFaint}
          value={customValue}
          onChangeText={(text) => {
            setCustomValue(text);
            setSelectedValue(null);
          }}
        />

        <TouchableOpacity
          style={[styles.button, !(selectedValue || customValue.trim()) && styles.buttonDisabled]}
          onPress={handleResolve}
          disabled={resolving || !(selectedValue || customValue.trim())}
        >
          {resolving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Confirm resolution</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" },
  header: { backgroundColor: colors.navy, padding: 16, paddingTop: 48 },
  back: { color: "#8FE0C4", fontSize: 13, marginBottom: 8 },
  title: { color: "#fff", fontSize: 18, fontWeight: "700" },
  banner: { backgroundColor: colors.tealSoft, borderRadius: 10, padding: 12, marginBottom: 16 },
  bannerText: { fontSize: 12, color: colors.amber, lineHeight: 17 },
  error: { color: colors.red, marginBottom: 10 },
  optionCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: colors.border,
  },
  optionCardSelected: { borderColor: colors.teal },
  optionValue: { fontSize: 15, color: colors.ink, fontWeight: "600" },
  optionMeta: { fontSize: 11, color: colors.inkFaint, marginTop: 4 },
  orLabel: { textAlign: "center", color: colors.inkFaint, fontSize: 12, marginVertical: 6 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.ink,
    marginBottom: 16,
  },
  button: { backgroundColor: colors.teal, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  buttonDisabled: { backgroundColor: colors.border },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});