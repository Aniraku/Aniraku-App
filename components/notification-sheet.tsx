import { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "@/components/app-icon";
import { nothing } from "@/components/nothing-ui";
import { useNotifications } from "@/hooks/use-notifications";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function NotificationSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { notifications, markRead, markAllRead } = useNotifications();
  const [filter, setFilter] = useState<"all" | "unread">("unread");
  const items = notifications.data ?? [];
  const filtered = filter === "unread" ? items.filter((n) => !n.read) : items;
  const unreadCount = items.filter((n) => !n.read).length;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Dismiss layer sits BEHIND the sheet so row/filter taps never bubble up and close it. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close notifications" />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Notifications</Text>
            {unreadCount > 0 ? <Text style={styles.badge}>{unreadCount}</Text> : null}
          </View>
          <View style={styles.filterRow}>
            <Pressable onPress={() => setFilter("unread")} style={[styles.filterBtn, filter === "unread" && styles.filterActive]}>
              <Text style={[styles.filterText, filter === "unread" && styles.filterTextActive]}>UNREAD</Text>
            </Pressable>
            <Pressable onPress={() => setFilter("all")} style={[styles.filterBtn, filter === "all" && styles.filterActive]}>
              <Text style={[styles.filterText, filter === "all" && styles.filterTextActive]}>ALL</Text>
            </Pressable>
            {unreadCount > 0 ? (
              <Pressable onPress={() => markAllRead.mutate()} style={styles.markAllBtn}>
                <Text style={styles.markAllText}>MARK ALL READ</Text>
              </Pressable>
            ) : null}
          </View>
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <AppIcon name="bell" color={nothing.dim} size={28} />
              <Text style={styles.emptyText}>{filter === "unread" ? "You're all caught up" : "No notifications yet"}</Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => { if (!item.read) markRead.mutate(item.id); }}
                  style={[styles.row, !item.read && styles.rowUnread]}
                >
                  <View style={styles.rowDot}>
                    {!item.read ? <View style={styles.unreadDot} /> : null}
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowMessage} numberOfLines={2}>{item.message ?? "New update"}</Text>
                    <Text style={styles.rowTime}>{item.created_at ? timeAgo(item.created_at) : ""}</Text>
                  </View>
                </Pressable>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              contentContainerStyle={styles.list}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.72)" },
  sheet: { backgroundColor: nothing.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 34, maxHeight: "70%", borderWidth: 1, borderColor: nothing.line, borderBottomWidth: 0 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: nothing.line, alignSelf: "center", marginTop: 10, marginBottom: 8 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 18, marginBottom: 4 },
  title: { color: nothing.white, fontSize: 17, fontWeight: "700" },
  badge: { backgroundColor: nothing.red, color: nothing.white, fontSize: 11, fontWeight: "700", paddingHorizontal: 7, paddingVertical: 1, borderRadius: 10, overflow: "hidden" },
  filterRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 18, marginBottom: 8 },
  filterBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: nothing.line },
  filterActive: { borderColor: nothing.red, backgroundColor: "rgba(255,77,77,0.12)" },
  filterText: { color: nothing.dim, fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  filterTextActive: { color: nothing.white },
  markAllBtn: { marginLeft: "auto", paddingHorizontal: 8, paddingVertical: 4 },
  markAllText: { color: nothing.red, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  empty: { alignItems: "center", gap: 10, paddingVertical: 36 },
  emptyText: { color: nothing.dim, fontSize: 13 },
  list: { paddingHorizontal: 18 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 12 },
  rowUnread: { backgroundColor: "rgba(255,77,77,0.06)", marginHorizontal: -18, paddingHorizontal: 18, borderRadius: 8 },
  rowDot: { width: 16, paddingTop: 6, alignItems: "center" },
  unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: nothing.red },
  rowBody: { flex: 1, gap: 3 },
  rowMessage: { color: nothing.white, fontSize: 13, lineHeight: 17 },
  rowTime: { color: nothing.dim, fontSize: 11 },
  separator: { height: 1, backgroundColor: nothing.line, marginLeft: 26 },
});
