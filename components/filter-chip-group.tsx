import { Pressable, StyleSheet, Text, View } from "react-native";
import { nothing } from "./nothing-ui";

type FilterItem = { key: string; label: string };

function toFilterItems(raw: (string | { label: string; value: string })[]): FilterItem[] {
  return raw.map((item) => typeof item === "string" ? { key: item, label: item } : { key: item.value, label: item.label });
}

export function FilterChipGroup({ label, items, selected, onToggle }: { label: string; items: (string | { label: string; value: string })[]; selected: string | null; onToggle: (key: string | null) => void }) {
  const filterItems = toFilterItems(items);
  return <View style={styles.group}>
    <Text style={styles.groupLabel}>{label}</Text>
    <View style={styles.chips}>
      {filterItems.map((item) => {
        const active = selected === item.key;
        return <Pressable key={item.key} onPress={() => onToggle(active ? null : item.key)} style={[styles.chip, active && styles.chipActive]}>
          <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  group: { gap: 6, minWidth: 120 },
  groupLabel: { color: nothing.dim, fontFamily: nothing.mono, fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  chip: { minHeight: 30, paddingHorizontal: 8, alignItems: "center", justifyContent: "center", borderRadius: 4, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.surface },
  chipActive: { borderColor: nothing.red, backgroundColor: "rgba(255,77,77,0.1)" },
  chipText: { color: nothing.muted, fontSize: 10, fontWeight: "800", letterSpacing: 0.2, textTransform: "uppercase" },
  chipTextActive: { color: nothing.red },
});
