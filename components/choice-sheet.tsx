import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from "react-native";
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
 * the stock Android alert dialogs (save-to-list, change-status,
 * age verification, …). Mounted once in `app/_layout.tsx`.
 */
export function ChoiceSheetProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ChoiceSheetConfig | null>(null);
  const [visible, setVisible] = useState(false);
  const enter = useRef(new Animated.Value(0)).current;

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

  useEffect(() => {
    if (!config) return;
    enter.setValue(0);
    Animated.timing(enter, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [config, enter]);

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
          <Animated.View style={[styles.sheet, { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [36, 0] }) }] }]} accessibilityViewIsModal>
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
          </Animated.View>
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

// ── ThemedDialog — the centered two-button confirm (replaces OS alerts) ──

export type ThemedDialogConfig = {
  kicker?: string;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
};

type DialogListener = (config: ThemedDialogConfig) => void;
let dialogListener: DialogListener | null = null;
let pendingDialog: ThemedDialogConfig | null = null;

export function showThemedDialog(config: ThemedDialogConfig) {
  if (dialogListener) {
    dialogListener(config);
    pendingDialog = null;
  } else {
    pendingDialog = config;
  }
}

/** Centered confirm card in the same house style. Mounted once in app/_layout.tsx. */
export function ThemedDialogProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ThemedDialogConfig | null>(null);
  const [visible, setVisible] = useState(false);
  const dialogEnter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!config) return;
    dialogEnter.setValue(0);
    Animated.timing(dialogEnter, { toValue: 1, duration: 150, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [config, dialogEnter]);

  useEffect(() => {
    dialogListener = (next) => {
      setConfig(next);
      setVisible(true);
    };
    if (pendingDialog) {
      setConfig(pendingDialog);
      setVisible(true);
      pendingDialog = null;
    }
    return () => {
      dialogListener = null;
    };
  }, []);

  const cancel = () => {
    setVisible(false);
    config?.onCancel?.();
  };
  const confirm = () => {
    void Haptics.selectionAsync();
    setVisible(false);
    config?.onConfirm();
  };

  return (
    <>
      {children}
      <Modal transparent visible={visible} animationType="fade" onRequestClose={cancel}>
        <Pressable style={dialogStyles.backdrop} onPress={cancel}>
          <Animated.View style={[dialogStyles.card, { opacity: dialogEnter, transform: [{ scale: dialogEnter.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }]} accessibilityViewIsModal>
            {config?.kicker ? <Text style={dialogStyles.kicker}>{config.kicker}</Text> : null}
            <Text style={dialogStyles.title}>{config?.title}</Text>
            {config?.message ? <Text style={dialogStyles.message}>{config.message}</Text> : null}
            <View style={dialogStyles.actions}>
              <Pressable accessibilityRole="button" onPress={cancel} style={({ pressed }) => [dialogStyles.button, pressed && dialogStyles.pressed]}>
                <Text style={dialogStyles.cancelLabel}>{config?.cancelLabel ?? "CANCEL"}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={confirm} style={({ pressed }) => [dialogStyles.button, pressed && dialogStyles.pressed]}>
                <Text style={[dialogStyles.confirmLabel, config?.destructive && dialogStyles.destructiveLabel]}>{config?.confirmLabel}</Text>
              </Pressable>
            </View>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}

// ── ThemedToast — inline error/notice banner with an optional Retry action ──

export type ThemedToastConfig = {
  message: string;
  /** e.g. "RETRY" — renders a tappable trailing action when present. */
  actionLabel?: string;
  onAction?: () => void;
  /** Error banners stay until dismissed; plain notices auto-hide after 4s. */
  tone?: "error" | "info";
};

type ToastListener = (config: ThemedToastConfig) => void;
let toastListener: ToastListener | null = null;
let pendingToast: ThemedToastConfig | null = null;

/** Queue the banner until the provider mounts — early errors must survive. */
export function showThemedToast(config: ThemedToastConfig) {
  if (toastListener) {
    toastListener(config);
    pendingToast = null;
  } else {
    pendingToast = config;
  }
}

export function ThemedToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ThemedToastConfig | null>(null);
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!toast) return;
    appear.setValue(0);
    Animated.timing(appear, { toValue: 1, duration: 150, useNativeDriver: true }).start();
  }, [toast, appear]);

  useEffect(() => {
    toastListener = setToast;
    if (pendingToast) {
      setToast(pendingToast);
      pendingToast = null;
    }
    return () => {
      toastListener = null;
    };
  }, []);

  useEffect(() => {
    // Error toasts persist (they carry a Retry); notices clear themselves.
    if (!toast || toast.tone !== "info") return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <>
      {children}
      {toast ? (
        <Animated.View style={[toastStyles.banner, { opacity: appear, borderColor: toast.tone === "error" ? nothing.red : nothing.line }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Text numberOfLines={3} style={toastStyles.message}>{toast.message}</Text>
          {toast.actionLabel ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={toast.actionLabel}
              onPress={() => {
                setToast(null);
                toast.onAction?.();
              }}
              style={({ pressed }) => [toastStyles.action, pressed && toastStyles.actionPressed]}
            >
              <Text style={toastStyles.actionLabel}>{toast.actionLabel}</Text>
            </Pressable>
          ) : (
            <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={() => setToast(null)} style={({ pressed }) => [toastStyles.action, pressed && toastStyles.actionPressed]} hitSlop={17}>
              <AppIcon name="close" size={14} color={nothing.muted} />
            </Pressable>
          )}
        </Animated.View>
      ) : null}
    </>
  );
}

const dialogStyles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center", padding: 32, backgroundColor: "rgba(0,0,0,0.76)" },
  card: { borderRadius: 12, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.surface, padding: 18, gap: 8 },
  kicker: { fontFamily: nothing.mono, fontSize: 10, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", color: nothing.red },
  title: { color: nothing.white, fontSize: 16, fontWeight: "900", letterSpacing: -0.3, lineHeight: 21 },
  message: { color: nothing.muted, fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 10 },
  button: { borderRadius: 8, borderWidth: 1, borderColor: nothing.line, paddingVertical: 10, paddingHorizontal: 16, minHeight: 48, justifyContent: "center" },
  pressed: { backgroundColor: nothing.raised },
  cancelLabel: { color: nothing.muted, fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },
  confirmLabel: { color: nothing.white, fontSize: 13, fontWeight: "900", letterSpacing: 0.5 },
  destructiveLabel: { color: nothing.red },
});

const toastStyles = StyleSheet.create({
  banner: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: nothing.line,
    backgroundColor: nothing.surface,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  message: { flex: 1, color: nothing.white, fontSize: 13, fontWeight: "700", lineHeight: 18 },
  action: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 6 },
  actionPressed: { backgroundColor: nothing.raised },
  actionLabel: { color: nothing.red, fontFamily: nothing.mono, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
});
