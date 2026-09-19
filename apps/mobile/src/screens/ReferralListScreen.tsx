import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, FlatList } from "react-native";
import { ApiClient, ApiError } from "../api/client";
import { listOutgoingReferrals, listIncomingReferrals, claimReferral } from "../api/referral";
import type { Referral } from "@wardlink/shared";
import { colors } from "../theme/colors";

interface Props {
  client: ApiClient;
  onBack: () => void;
}

export function ReferralListScreen({ client, onBack }: Props) {
  const [tab, setTab] = useState<"outgoing" | "incoming">("outgoing");
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = tab === "outgoing" ? await listOutgoingReferrals(client) : await listIncomingReferrals(client);
      setReferrals(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load referrals.");
    } finally {
      setLoading(false);
    }
  }, [client, tab]);

  useEffect(() => {
    load();
  }, [load]);

  const handleClaim = async (referralId: string) => {
    setClaimingId(referralId);
    setError(null);
    try {
      await claimReferral(client, referralId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to claim referral.");
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Referrals</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === "outgoing" && styles.tabActive]}
          onPress={() => setTab("outgoing")}
        >
          <Text style={[styles.tabText, tab === "outgoing" && styles.tabTextActive]}>Sent by us</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "incoming" && styles.tabActive]}
          onPress={() => setTab("incoming")}
        >
          <Text style={[styles.tabText, tab === "incoming" && styles.tabTextActive]}>Incoming</Text>
        </TouchableOpacity>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.teal} />
        </View>
      ) : (
        <FlatList
          data={referrals}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          refreshing={loading}
          onRefresh={load}
          ListEmptyComponent={<Text style={styles.empty}>No {tab} referrals.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.status}>{item.status.toUpperCase()}</Text>
                <Text style={styles.date}>{new Date(item.sentAt).toLocaleDateString()}</Text>
              </View>
              {tab === "incoming" && item.status === "sent" && (
                <TouchableOpacity
                  style={styles.claimButton}
                  onPress={() => handleClaim(item.id)}
                  disabled={claimingId === item.id}
                >
                  {claimingId === item.id ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.claimButtonText}>Claim referral — creates local record</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { backgroundColor: colors.navy, padding: 16, paddingTop: 48 },
  back: { color: "#8FE0C4", fontSize: 13, marginBottom: 8 },
  title: { color: "#fff", fontSize: 18, fontWeight: "700" },
  tabs: { flexDirection: "row", backgroundColor: colors.border, margin: 16, borderRadius: 10, padding: 3 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  tabActive: { backgroundColor: colors.surface },
  tabText: { fontSize: 12, fontWeight: "600", color: colors.inkSoft },
  tabTextActive: { color: colors.ink },
  error: { color: colors.red, paddingHorizontal: 16 },
  empty: { color: colors.inkFaint, textAlign: "center", marginTop: 40 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  status: { fontSize: 10, fontWeight: "700", color: colors.teal },
  date: { fontSize: 10, color: colors.inkFaint },
  claimButton: {
    backgroundColor: colors.teal,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 8,
  },
  claimButtonText: { color: "#fff", fontSize: 12, fontWeight: "700" },
});