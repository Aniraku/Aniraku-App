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
  House,
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
  User,
  UserGear,
  X,
  CalendarBlank,
  BookmarkSimple,
  DiceOne,
  ShuffleSimple,
} from "phosphor-react-native";

export type AppIconName = string;

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
    case "home": return <House {...props} />;
    case "home-variant-outline": return <House {...props} />;
    case "play": return <Play {...props} weight="fill" />;
    case "play-circle": return <Play {...props} weight="fill" />;
    case "play-circle-outline": return <Play {...props} />;
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
    case "eye": return <Eye {...props} />;
    case "send": return <PaperPlaneTilt {...props} />;
    case "reply-outline": return <ArrowBendUpLeft {...props} />;
    case "reply": return <ArrowBendUpLeft {...props} />;
    case "trash-can-outline": return <Trash {...props} />;
    case "clock-outline": return <Clock {...props} />;
    case "clock-counter": return <Clock {...props} />;
    case "download": return <DownloadSimple {...props} />;
    case "rewind-10": return <Rewind {...props} />;
    case "fast-forward":
    case "fast-forward-10": return <FastForward {...props} />;
    case "layers": return <Stack {...props} />;
    case "bell": return <Bell {...props} />;
    case "bell-outline": return <Bell {...props} />;
    case "bookmark": return <BookmarkSimple {...props} />;
    case "bookmark-multiple-outline": return <Bookmarks {...props} />;
    case "cog-outline": return <Gear {...props} />;
    case "heart": return <Heart {...props} weight="fill" />;
    case "heart-outline": return <Heart {...props} />;
    case "account-edit-outline": return <UserGear {...props} />;
    case "account": return <User {...props} />;
    case "account-circle-outline": return <User {...props} />;
    case "movie-open-outline": return <FilmStrip {...props} />;
    case "cloud-offline-outline": return <CloudX {...props} />;
    case "calendar": return <CalendarBlank {...props} />;
    case "calendar-blank-outline": return <CalendarBlank {...props} />;
    case "view-grid-outline": return <Stack {...props} />;
    case "delete-forever-outline": return <Trash {...props} />;
    case "logout": return <ArrowBendUpLeft {...props} />;
    case "cellphone-arrow-down": return <DownloadSimple {...props} />;
    case "dice": return <DiceOne {...props} />;
    case "shuffle": return <ShuffleSimple {...props} />;
    case "information": return <Eye {...props} />;
    case "file-document-outline": return <Copy {...props} />;
    default: return <X {...props} />;
  }
}
