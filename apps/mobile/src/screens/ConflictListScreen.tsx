import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, FlatList } from "react-native";
import { ApiClient, ApiError } from "../api/client";
import { listOpenConflicts } from "../api/conflict";
import type { Conflict } from "@wardlink/shared";
import { colors } from "../theme/colors";

interface Props {
  client: ApiClient;
  onBack: () => void;
  onSelectConflict: (conflict: Conflict) => void;
}

export function ConflictListScreen({ client, onBack, onSelectConflict }: Props) {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listOpenConflicts(client);
      setConflicts(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load conflicts.");
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Ward Oversight</Text>
        <Text style={styles.subtitle}>Open and escalated conflicts</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.teal} />
        </View>
      ) : (
        <FlatList
          data={conflicts}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          refreshing={loading}
          onRefresh={load}
          ListEmptyComponent={<Text style={styles.empty}>No open conflicts right now.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, item.status === "escalated" && styles.cardEscalated]}
              onPress={() => onSelectConflict(item)}
            >
              <View style={styles.cardTop}>
                <Text style={[styles.statusTag, item.status === "escalated" && styles.statusTagEscalated]}>
                  {item.status.toUpperCase()}
                </Text>
                <Text style={styles.openedAt}>{new Date(item.openedAt).toLocaleString()}</Text>
              </View>
              <Text style={styles.fieldId}>Field: {item.fieldId.slice(0, 8)}…</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { backgroundColor: colors.navy, padding: 16, paddingTop: 48 },
  back: { color: "#8FE0C4", fontSize: 13, marginBottom: 8 },
  title: { color: "#fff", fontSize: 18, fontWeight: "700" },
  subtitle: { color: "#8FA9B5", fontSize: 12, marginTop: 2 },
  empty: { color: colors.inkFaint, textAlign: "center", marginTop: 40 },
  error: { color: colors.red, padding: 16 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.amber,
  },
  cardEscalated: {
    borderColor: colors.red,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  statusTag: { fontSize: 10, fontWeight: "700", color: colors.amber },
  statusTagEscalated: { color: colors.red },
  openedAt: { fontSize: 10, color: colors.inkFaint },
  fieldId: { fontSize: 12, color: colors.inkSoft },
});