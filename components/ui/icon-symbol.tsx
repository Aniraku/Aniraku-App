// Fallback for using Phosphor on Android and web (de-slop law: Phosphor-only).

import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { OpaqueColorValue, type StyleProp, type ViewStyle } from "react-native";
import { AppIcon } from "@/components/app-icon";

type IconSymbolName = SymbolViewProps["name"];

/**
 * Add your SF Symbols to AppIcon (Phosphor) mappings here.
 */
const MAPPING: Record<string, string> = {
  "house.fill": "play",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "close",
  "chevron.right": "chevron-right",
};

/**
 * An icon component that uses native SF Symbols on iOS, and Phosphor on Android and web.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<ViewStyle>;
  weight?: SymbolWeight;
}) {
  return <AppIcon color={color as string} size={size} name={MAPPING[name] ?? "close"} style={style} />;
}
