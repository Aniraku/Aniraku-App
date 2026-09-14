import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "@/components/app-icon";
import { nothing } from "@/components/nothing-ui";

type EmptyStateProps = {
  icon: string;
  title: string;
  message: string;
  action?: { label: string; onPress: () => void };
};

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <AppIcon name={icon} size={48} color={nothing.dim} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {action ? (
        <Pressable onPress={action.onPress} style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
          <Text style={styles.btnText}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptySearch({ query }: { query: string }) {
  return (
    <EmptyState
      icon="magnify-close"
      title="Nothing found"
      message={`No results for "${query}". Try a different search or browse genres.`}
    />
  );
}

export function EmptyEpisodes() {
  return (
    <EmptyState
      icon="play-circle-outline"
      title="No episodes yet"
      message="Episodes will appear here once they become available. Check back soon!"
    />
  );
}

export function EmptyLibrary() {
  return (
    <EmptyState
      icon="bookmark-outline"
      title="Your library is empty"
      message="Save anime to your library to keep track of what you love."
      action={{ label: "Browse anime", onPress: () => {} }}
    />
  );
}

export function EmptyHistory() {
  return (
    <EmptyState
      icon="history"
      title="No watch history"
      message="Start watching anime to build your history here."
      action={{ label: "Browse anime", onPress: () => {} }}
    />
  );
}

export function EmptySchedule() {
  return (
    <EmptyState
      icon="calendar-blank-outline"
      title="Nothing airing today"
      message="No scheduled episodes for today. Check other days or discover new anime."
    />
  );
}

export function EmptyComments() {
  return (
    <View style={styles.compact}>
      <AppIcon name="comment-outline" size={20} color={nothing.dim} />
      <Text style={styles.compactText}>No comments yet. Start the conversation!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 20, gap: 12 },
  iconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: nothing.surface, borderWidth: 1, borderColor: nothing.line, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  title: { color: nothing.white, fontSize: 18, fontWeight: "900", letterSpacing: -0.4, textAlign: "center" },
  message: { color: nothing.muted, fontSize: 13, lineHeight: 18, textAlign: "center", maxWidth: 280 },
  btn: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: nothing.red },
  btnText: { color: nothing.black, fontSize: 13, fontWeight: "800" },
  pressed: nothing.pressed,
  compact: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 16, paddingHorizontal: 4 },
  compactText: { color: nothing.dim, fontSize: 12, fontWeight: "600" },
});
