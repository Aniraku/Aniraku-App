import type { StyleProp, ViewStyle } from "react-native";
import {
  ArrowBendUpLeft,
  ArrowLeft,
  ArrowSquareOut,
  ArrowUpRight,
  ArrowsClockwise,
  Bell,
  Bookmarks,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  Clock,
  CloudX,
  Copy,
  DownloadSimple,
  Eye,
  EyeSlash,
  FastForward,
  FilmStrip,
  Fire,
  Gear,
  Heart,
  Link,
  MagnifyingGlass,
  Moon,
  PaperPlaneTilt,
  Play,
  Rewind,
  ShareNetwork,
  SlidersHorizontal,
  Stack,
  Trash,
  UserGear,
  X,
} from "phosphor-react-native";

// Legacy MaterialCommunityIcons / Ionicons names kept as the public contract
// so existing call sites need no changes. Internally everything renders
// Phosphor (de-slop law: Phosphor-only icons).
export type AppIconName =
  | "account-edit-outline"
  | "arrow-left"
  | "arrow-top-right"
  | "bell-outline"
  | "bookmark-multiple-outline"
  | "chevron-down"
  | "chevron-left"
  | "chevron-right"
  | "chevron-up"
  | "clock-outline"
  | "close"
  | "cloud-offline-outline"
  | "cog-outline"
  | "content-copy"
  | "download"
  | "eye-off-outline"
  | "eye-outline"
  | "fast-forward"
  | "fast-forward-10"
  | "fire"
  | "heart"
  | "heart-outline"
  | "layers"
  | "link-variant"
  | "magnify"
  | "movie-open-outline"
  | "open-in-new"
  | "play"
  | "play-circle"
  | "refresh"
  | "reply-outline"
  | "rewind-10"
  | "send"
  | "share-variant"
  | "sleep"
  | "sync"
  | "trash-can-outline"
  | "tune-variant";

const WEIGHT = "regular" as const;

export function AppIcon({ name, size = 20, color, style }: { name: AppIconName | string; size?: number; color: string; style?: StyleProp<ViewStyle> }) {
  const props = { size, color, weight: WEIGHT, style } as const;
  switch (name) {
    case "arrow-left": return <ArrowLeft {...props} />;
    case "arrow-top-right": return <ArrowUpRight {...props} />;
    case "chevron-left": return <CaretLeft {...props} />;
    case "chevron-right": return <CaretRight {...props} />;
    case "chevron-up": return <CaretUp {...props} />;
    case "chevron-down": return <CaretDown {...props} />;
    case "magnify": return <MagnifyingGlass {...props} />;
    case "play": return <Play {...props} weight="fill" />;
    case "play-circle": return <Play {...props} weight="fill" />;
    case "fire": return <Fire {...props} />;
    case "sync":
    case "refresh": return <ArrowsClockwise {...props} />;
    case "tune-variant": return <SlidersHorizontal {...props} />;
    case "link-variant": return <Link {...props} />;
    case "share-variant": return <ShareNetwork {...props} />;
    case "open-in-new": return <ArrowSquareOut {...props} />;
    case "content-copy": return <Copy {...props} />;
    case "sleep": return <Moon {...props} />;
    case "close": return <X {...props} />;
    case "eye-off-outline": return <EyeSlash {...props} />;
    case "eye-outline": return <Eye {...props} />;
    case "send": return <PaperPlaneTilt {...props} />;
    case "reply-outline": return <ArrowBendUpLeft {...props} />;
    case "trash-can-outline": return <Trash {...props} />;
    case "clock-outline": return <Clock {...props} />;
    case "download": return <DownloadSimple {...props} />;
    case "rewind-10": return <Rewind {...props} />;
    case "fast-forward":
    case "fast-forward-10": return <FastForward {...props} />;
    case "layers": return <Stack {...props} />;
    case "bell-outline": return <Bell {...props} />;
    case "bookmark-multiple-outline": return <Bookmarks {...props} />;
    case "cog-outline": return <Gear {...props} />;
    case "heart": return <Heart {...props} weight="fill" />;
    case "heart-outline": return <Heart {...props} />;
    case "account-edit-outline": return <UserGear {...props} />;
    case "movie-open-outline": return <FilmStrip {...props} />;
    case "cloud-offline-outline": return <CloudX {...props} />;
    default: return <X {...props} />;
  }
}
