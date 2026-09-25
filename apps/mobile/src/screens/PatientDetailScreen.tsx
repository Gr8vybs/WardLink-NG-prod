import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, ScrollView } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ApiClient, ApiError } from "../api/client";
import { findOpenHandoff, createHandoff, getHandoffDetail, addNote, acknowledgeHandoff, pullStructuredFields, HandoffDetail } from "../api/handoff";
import { listWards } from "../api/ward";
import { pushFieldOps } from "../api/sync";
import { initiateAttachment, uploadAttachmentFile, listAttachmentsForPatient } from "../api/attachment";
import { nextHlc } from "../hlc/hlc";
import { decodeJwtPayload } from "../auth/decodeToken";
import { PinPadModal } from "../components/PinPadModal";
import { AttachmentThumbnail } from "../components/AttachmentThumbnail";
import { SyncStatusPill } from "../components/SyncStatusPill";
import { opQueue } from "../offline/queueInstance";
import { flushQueue } from "../offline/syncEngine";
import { cacheGet, cacheSet, CacheKeys } from "../offline/cache";
import type { Patient, StructuredField, Attachment, FieldType } from "@wardlink/shared";
import { colors } from "../theme/colors";

interface Props {
  client: ApiClient;
  patient: Patient;
  onBack: () => void;
  onRefer: () => void;
}

const FIELD_TYPES: FieldType[] = ["vitals", "meds", "allergies", "codeStatus"];

