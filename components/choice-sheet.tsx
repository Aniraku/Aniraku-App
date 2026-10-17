import { useEffect, useState, type ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { AppIcon } from "@/components/app-icon";
import { nothing } from "@/components/nothing-ui";

export type ChoiceVariant = "primary" | "destructive" | "muted";

export type ChoiceOption = {
  key: string;
  label: string;
  onPress?: () => void;
  variant?: ChoiceVariant;
  /** Marks the option that's already active (renders a red dot). */
  isCurrent?: boolean;
  /** Optional leading icon — only use names present in app-icon.native. */
  icon?: string;
};

export type ChoiceSheetConfig = {
  /** Small mono uppercase kicker above the title (app signature accent). */
  kicker?: string;
  title: string;
  message?: string;
  options: ChoiceOption[];
};

// Module-level bus so any module (hook, screen, util) can open the sheet
// without threading React context through every call site. The provider owns
// the single listener that drives the Modal's state.
type Listener = (config: ChoiceSheetConfig) => void;
let listener: Listener | null = null;
let pending: ChoiceSheetConfig | null = null;

/** Open the themed picker. Safe to call from anywhere; queues until mount. */
export function showChoiceSheet(config: ChoiceSheetConfig) {
  if (listener) {
    listener(config);
    pending = null;
  } else {
    pending = config;
  }
}

/**
 * The app's themed bottom-sheet picker — the "nothing"-styled replacement for
 * the stock Android `Alert.alert` option dialogs (save-to-list, change-status,
 * age verification, …). Mounted once in `app/_layout.tsx`.
 */
export function ChoiceSheetProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ChoiceSheetConfig | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    listener = (next) => {
      setConfig(next);
      setVisible(true);
    };
    if (pending) {
      setConfig(pending);
      setVisible(true);
      pending = null;
    }
    return () => {
      listener = null;
    };
  }, []);

  const close = () => setVisible(false);
  const choose = (option: ChoiceOption) => {
    void Haptics.selectionAsync();
    // Close first so the sheet fades out, then run the action. This lets an
    // action open ANOTHER sheet cleanly (Save → status picker) in one batch.
    setVisible(false);
    option.onPress?.();
  };

  return (
    <>
      {children}
      <Modal transparent visible={visible} animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <View style={styles.sheet} accessibilityViewIsModal>
            {config?.kicker ? <Text style={styles.kicker}>{config.kicker}</Text> : null}
            <View style={styles.header}>
              <Text numberOfLines={2} style={styles.title}>{config?.title}</Text>
              {config?.message ? <Text style={styles.message}>{config.message}</Text> : null}
            </View>
            <View style={styles.divider} />
            {(config?.options ?? []).map((option) => (
              <Pressable
                key={option.key}
                accessibilityRole="button"
                accessibilityState={{ selected: option.isCurrent }}
                accessibilityLabel={option.label}
                onPress={() => choose(option)}
                style={({ pressed }) => [styles.optionRow, pressed && styles.optionPressed]}
              >
                {option.icon ? <AppIcon name={option.icon} size={18} color={nothing.white} /> : null}
                <Text
                  numberOfLines={1}
                  style={[
                    styles.optionLabel,
                    option.variant === "primary" && styles.primaryLabel,
                    option.variant === "destructive" && styles.destructiveLabel,
                    option.variant === "muted" && styles.mutedLabel,
                    option.isCurrent && styles.currentLabel,
                  ]}
                >
                  {option.label}
                </Text>
                {option.isCurrent ? <View style={styles.currentDot} /> : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, padding: 20, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.76)" },
  sheet: { gap: 0, padding: 4, borderRadius: 12, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.surface },
  kicker: { fontFamily: nothing.mono, fontSize: 10, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", color: nothing.red, paddingHorizontal: 14, paddingTop: 12 },
  header: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12, gap: 5 },
  title: { color: nothing.white, fontSize: 16, fontWeight: "900", letterSpacing: -0.3, lineHeight: 21 },
  message: { color: nothing.muted, fontSize: 13, lineHeight: 19 },
  divider: { height: 1, backgroundColor: nothing.line, marginHorizontal: 10 },
  optionRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 15, paddingHorizontal: 14 },
  optionPressed: { backgroundColor: nothing.raised },
  optionLabel: { flex: 1, color: nothing.white, fontSize: 15, fontWeight: "700" },
  primaryLabel: { color: nothing.red, fontWeight: "900" },
  destructiveLabel: { color: nothing.red, fontWeight: "800" },
  mutedLabel: { color: nothing.dim, fontWeight: "700" },
  currentLabel: { color: nothing.white, fontWeight: "900" },
  currentDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: nothing.red },
});
