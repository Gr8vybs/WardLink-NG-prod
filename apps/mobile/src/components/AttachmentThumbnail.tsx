import React, { useEffect, useState } from "react";
import { Image, View, ActivityIndicator, StyleSheet } from "react-native";
import { ApiClient } from "../api/client";
import { getAttachmentImageSource } from "../api/attachment";
import { colors } from "../theme/colors";

interface Props {
  client: ApiClient;
  attachmentId: string;
}

/** RN's <Image> doesn't go through ApiClient, so it needs the auth
 * header handed to it directly via source={{ uri, headers }} — this
 * component just wraps that lookup so callers don't have to. */
export function AttachmentThumbnail({ client, attachmentId }: Props) {
  const [source, setSource] = useState<{ uri: string; headers: Record<string, string> } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getAttachmentImageSource(client, attachmentId);
      if (!cancelled) setSource(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [client, attachmentId]);

  if (!source) {
    return (
      <View style={styles.placeholder}>
        <ActivityIndicator size="small" color={colors.teal} />
      </View>
    );
  }

  return <Image source={source} style={styles.thumbnail} resizeMode="cover" />;
}

const styles = StyleSheet.create({
  thumbnail: { width: 72, height: 72, borderRadius: 10, backgroundColor: colors.border },
  placeholder: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
});