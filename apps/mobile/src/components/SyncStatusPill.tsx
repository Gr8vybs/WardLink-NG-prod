import React, { useCallback, useEffect, useState } from "react";
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from "react-native";
import { ApiClient } from "../api/client";
import { opQueue } from "../offline/queueInstance";
import { flushQueue } from "../offline/syncEngine";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { colors } from "../theme/colors";

interface Props {
  client: ApiClient;
  onFlushed?: () => void;
}

export function SyncStatusPill({ client, onFlushed }: Props) {
  const [pendingCount, setPendingCount] = useState(0);
  const [flushing, setFlushing] = useState(false);

  const refreshCount = useCallback(async () => {
    const pending = await opQueue.listPending();
    setPendingCount(pending.length);
  }, []);

  const runFlush = useCallback(async () => {
    setFlushing(true);
    try {
      await flushQueue(client, opQueue);
    } finally {
      setFlushing(false);
      await refreshCount();
      onFlushed?.();
    }
  }, [client, onFlushed, refreshCount]);

  const isOnline = useNetworkStatus(runFlush);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  let label: string;
  let color: string;
  if (!isOnline) {
    label = `${pendingCount} queued · offline`;
    color = colors.inkFaint;
  } else if (flushing) {
    label = "Syncing…";
    color = colors.amber;
  } else if (pendingCount > 0) {
    label = `${pendingCount} pending`;
    color = colors.amber;
  } else {
    label = "All synced";
    color = colors.mint;
  }

  return (
    <TouchableOpacity style={styles.pill} onPress={runFlush} disabled={flushing || !isOnline}>
      {flushing ? <ActivityIndicator size="small" color={color} /> : null}
      <Text style={[styles.text, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)" },
  text: { fontSize: 11, fontWeight: "600" },
});