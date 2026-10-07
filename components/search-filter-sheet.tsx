import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { FilterChipGroup } from "@/components/filter-chip-group";
import { AppIcon } from "@/components/app-icon";
import { nothing } from "@/components/nothing-ui";
import {
  countActiveFilters,
  EMPTY_FILTERS,
  FORMAT_OPTIONS,
  SEASON_OPTIONS,
  SORT_OPTIONS,
  STATUS_OPTIONS,
  YEAR_OPTIONS,
  type SearchFilters,
} from "@/lib/search-filters";
import * as Haptics from "expo-haptics";

type Props = {
  visible: boolean;
  filters: SearchFilters;
  onClose: () => void;
  onApply: (filters: SearchFilters) => void;
};

/**
 * Bottom-sheet style filter panel for search results. Draft state lives here
 * so dismissing without applying never mutates the active query.
 */
export function SearchFilterSheet({ visible, filters, onClose, onApply }: Props) {
  const [draft, setDraft] = useState<SearchFilters>(filters);

  useEffect(() => {
    if (visible) setDraft(filters);
  }, [visible, filters]);

  const set = (key: keyof SearchFilters) => (value: string | null) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const activeCount = countActiveFilters(draft);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>FILTERS</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close filters" onPress={onClose} hitSlop={10} style={({ pressed }) => pressed && styles.pressed}>
              <AppIcon name="close" size={18} color={nothing.muted} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            <FilterChipGroup label="SORT BY" items={SORT_OPTIONS} selected={draft.sort} onToggle={set("sort")} />
            <FilterChipGroup label="STATUS" items={STATUS_OPTIONS} selected={draft.status} onToggle={set("status")} />
            <FilterChipGroup label="FORMAT" items={FORMAT_OPTIONS} selected={draft.format} onToggle={set("format")} />
            <FilterChipGroup label="SEASON" items={SEASON_OPTIONS} selected={draft.season} onToggle={set("season")} />
            <FilterChipGroup label="YEAR" items={YEAR_OPTIONS} selected={draft.year} onToggle={set("year")} />
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear all filters"
              onPress={() => setDraft({ ...EMPTY_FILTERS })}
              style={({ pressed }) => [styles.clearBtn, pressed && styles.pressed]}
            >
              <Text style={styles.clearText}>CLEAR{activeCount ? ` (${activeCount})` : ""}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Apply filters"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onApply(draft);
                onClose();
              }}
              style={({ pressed }) => [styles.applyBtn, pressed && styles.pressed]}
            >
              <Text style={styles.applyText}>APPLY</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "flex-end" },
  sheet: { backgroundColor: nothing.black, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1, borderColor: nothing.line, maxHeight: "82%", paddingTop: 14 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingBottom: 10 },
  title: { color: nothing.white, fontSize: 13, fontWeight: "900", letterSpacing: 1 },
  body: { paddingHorizontal: 18, paddingBottom: 18, gap: 18 },
  footer: { flexDirection: "row", gap: 10, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 22, borderTopWidth: 1, borderTopColor: nothing.line },
  clearBtn: { flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: 1, borderColor: nothing.line },
  clearText: { color: nothing.muted, fontSize: 12, fontWeight: "900", letterSpacing: 0.6 },
  applyBtn: { flex: 2, minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: nothing.red },
  applyText: { color: nothing.white, fontSize: 13, fontWeight: "900", letterSpacing: 0.8 },
  pressed: nothing.pressed,
});
