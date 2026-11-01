import { useState } from "react";
import { FlatList, Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { ANIRAKU_AVATARS } from "@/lib/aniraku-avatars";
import { nothing } from "@/components/nothing-ui";

/**
 * Themed avatar picker: the same Aniraku avatar set the website uses
 * (Supabase public bucket), saved as the profile's avatar_url.
 */
export function AvatarPickerSheet({ visible, currentUrl, onClose, onPick }: {
  visible: boolean;
  currentUrl?: string | null;
  onClose: () => void;
  onPick: (url: string) => void;
}) {
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!pendingUrl || saving) return;
    setSaving(true);
    void Haptics.selectionAsync().catch(() => {});
    try {
      await onPick(pendingUrl);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.kicker}>PROFILE · AVATAR</Text>
          <Text style={styles.title}>Pick your avatar</Text>
          <Text style={styles.message}>Same set as the Aniraku website — choose once, everywhere.</Text>
          <FlatList
            data={ANIRAKU_AVATARS}
            keyExtractor={(item) => String(item.id)}
            numColumns={4}
            style={styles.grid}
            contentContainerStyle={styles.gridContent}
            renderItem={({ item }) => {
              const selected = currentUrl === item.url || pendingUrl === item.url;
              return (
                <Pressable accessibilityRole="button" accessibilityLabel={`Avatar ${item.name}`} onPress={() => setPendingUrl(item.url)} style={[styles.cell, selected && styles.cellActive]}>
                  <Image source={{ uri: item.url }} style={styles.avatar} />
                  {selected ? <View style={styles.dot} /> : null}
                </Pressable>
              );
            }}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Save avatar" onPress={save} disabled={!pendingUrl || saving} style={[styles.save, (!pendingUrl || saving) && styles.saveDisabled]}>
            <Text style={styles.saveText}>{saving ? "SAVING…" : "SAVE AVATAR"}</Text>
          </Pressable>
          <Pressable onPress={onClose} hitSlop={8} style={styles.later}>
            <Text style={styles.laterText}>CANCEL</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.86)", alignItems: "center", justifyContent: "center", padding: 20 },
  sheet: { width: "100%", maxWidth: 420, borderRadius: 12, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.surface, padding: 18, gap: 8 },
  kicker: { color: nothing.red, fontSize: 10, fontWeight: "800", letterSpacing: 1, fontFamily: nothing.mono },
  title: { color: nothing.white, fontSize: 17, fontWeight: "900", letterSpacing: -0.3 },
  message: { color: nothing.muted, fontSize: 12.5, lineHeight: 18 },
  grid: { maxHeight: 320 },
  gridContent: { gap: 10 },
  gridRow: { justifyContent: "space-between" },
  cell: { width: 72, height: 72, borderRadius: 8, borderWidth: 1, borderColor: nothing.line, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  cellActive: { borderColor: nothing.red, borderWidth: 2 },
  avatar: { width: 68, height: 68 },
  dot: { position: "absolute", bottom: 4, right: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: nothing.red },
  save: { minHeight: 48, borderRadius: 8, backgroundColor: nothing.red, alignItems: "center", justifyContent: "center" },
  saveDisabled: { opacity: 0.5 },
  saveText: { color: nothing.black, fontWeight: "900", fontSize: 12, letterSpacing: 0.8 },
  later: { alignItems: "center", paddingVertical: 6 },
  laterText: { color: nothing.dim, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
});
