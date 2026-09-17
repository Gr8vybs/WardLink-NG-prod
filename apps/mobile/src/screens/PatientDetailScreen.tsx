import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from "react-native";
import { ApiClient, ApiError } from "../api/client";
import {
  findOpenHandoff,
  createHandoff,
  getHandoffDetail,
  addNote,
  acknowledgeHandoff,
  pullStructuredFields,
  HandoffDetail,
} from "../api/handoff";
import { listWards } from "../api/ward";
import { nextHlc } from "../hlc/hlc";
import { decodeJwtPayload } from "../auth/decodeToken";
import { PinPadModal } from "../components/PinPadModal";
import type { Patient, StructuredField } from "@wardlink/shared";
import { colors } from "../theme/colors";

interface Props {
  client: ApiClient;
  patient: Patient;
  onBack: () => void;
}

export function PatientDetailScreen({ client, patient, onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [handoffDetail, setHandoffDetail] = useState<HandoffDetail | null>(null);
  const [fields, setFields] = useState<StructuredField[]>([]);
  const [noteText, setNoteText] = useState("");
  const [busy, setBusy] = useState(false);

  // Whether the CURRENT session needs a PIN before writing — true only
  // for a bare shared-device session (authType "shared_device"). An
  // individual login, or a session already PIN-verified, doesn't.
  const [requiresPin, setRequiresPin] = useState(false);

  // Holds whichever write action is waiting on PIN verification, so the
  // modal can call it back with the resulting attributed token once the
  // PIN checks out. null means no PIN prompt is currently showing.
  const [pendingAction, setPendingAction] = useState<((token: string) => Promise<void>) | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const token = await client.tokenStore.getToken();
      const payload = token ? decodeJwtPayload(token) : null;
      setRequiresPin(payload?.authType === "shared_device");

      const [openHandoff, structuredFields] = await Promise.all([
        findOpenHandoff(client, patient.id),
        pullStructuredFields(client, patient.id),
      ]);
      setFields(structuredFields);

      if (openHandoff) {
        const detail = await getHandoffDetail(client, openHandoff.id);
        setHandoffDetail(detail);
      } else {
        setHandoffDetail(null);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load patient data.");
    } finally {
      setLoading(false);
    }
  }, [client, patient.id]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Runs a write action, transparently handling the PIN step when
   * needed. `action` receives an override token to use for the request
   * on a shared device (via client.requestWithToken), or undefined on
   * a personal device (where the stored session token is already
   * individually attributed and needs no override).
   */
  const runAttributed = async (action: (overrideToken?: string) => Promise<void>) => {
    if (!requiresPin) {
      await action();
      return;
    }
    setPendingAction(() => async (token: string) => {
      await action(token);
    });
  };

  const handleStartHandoff = () =>
    runAttributed(async (overrideToken) => {
      setBusy(true);
      setError(null);
      try {
        // TODO: real ward selection UX — this picks the first ward on
        // the facility, which is fine for a single-ward test setup but
        // not a real multi-ward hospital.
        const wards = await listWards(client);
        if (wards.length === 0) {
          setError("No wards exist for this facility yet — create one first.");
          return;
        }
        const hlc = await nextHlc();
        const handoff = await createHandoff(client, patient.id, wards[0].id, "current-shift", hlc, overrideToken);
        const detail = await getHandoffDetail(client, handoff.id);
        setHandoffDetail(detail);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to start handoff.");
      } finally {
        setBusy(false);
      }
    });

  const handleAddNote = () =>
    runAttributed(async (overrideToken) => {
      if (!handoffDetail || !noteText.trim()) return;
      setBusy(true);
      setError(null);
      try {
        const hlc = await nextHlc();
        const note = await addNote(client, handoffDetail.handoff.id, noteText.trim(), hlc, overrideToken);
        setHandoffDetail((current) => (current ? { ...current, notes: [...current.notes, note] } : current));
        setNoteText("");
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to add note.");
      } finally {
        setBusy(false);
      }
    });

  const handleAcknowledge = () =>
    runAttributed(async (overrideToken) => {
      if (!handoffDetail) return;
      setBusy(true);
      setError(null);
      try {
        const hlc = await nextHlc();
        await acknowledgeHandoff(client, handoffDetail.handoff.id, hlc, overrideToken);
        setHandoffDetail((current) =>
          current ? { ...current, handoff: { ...current.handoff, status: "acknowledged" } } : current,
        );
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to acknowledge.");
      } finally {
        setBusy(false);
      }
    });

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
        <Text style={styles.title}>{patient.demographics.name}</Text>
        <Text style={styles.subtitle}>
          {patient.demographics.age}
          {patient.demographics.sex} · Allergy: {patient.demographics.allergies}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {error && <Text style={styles.error}>{error}</Text>}

        <Text style={styles.sectionLabel}>STRUCTURED FIELDS</Text>
        {fields.length === 0 ? (
          <Text style={styles.empty}>No structured data recorded yet.</Text>
        ) : (
          fields.map((f) => (
            <View key={f.id} style={styles.fieldCard}>
              <Text style={styles.fieldType}>{f.fieldType.toUpperCase()}</Text>
              <Text style={styles.fieldValue}>{f.currentValue}</Text>
            </View>
          ))
        )}

        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>HANDOFF</Text>
        {!handoffDetail ? (
          <TouchableOpacity style={styles.button} onPress={handleStartHandoff} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Start handoff</Text>}
          </TouchableOpacity>
        ) : (
          <>
            <Text style={styles.handoffStatus}>Status: {handoffDetail.handoff.status}</Text>

            {handoffDetail.notes.map((n) => (
              <View key={n.id} style={styles.noteCard}>
                <Text style={styles.noteText}>{n.text}</Text>
                <Text style={styles.noteMeta}>{new Date(n.createdAt).toLocaleTimeString()}</Text>
              </View>
            ))}

            <View style={styles.noteInputRow}>
              <TextInput
                style={styles.noteInput}
                placeholder="Add a note..."
                placeholderTextColor={colors.inkFaint}
                value={noteText}
                onChangeText={setNoteText}
              />
              <TouchableOpacity style={styles.sendButton} onPress={handleAddNote} disabled={busy}>
                <Text style={styles.buttonText}>Send</Text>
              </TouchableOpacity>
            </View>

            {handoffDetail.handoff.status === "open" && (
              <TouchableOpacity style={[styles.button, { marginTop: 16 }]} onPress={handleAcknowledge} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Acknowledge handoff</Text>}
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>

      <PinPadModal
        visible={pendingAction !== null}
        client={client}
        onCancel={() => setPendingAction(null)}
        onVerified={async (token) => {
          const action = pendingAction;
          setPendingAction(null);
          if (action) await action(token);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" },
  header: { backgroundColor: colors.navy, padding: 16, paddingTop: 48 },
  back: { color: "#8FE0C4", fontSize: 13, marginBottom: 8 },
  title: { color: "#fff", fontSize: 18, fontWeight: "700" },
  subtitle: { color: "#8FA9B5", fontSize: 12, marginTop: 2 },
  error: { color: colors.red, marginBottom: 12 },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: colors.inkFaint, letterSpacing: 0.5, marginBottom: 8 },
  empty: { color: colors.inkFaint, fontSize: 13 },
  fieldCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fieldType: { fontSize: 10, fontWeight: "700", color: colors.inkFaint, marginBottom: 4 },
  fieldValue: { fontSize: 14, color: colors.ink },
  button: {
    backgroundColor: colors.teal,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  handoffStatus: { fontSize: 12, color: colors.inkSoft, marginBottom: 10 },
  noteCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noteText: { fontSize: 13, color: colors.ink },
  noteMeta: { fontSize: 10, color: colors.inkFaint, marginTop: 4 },
  noteInputRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  noteInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.ink,
  },
  sendButton: {
    backgroundColor: colors.teal,
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
});