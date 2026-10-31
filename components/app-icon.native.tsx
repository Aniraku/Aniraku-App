import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";
import { SVG_ICONS } from "@/components/svg-icons";

export type AppIconName = string;

export function AppIcon({ name, size = 20, color, style }: { name: AppIconName | string; size?: number; color: string; style?: StyleProp<ViewStyle> }) {
  const Icon = SVG_ICONS[name as keyof typeof SVG_ICONS] ?? SVG_ICONS["x"];
  return (
    <View style={style}>
      <Icon size={size} color={color} />
    </View>
  );
}
