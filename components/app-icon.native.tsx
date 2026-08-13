import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";
import type { StyleProp, TextStyle } from "react-native";

type NativeIconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

export function AppIcon({ name, size = 20, color, style }: { name: NativeIconName; size?: number; color: string; style?: StyleProp<TextStyle> }) {
  return <MaterialCommunityIcons name={name} size={size} color={color} style={style} />;
}
