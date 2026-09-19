import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, FlatList } from "react-native";
import { ApiClient } from "../api/client";
import { getMyFacility, listPatients } from "../api/facility";
import { decodeJwtPayload } from "../auth/decodeToken";
import type { Facility, Patient } from "@wardlink/shared";
import { colors } from "../theme/colors";

interface Props {
  client: ApiClient;
  onLoggedOut: () => void;
  onSelectPatient: (patient: Patient) => void;
  onOpenConflicts: () => void;
  onOpenReferrals: () => void;
}

export function DashboardScreen({ client, onLoggedOut, onSelectPatient, onOpenConflicts, onOpenReferrals }: Props) {
  const [facility, setFacility] = useState<Facility | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canSeeOversight, setCanSeeOversight] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const token = await client.tokenStore.getToken();
        const payload = token ? decodeJwtPayload(token) : null;
        setCanSeeOversight(payload?.role === "ward_head" || payload?.role === "director");

        const [fac, pts] = await Promise.all([getMyFacility(client), listPatients(client)]);
        setFacility(fac);
        setPatients(pts);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load ward data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [client]);

  const handleLogout = async () => {
    await client.logout();
    onLoggedOut();
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
        <View>
          <Text style={styles.title}>My Ward</Text>
          <Text style={styles.subtitle}>{facility?.name ?? "Unknown facility"}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={onOpenReferrals} style={{ marginBottom: 6 }}>
            <Text style={styles.oversightLink}>Referrals</Text>
          </TouchableOpacity>
          {canSeeOversight && (
            <TouchableOpacity onPress={onOpenConflicts} style={{ marginBottom: 6 }}>
              <Text style={styles.oversightLink}>Oversight</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleLogout}>
            <Text style={styles.logout}>Log out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={patients}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListEmptyComponent={<Text style={styles.empty}>No patients yet.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => onSelectPatient(item)}>
            <Text style={styles.patientName}>{item.demographics.name}</Text>
            <Text style={styles.patientMeta}>
              {item.demographics.age}
              {item.demographics.sex} · Allergy: {item.demographics.allergies}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" },
  header: {
    backgroundColor: colors.navy,
    padding: 16,
    paddingTop: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerActions: { alignItems: "flex-end" },
  title: { color: "#fff", fontSize: 18, fontWeight: "700" },
  subtitle: { color: "#8FA9B5", fontSize: 12, marginTop: 2 },
  logout: { color: "#8FE0C4", fontSize: 12, fontWeight: "600" },
  oversightLink: { color: colors.mint, fontSize: 12, fontWeight: "700" },
  error: { color: colors.red, padding: 16 },
  empty: { color: colors.inkFaint, textAlign: "center", marginTop: 40 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  patientName: { fontSize: 15, fontWeight: "700", color: colors.ink },
  patientMeta: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
});