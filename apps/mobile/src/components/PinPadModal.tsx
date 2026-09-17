import React, { useState } from "react";
import { Modal, View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { ApiClient, ApiError } from "../api/client";
import { verifyPinForAction } from "../api/auth";
import { colors } from "../theme/colors";

interface Props {
  visible: boolean;
  client: ApiClient;
  onCancel: () => void;
  /** Called with the short-lived, individually-attributed token once the
   * PIN checks out. The caller uses this token for exactly ONE write via
   * client.requestWithToken(...) — it's not meant to be kept around. */
  onVerified: (token: string) => void;
}

export function PinPadModal({ visible, client, onCancel, onVerified }: Props) {
  const [staffId, setStaffId] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setError(null);
    setLoading(true);
    try {
      const token = await verifyPinForAction(client, staffId.trim(), pin.trim());
      setPin("");
      onVerified(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not verify PIN.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Confirm it's you</Text>
          <Text style={styles.subtitle}>
            This is a shared ward device. Enter your staff ID and PIN to save this action under your name.
          </Text>

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
            placeholder="4-digit PIN"
            placeholderTextColor={colors.inkFaint}
            secureTextEntry
            keyboardType="number-pad"
            maxLength={4}
            value={pin}
            onChangeText={setPin}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel} disabled={loading}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleConfirm}
              disabled={loading || staffId.trim().length === 0 || pin.trim().length !== 4}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>Confirm & Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(11,43,58,0.55)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  title: { fontSize: 16, fontWeight: "700", color: colors.ink, marginBottom: 6 },
  subtitle: { fontSize: 13, color: colors.inkSoft, marginBottom: 16, lineHeight: 18 },
  input: {
    backgroundColor: colors.bg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.ink,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  error: { color: colors.red, fontSize: 12, marginBottom: 8 },
  buttonRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  cancelButton: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", backgroundColor: colors.bg },
  cancelText: { color: colors.inkSoft, fontWeight: "600" },
  confirmButton: { flex: 2, paddingVertical: 14, borderRadius: 12, alignItems: "center", backgroundColor: colors.teal },
  confirmText: { color: "#fff", fontWeight: "700" },
});