export function PatientDetailScreen({ client, patient, onBack, onRefer }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [handoffDetail, setHandoffDetail] = useState<HandoffDetail | null>(null);
  const [fields, setFields] = useState<StructuredField[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [noteText, setNoteText] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const [editingField, setEditingField] = useState<FieldType | null>(null);
  const [editValue, setEditValue] = useState("");

  const [requiresPin, setRequiresPin] = useState(false);
  const [pendingAction, setPendingAction] = useState<((token: string) => Promise<void>) | null>(null);

  const fieldsCacheKey = CacheKeys.structuredFields(patient.id);

  const load = useCallback(async () => {
    setError(null);

    const cachedFields = await cacheGet<StructuredField[]>(fieldsCacheKey);
    if (cachedFields) {
      setFields(cachedFields);
      setLoading(false);
    }

    try {
      const token = await client.tokenStore.getToken();
      const payload = token ? decodeJwtPayload(token) : null;
      setRequiresPin(payload?.authType === "shared_device");

      const [openHandoff, structuredFields, attachmentList] = await Promise.all([
        findOpenHandoff(client, patient.id),
        pullStructuredFields(client, patient.id),
        listAttachmentsForPatient(client, patient.id),
      ]);
      setFields(structuredFields);
      await cacheSet(fieldsCacheKey, structuredFields);
      setAttachments(attachmentList);

      if (openHandoff) {
        setHandoffDetail(await getHandoffDetail(client, openHandoff.id));
      } else {
        setHandoffDetail(null);
      }
    } catch (err) {
      if (!cachedFields) {
        setError(err instanceof ApiError ? err.message : "Failed to load patient data. Showing offline data if available.");
      }
    } finally {
      setLoading(false);
    }
  }, [client, patient.id, fieldsCacheKey]);

  useEffect(() => {
    load();
  }, [load]);

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
        const wards = await listWards(client);
        if (wards.length === 0) {
          setError("No wards exist for this facility yet — create one first.");
          return;
        }
        const hlc = await nextHlc();
        const handoff = await createHandoff(client, patient.id, wards[0].id, "current-shift", hlc, overrideToken);
        setHandoffDetail(await getHandoffDetail(client, handoff.id));
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

  /**
   * Structured-field edits are the one write type where "immediate" and
   * "queued" genuinely differ by design:
   *  - Shared device: the PIN-verified token is short-lived (5 min) and
   *    cannot be attached to a queued write that might not sync until
   *    connectivity returns much later. Stays IMMEDIATE, same as notes.
   *  - Personal device: the session token is long-lived (12h), so it's
   *    safe to queue the write and let the sync engine use that same
   *    stored token later — this is the actual offline-first path.
   */
  const handleSaveField = async (fieldType: FieldType) => {
    const value = editValue.trim();
    if (!value) return;

    const existing = fields.find((f) => f.fieldType === fieldType);
    const hlc = await nextHlc();
    const payload = {
      patientId: patient.id,
      fieldType,
      value,
      hlc,
      baseHlc: existing ? existing.currentHlc : null,
    };

    setEditingField(null);
    setEditValue("");

    if (requiresPin) {
      await runAttributed(async (overrideToken) => {
        setBusy(true);
        setError(null);
        try {
          await pushFieldOps(client, [payload], overrideToken);
          await load();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Failed to save field.");
        } finally {
          setBusy(false);
        }
      });
      return;
    }

    setFields((current) => {
      const next = current.filter((f) => f.fieldType !== fieldType);
      return [
        ...next,
        { id: `local-${fieldType}`, patientId: patient.id, fieldType, currentValue: value, currentHlc: hlc, currentAuthorId: "you" },
      ];
    });
    await opQueue.enqueue("fieldOp", payload);
    flushQueue(client, opQueue).catch(() => {
      /* offline is an expected outcome here, not an error to surface */
    });
  };

  const handleAddAttachment = () =>
    runAttributed(async (overrideToken) => {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError("Photo library permission is needed to attach an image.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
      if (result.canceled || result.assets.length === 0) return;

      const asset = result.assets[0];
      const mimeType = asset.mimeType ?? "image/jpeg";
      const fileName = asset.fileName ?? `photo-${Date.now()}.jpg`;

      setUploadingAttachment(true);
      setError(null);
      try {
        const hlc = await nextHlc();
        const attachment = await initiateAttachment(client, patient.id, mimeType, hlc, overrideToken);
        await uploadAttachmentFile(client, attachment.id, { uri: asset.uri, name: fileName, type: mimeType }, overrideToken);
        setAttachments(await listAttachmentsForPatient(client, patient.id));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to upload attachment.");
      } finally {
        setUploadingAttachment(false);
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
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>{patient.demographics.name}</Text>
            <Text style={styles.subtitle}>
              {patient.demographics.age}
              {patient.demographics.sex} · Allergy: {patient.demographics.allergies}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end", gap: 8 }}>
            <SyncStatusPill client={client} onFlushed={load} />
            <TouchableOpacity onPress={onRefer}>
              <Text style={styles.referLink}>Refer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {error && <Text style={styles.error}>{error}</Text>}

        <Text style={styles.sectionLabel}>STRUCTURED FIELDS</Text>
        {FIELD_TYPES.map((fieldType) => {
          const field = fields.find((f) => f.fieldType === fieldType);
          return (
            <View key={fieldType} style={styles.fieldCard}>
              <View style={styles.fieldTopRow}>
                <Text style={styles.fieldType}>{fieldType.toUpperCase()}</Text>
                {editingField !== fieldType && (
                  <TouchableOpacity onPress={() => { setEditingField(fieldType); setEditValue(field?.currentValue ?? ""); }}>
                    <Text style={styles.editLink}>{field ? "Edit" : "Add"}</Text>
                  </TouchableOpacity>
                )}
              </View>
              {editingField === fieldType ? (
                <View style={styles.editRow}>
                  <TextInput
                    style={styles.editInput}
                    value={editValue}
                    onChangeText={setEditValue}
                    autoFocus
                    placeholder={`Enter ${fieldType}...`}
                    placeholderTextColor={colors.inkFaint}
                  />
                  <TouchableOpacity style={styles.saveFieldButton} onPress={() => handleSaveField(fieldType)}>
                    <Text style={styles.saveFieldButtonText}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditingField(null)}>
                    <Text style={styles.cancelFieldText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.fieldValue}>{field?.currentValue ?? "Not recorded"}</Text>
              )}
            </View>
          );
        })}

        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>ATTACHMENTS</Text>
        <View style={styles.attachmentRow}>
          {attachments.map((a) => (
            <AttachmentThumbnail key={a.id} client={client} attachmentId={a.id} />
          ))}
          <TouchableOpacity style={styles.addAttachmentButton} onPress={handleAddAttachment} disabled={uploadingAttachment}>
            {uploadingAttachment ? <ActivityIndicator size="small" color={colors.teal} /> : <Text style={styles.addAttachmentText}>+ Add</Text>}
          </TouchableOpacity>
        </View>

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
              <TextInput style={styles.noteInput} placeholder="Add a note..." placeholderTextColor={colors.inkFaint} value={noteText} onChangeText={setNoteText} />
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
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  referLink: { color: colors.mint, fontSize: 13, fontWeight: "700" },
  back: { color: "#8FE0C4", fontSize: 13, marginBottom: 8 },
  title: { color: "#fff", fontSize: 18, fontWeight: "700" },
  subtitle: { color: "#8FA9B5", fontSize: 12, marginTop: 2 },
  error: { color: colors.red, marginBottom: 12 },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: colors.inkFaint, letterSpacing: 0.5, marginBottom: 8 },
  fieldCard: { backgroundColor: colors.surface, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  fieldTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  fieldType: { fontSize: 10, fontWeight: "700", color: colors.inkFaint, marginBottom: 4 },
  fieldValue: { fontSize: 14, color: colors.ink },
  editLink: { fontSize: 11, fontWeight: "700", color: colors.teal },
  editRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  editInput: { flex: 1, backgroundColor: colors.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: colors.border, color: colors.ink, fontSize: 13 },
  saveFieldButton: { backgroundColor: colors.teal, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  saveFieldButtonText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  cancelFieldText: { color: colors.inkFaint, fontSize: 12 },
  attachmentRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  addAttachmentButton: { width: 72, height: 72, borderRadius: 10, backgroundColor: colors.tealSoft, justifyContent: "center", alignItems: "center" },
  addAttachmentText: { color: colors.teal, fontSize: 12, fontWeight: "700" },
  button: { backgroundColor: colors.teal, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  handoffStatus: { fontSize: 12, color: colors.inkSoft, marginBottom: 10 },
  noteCard: { backgroundColor: colors.surface, borderRadius: 10, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: colors.border },
  noteText: { fontSize: 13, color: colors.ink },
  noteMeta: { fontSize: 10, color: colors.inkFaint, marginTop: 4 },
  noteInputRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  noteInput: { flex: 1, backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: colors.border, color: colors.ink },
  sendButton: { backgroundColor: colors.teal, borderRadius: 10, paddingHorizontal: 16, justifyContent: "center" },
});